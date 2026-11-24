import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';

function legacyFavoriteCategoryName(settings) {
	try { return JSON.parse(settings)?.lang === 'de' ? 'Favoriten' : 'Favorites'; }
	catch { return 'Favorites'; }
}

/** Derive the exact additive schema changes from the shipped migration SQL. */
export function expectedUpgrade(before, migrations = readMigrationFiles({ migrationsFolder: './src/lib/db/migrations' })) {
	const lastApplied = Math.max(0, ...before.migrations.map(row => Number(row.created_at)));
	const pending = migrations.filter(migration => migration.folderMillis > lastApplied);
	const schema = new Database(':memory:');
	try {
		for (const table of Object.values(before.tables)) schema.exec(table.schema);
		for (const migration of pending) for (const statement of migration.sql) schema.exec(statement);
		const tables = Object.fromEntries(schema.prepare("SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(row => [row.name, {
			schema: row.sql,
			columns: schema.prepare(`PRAGMA table_info("${row.name.replaceAll('"', '""')}")`).all()
		}]));
		const favoriteCategories = new Map();
		const recipeCategoryAssignments = [];
		if (!before.tables.recipe_categories && tables.recipe_categories) {
			for (const { id, user_id, settings } of before.legacyRecipeFavorites) {
				const categoryId = `legacy-favorites:${user_id}`;
				const name = legacyFavoriteCategoryName(settings);
				favoriteCategories.set(user_id, { id: categoryId, user_id, name, normalized_name: name.toLowerCase(), sort_order: 0 });
				recipeCategoryAssignments.push({ id, category_id: categoryId });
			}
		}
		const newTableRows = { checklist_favorites: [], checklist_reminders: [], recipe_categories: [...favoriteCategories.values()] };
		for (const [name, table] of Object.entries(tables)) {
			const original = before.tables[name]?.columns;
			if (!original) {
				assert(Object.hasOwn(newTableRows, name), `${name}: new table requires an explicit upgrade preservation contract`);
				const rows = newTableRows[name];
				table.count = rows.length;
				table.sha256 = createHash('sha256').update(rows.map(row => JSON.stringify(row)).sort().join('\n')).digest('hex');
				continue;
			}
			assert.deepEqual(table.columns.slice(0, original.length), original, `${name}: migration changes existing columns; define its data conversion contract`);
			table.addedColumns = Object.fromEntries(table.columns.slice(original.length).map(column => {
				if (name === 'lists' && column.name === 'kind') {
					assert(column.notnull === 1 && column.dflt_value === "'shopping'", 'lists.kind must default to shopping');
					return [column.name, before.tables.lists.count];
				}
				assert(column.notnull === 0 && column.dflt_value === null, `${name}: new columns need an explicit non-null/default data contract`);
				return [column.name, name === 'recipes' && column.name === 'category_id' ? recipeCategoryAssignments.length : 0];
			}));
		}
		for (const name of Object.keys(before.tables)) assert(Object.hasOwn(tables, name), `${name}: removed table requires an explicit upgrade preservation contract`);
		return { tables, recipeCategoryAssignments, pending: pending.map(migration => ({ hash: migration.hash, created_at: migration.folderMillis })) };
	} finally { schema.close(); }
}

/** Strict for restarts, failed startup and restore; explicit SQL-derived changes only on upgrade. */
export function compareUpgradeData(before, after, label, expected = null) {
	assert.equal(after.integrity, 'ok', `${label}: SQLite integrity failed`);
	assert.deepEqual(after.foreignKeys, before.foreignKeys, `${label}: new foreign key violations`);
	assert.deepEqual(Object.keys(after.tables), Object.keys(expected?.tables ?? before.tables), `${label}: table inventory changed`);
	for (const name of Object.keys(after.tables)) {
		const original = before.tables[name];
		const actual = after.tables[name];
		if (expected && name === '__drizzle_migrations') {
			assert.equal(actual.schema, original.schema, `${label}: migration ledger schema changed`);
			assert.deepEqual(after.migrations.slice(0, before.migrations.length), before.migrations, `${label}: existing migration history changed`);
			assert.deepEqual(after.migrations.slice(before.migrations.length).map(({ hash, created_at }) => ({ hash, created_at })), expected.pending, `${label}: missing or unexpected migration records`);
			assert.equal(actual.count, before.migrations.length + expected.pending.length, `${label}: migration record count changed`);
		} else if (expected) {
			const target = expected.tables[name];
			assert.equal(actual.schema, target.schema, `${label}: unexpected schema in ${name}`);
			assert.deepEqual(actual.columns, target.columns, `${label}: unexpected columns in ${name}`);
			assert.equal(actual.count, (original ?? target).count, `${label}: unexpected row count in ${name}`);
			if (original) {
				assert.equal(actual.originalColumnsSha256, original.sha256, `${label}: existing data changed in ${name}`);
				assert.deepEqual(actual.addedColumns, target.addedColumns, `${label}: new columns contain unexpected data in ${name}`);
			} else {
				assert.equal(actual.sha256, target.sha256, `${label}: unexpected contents in new table ${name}`);
			}
		} else {
			assert(actual.count === original.count && actual.sha256 === original.sha256 && actual.schema === original.schema, `${label}: contents or schema changed in table ${name}`);
		}
	}
	if (expected && !before.tables.recipe_categories && expected.tables.recipe_categories) {
		assert.deepEqual(after.recipeCategoryAssignments, expected.recipeCategoryAssignments, `${label}: unexpected migrated recipe category assignments`);
	}
	assert.deepEqual(after.images, before.images, `${label}: uploaded image checksums changed`);
}
