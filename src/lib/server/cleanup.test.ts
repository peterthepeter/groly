import { afterEach, beforeEach, expect, it, vi } from 'vitest';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/db/schema');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './src/lib/db/migrations' });
	return { db };
});

import { db } from '#lib/db';
import { items, lists, sessions, users } from '#lib/db/schema';
import { cleanupOldData } from './cleanup';

beforeEach(() => {
	const now = Math.floor(Date.now() / 1000);
	const day = 24 * 60 * 60;
	const timestamps = { createdAt: now - 90 * day, updatedAt: now - 90 * day };
	db.delete(users).run();
	db.insert(users).values({ id: 'owner', username: 'owner', passwordHash: 'fixture', ...timestamps }).run();
	db.insert(lists).values([
		{ id: 'list-a', name: 'List A', ownerId: 'owner', ...timestamps },
		{ id: 'list-b', name: 'List B', ownerId: 'owner', ...timestamps },
		{ id: 'trip', name: 'Trip', ownerId: 'owner', kind: 'checklist', ...timestamps }
	]).run();
	db.insert(items).values([
		{ id: 'old-a', listId: 'list-a', name: 'Milk', isChecked: true, checkedAt: now - 61 * day, ...timestamps },
		{ id: 'old-b', listId: 'list-b', name: 'Bread', isChecked: true, checkedAt: now - 61 * day, ...timestamps },
		{ id: 'recent', listId: 'list-a', name: 'Apples', isChecked: true, checkedAt: now - 59 * day, ...timestamps },
		{ id: 'open', listId: 'list-b', name: 'Rice', ...timestamps },
		{ id: 'trip-old', listId: 'trip', name: 'Passport', isChecked: true, checkedAt: now - 89 * day, ...timestamps }
	]).run();
	db.insert(sessions).values({ id: 'expired', userId: 'owner', expiresAt: now - day, createdAt: timestamps.createdAt }).run();
});

afterEach(() => vi.unstubAllEnvs());

it.each([undefined, 'false'])('prunes checked items older than 60 days with KEEP_CHECKED_ITEMS=%s', value => {
	vi.stubEnv('KEEP_CHECKED_ITEMS', value);
	cleanupOldData();
	expect(db.select({ id: items.id }).from(items).orderBy(items.id).all()).toEqual([{ id: 'open' }, { id: 'recent' }, { id: 'trip-old' }]);
});

it('retains checked items across lists without skipping expired-session cleanup', () => {
	vi.stubEnv('KEEP_CHECKED_ITEMS', 'true');
	cleanupOldData();
	expect(db.select({ id: items.id }).from(items).orderBy(items.id).all()).toEqual([
		{ id: 'old-a' }, { id: 'old-b' }, { id: 'open' }, { id: 'recent' }, { id: 'trip-old' }
	]);
	expect(db.select().from(sessions).all()).toEqual([]);
});
