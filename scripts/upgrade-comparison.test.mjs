import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import Database from 'better-sqlite3';
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
	assert.equal(after.tables.user_invites.addedColumnsAreNull, true);
	assert.throws(() => compareUpgradeData(before, after, 'Strict restore'), /changed/);
	compareUpgradeData(before, before, 'Restore');
	compareUpgradeData(after, await snapshot(), 'Restart');
}));

for (const [name, mutation, message] of [
	['changed data', "UPDATE users SET name='Changed' WHERE id='a'", /existing data changed in users/],
	['lost rows', "DELETE FROM user_invites WHERE id='invite-a'", /row count changed/],
	['swapped relationships', "UPDATE user_invites SET user_id=CASE user_id WHEN 'a' THEN 'b' ELSE 'a' END", /existing data changed in user_invites/],
	['unexpected schema', 'ALTER TABLE users ADD unexpected TEXT', /unexpected schema/],
	['unexpected new data', "UPDATE user_invites SET token_value='unexpected'", /new nullable columns contain unexpected data/],
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
