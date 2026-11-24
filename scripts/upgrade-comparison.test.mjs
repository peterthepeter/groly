import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import { readMigrationFiles } from 'drizzle-orm/migrator';
import { snapshotUpgradeData } from './docker-fixtures.mjs';
import { expectedUpgrade, compareUpgradeData } from './upgrade-comparison.mjs';

const sql = 'ALTER TABLE user_invites ADD token_value text;';
const migration = { sql: [sql], folderMillis: 2, hash: createHash('sha256').update(sql).digest('hex') };

async function fixture(run) {
	const directory = mkdtempSync(join(tmpdir(), 'groly-upgrade-comparison-'));
	const path = join(directory, 'groly.db');
	const uploads = join(directory, 'uploads');
	mkdirSync(uploads);
	writeFileSync(join(uploads, 'recipe.png'), 'original-image');
	const db = new Database(path);
	try {
		db.exec(`
			CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, hash TEXT NOT NULL, created_at INTEGER);
			INSERT INTO __drizzle_migrations(hash,created_at) VALUES ('baseline',1);
			CREATE TABLE users (id TEXT PRIMARY KEY, name TEXT NOT NULL);
			INSERT INTO users VALUES ('a','Alice'),('b','Bob');
			CREATE TABLE user_invites (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), token_hash TEXT NOT NULL);
			INSERT INTO user_invites VALUES ('invite-a','a','hashed-a'),('invite-b','b','hashed-b');
		`);
		const snapshot = columns => snapshotUpgradeData(columns, path, uploads);
		const before = await snapshot();
		const columns = Object.fromEntries(Object.entries(before.tables).map(([name, table]) => [name, table.columns.map(column => column.name)]));
		const expected = expectedUpgrade(before, [migration]);
		db.exec(sql);
		db.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').run(migration.hash, migration.folderMillis);
		await run({ db, before, columns, expected, snapshot, uploads });
	} finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
}

test('accepts precisely the nullable column migration while preserving legacy invite rows', () => fixture(async ({ before, columns, expected, snapshot }) => {
	const after = await snapshot(columns);
	compareUpgradeData(before, after, 'Upgrade', expected);
	assert.equal(after.tables.user_invites.count, 2);
	assert.deepEqual(after.tables.user_invites.addedColumns, { token_value: 0 });
	assert.throws(() => compareUpgradeData(before, after, 'Strict restore'), /changed/);
	compareUpgradeData(before, before, 'Restore');
	compareUpgradeData(after, await snapshot(), 'Restart');
}));

for (const [name, mutation, message] of [
	['changed data', "UPDATE users SET name='Changed' WHERE id='a'", /existing data changed in users/],
	['lost rows', "DELETE FROM user_invites WHERE id='invite-a'", /unexpected row count in user_invites/],
	['swapped relationships', "UPDATE user_invites SET user_id=CASE user_id WHEN 'a' THEN 'b' ELSE 'a' END", /existing data changed in user_invites/],
	['unexpected schema', 'ALTER TABLE users ADD unexpected TEXT', /unexpected schema/],
	['unexpected new data', "UPDATE user_invites SET token_value='unexpected'", /new columns contain unexpected data/],
	['changed migration history', "UPDATE __drizzle_migrations SET hash='tampered' WHERE id=1", /existing migration history changed/],
	['missing migration', 'DELETE FROM __drizzle_migrations WHERE id=2', /missing or unexpected migration records/],
	['extra migration', "INSERT INTO __drizzle_migrations(hash,created_at) VALUES ('extra',3)", /missing or unexpected migration records/]
]) {
	test(`rejects ${name} during upgrade`, () => fixture(async ({ db, before, columns, expected, snapshot }) => {
		db.exec(mutation);
		const after = await snapshot(columns);
		assert.throws(() => compareUpgradeData(before, after, 'Upgrade', expected), message);
	}));
}

test('rejects changed images and foreign-key violations', () => fixture(async ({ db, before, columns, expected, snapshot, uploads }) => {
	writeFileSync(join(uploads, 'recipe.png'), 'changed-image');
	const imageChanged = await snapshot(columns);
	assert.throws(() => compareUpgradeData(before, imageChanged, 'Upgrade', expected), /uploaded image checksums changed/);
	db.pragma('foreign_keys = OFF'); // Deliberately corrupt the isolated fixture to exercise detection.
	db.exec("UPDATE user_invites SET user_id='missing' WHERE id='invite-a'");
	const brokenRelation = await snapshot(columns);
	assert.throws(() => compareUpgradeData(before, brokenRelation, 'Upgrade', expected), /new foreign key violations/);
}));

test('requires an explicit contract for destructive or non-null schema changes', () => fixture(async ({ before }) => {
	for (const sql of ['ALTER TABLE users DROP COLUMN name', 'ALTER TABLE users ADD value INTEGER NOT NULL DEFAULT 1', 'CREATE TABLE unexpected(id TEXT)']) {
		assert.throws(() => expectedUpgrade(before, [{ ...migration, sql: [sql] }]), /contract/);
	}
}));

test('verifies checklist defaults and the exact recipe favorite migration from the stable schema', async () => {
	const directory = mkdtempSync(join(tmpdir(), 'groly-stable-upgrade-'));
	const path = join(directory, 'groly.db');
	const db = new Database(path);
	const migrations = readMigrationFiles({ migrationsFolder: './src/lib/db/migrations' });
	const firstBeta = migrations.findIndex(migration => migration.sql.some(statement => statement.includes('CREATE TABLE `checklist_favorites`')));
	const snapshot = columns => snapshotUpgradeData(columns, path, join(directory, 'uploads'));
	const apply = migration => {
		for (const statement of migration.sql) db.exec(statement);
		db.prepare('INSERT INTO __drizzle_migrations(hash,created_at) VALUES (?,?)').run(migration.hash, migration.folderMillis);
	};
	try {
		assert(firstBeta > 0);
		db.exec('CREATE TABLE __drizzle_migrations (id INTEGER PRIMARY KEY, hash TEXT NOT NULL, created_at INTEGER)');
		for (const migration of migrations.slice(0, firstBeta)) apply(migration);
		db.exec(`
			INSERT INTO users (id,username,password_hash,settings,created_at,updated_at) VALUES
				('de','german','hash','{"lang":"de"}',1,1), ('en','english','hash','invalid-json',1,1);
			INSERT INTO lists (id,owner_id,name,created_at,updated_at) VALUES ('list','de','Groceries',1,1);
			INSERT INTO recipes (id,user_id,title,is_favorite,created_at,updated_at) VALUES
				('a','de','Soup',1,1,1), ('b','en','Pasta',1,1,1), ('c','de','Bread',0,1,1);
		`);
		const before = await snapshot();
		const columns = Object.fromEntries(Object.entries(before.tables).map(([name, table]) => [name, table.columns.map(column => column.name)]));
		const expected = expectedUpgrade(before, migrations);
		for (const migration of migrations.slice(firstBeta)) apply(migration);
		compareUpgradeData(before, await snapshot(columns), 'Beta upgrade', expected);
		for (const [sql, undo, message] of [
			["UPDATE lists SET kind='checklist'", "UPDATE lists SET kind='shopping'", /new columns contain unexpected data in lists/],
			["INSERT INTO checklist_favorites VALUES ('de','Bread',1)", 'DELETE FROM checklist_favorites', /unexpected row count in checklist_favorites/],
			["UPDATE recipe_categories SET name='Wrong' WHERE user_id='de'", "UPDATE recipe_categories SET name='Favoriten' WHERE user_id='de'", /unexpected contents in new table recipe_categories/],
			["UPDATE recipes SET category_id='legacy-favorites:en' WHERE id='a'", "UPDATE recipes SET category_id='legacy-favorites:de' WHERE id='a'", /unexpected migrated recipe category assignments/]
		]) {
			db.exec(sql);
			const after = await snapshot(columns);
			assert.throws(() => compareUpgradeData(before, after, 'Beta upgrade', expected), message);
			db.exec(undo);
		}
	} finally { db.close(); rmSync(directory, { recursive: true, force: true }); }
});
