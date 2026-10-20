import assert from 'node:assert/strict';
import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';

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
		assert.deepEqual(Object.keys(tables), Object.keys(before.tables), 'New/removed tables require an explicit upgrade preservation contract');
		for (const [name, table] of Object.entries(tables)) {
			const original = before.tables[name].columns;
			assert.deepEqual(table.columns.slice(0, original.length), original, `${name}: migration changes existing columns; define its data conversion contract`);
			assert(table.columns.slice(original.length).every(column => column.notnull === 0 && column.dflt_value === null), `${name}: new columns need an explicit non-null/default data contract`);
		}
		return { tables, pending: pending.map(migration => ({ hash: migration.hash, created_at: migration.folderMillis })) };
	} finally { schema.close(); }
}

/** Strict for restarts, failed startup and restore; explicit SQL-derived changes only on upgrade. */
export function compareUpgradeData(before, after, label, expected = null) {
	assert.equal(after.integrity, 'ok', `${label}: SQLite integrity failed`);
	assert.deepEqual(after.foreignKeys, before.foreignKeys, `${label}: new foreign key violations`);
	assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables), `${label}: table inventory changed`);
	for (const [name, original] of Object.entries(before.tables)) {
		const actual = after.tables[name];
		if (expected && name === '__drizzle_migrations') {
			assert.equal(actual.schema, original.schema, `${label}: migration ledger schema changed`);
			assert.deepEqual(after.migrations.slice(0, before.migrations.length), before.migrations, `${label}: existing migration history changed`);
			assert.deepEqual(after.migrations.slice(before.migrations.length).map(({ hash, created_at }) => ({ hash, created_at })), expected.pending, `${label}: missing or unexpected migration records`);
			assert.equal(actual.count, before.migrations.length + expected.pending.length, `${label}: migration record count changed`);
		} else if (expected) {
			assert.equal(actual.schema, expected.tables[name].schema, `${label}: unexpected schema in ${name}`);
			assert.deepEqual(actual.columns, expected.tables[name].columns, `${label}: unexpected columns in ${name}`);
			assert.equal(actual.count, original.count, `${label}: row count changed in ${name}`);
			assert.equal(actual.originalColumnsSha256, original.sha256, `${label}: existing data changed in ${name}`);
			assert.equal(actual.addedColumnsAreNull, true, `${label}: new nullable columns contain unexpected data in ${name}`);
		} else {
			assert(actual.count === original.count && actual.sha256 === original.sha256 && actual.schema === original.schema, `${label}: contents or schema changed in table ${name}`);
		}
	}
	assert.deepEqual(after.images, before.images, `${label}: uploaded image checksums changed`);
}
