import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as schema from '#lib/db/schema';
import { persistItemCreate } from '#lib/server/itemCreate';
import { queryItemSuggestions } from '#lib/server/itemSuggestions';

type AppDatabase = typeof import('#lib/db').db;

let sqlite: Database.Database | null = null;

function createDatabase(): AppDatabase {
	sqlite = new Database(':memory:');
	sqlite.exec(`
		CREATE TABLE lists (id TEXT PRIMARY KEY NOT NULL, updated_at INTEGER NOT NULL);
		CREATE TABLE items (
			id TEXT PRIMARY KEY NOT NULL,
			list_id TEXT NOT NULL,
			name TEXT NOT NULL,
			quantity_info TEXT,
			is_checked INTEGER DEFAULT 0 NOT NULL,
			checked_at INTEGER,
			category_override TEXT,
			created_by TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE TABLE item_history (
			user_id TEXT NOT NULL,
			name TEXT NOT NULL,
			use_count INTEGER DEFAULT 1 NOT NULL,
			last_used_at INTEGER NOT NULL,
			PRIMARY KEY (user_id, name)
		);
		INSERT INTO lists (id, updated_at) VALUES ('list-1', 1);
	`);
	return drizzle(sqlite, { schema }) as AppDatabase;
}

afterEach(() => {
	sqlite?.close();
	sqlite = null;
	vi.useRealTimers();
});

describe('item creation persistence', () => {
	it('treats a repeated client ID as success without duplicating item history', () => {
		const database = createDatabase();
		const input = {
			id: 'client-item-1',
			listId: 'list-1',
			name: 'Hafermilch',
			quantityInfo: '2',
			categoryOverride: null,
			createdBy: 'user-1',
			createdAt: 100,
			updatedAt: 100
		};

		expect(persistItemCreate(database, input).inserted).toBe(true);
		expect(persistItemCreate(database, { ...input, createdAt: 200, updatedAt: 200 }).inserted).toBe(false);

		const itemCount = sqlite!.prepare('SELECT COUNT(*) AS count FROM items').get() as { count: number };
		const history = sqlite!.prepare('SELECT use_count AS useCount, last_used_at AS lastUsedAt FROM item_history').get() as { useCount: number; lastUsedAt: number };
		const list = sqlite!.prepare('SELECT updated_at AS updatedAt FROM lists WHERE id = ?').get('list-1') as { updatedAt: number };
		expect(itemCount.count).toBe(1);
		expect(history).toEqual({ useCount: 1, lastUsedAt: 100 });
		expect(list.updatedAt).toBe(100);
	});
});

describe('item suggestion queries', () => {
	it('searches beyond the frequent selection, includes exact matches, and isolates users', () => {
		const database = createDatabase();
		const insert = sqlite!.prepare('INSERT INTO item_history (user_id, name, use_count, last_used_at) VALUES (?, ?, ?, ?)');
		for (let index = 0; index < 35; index++) {
			insert.run('user-1', `Alter Artikel ${index}`, 10, 100 + index);
		}
		insert.run('user-1', 'Neue Hafermilch', 1, 1_000);
		insert.run('user-2', 'Private Hafermilch', 99, 2_000);

		expect(queryItemSuggestions(database, 'user-1', '', 30)).not.toContain('Neue Hafermilch');
		expect(queryItemSuggestions(database, 'user-1', 'hafer', 5)).toEqual(['Neue Hafermilch']);
		expect(queryItemSuggestions(database, 'user-1', 'Neue Hafermilch', 5)).toEqual(['Neue Hafermilch']);
	});

	it('balances frequency with recency and puts exact and prefix matches first', () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
		const database = createDatabase();
		const now = Math.floor(Date.now() / 1000);
		const day = 86400;
		const insert = sqlite!.prepare('INSERT INTO item_history (user_id, name, use_count, last_used_at) VALUES (?, ?, ?, ?)');
		insert.run('user-1', 'Milch', 10, now - day);
		insert.run('user-1', 'Brot', 3, now - day);
		insert.run('user-1', 'Einmaliger Einkauf', 1, now);
		insert.run('user-1', 'Frühere Gewohnheit', 10, now - 180 * day);
		insert.run('user-1', 'Milchreis', 30, now);
		insert.run('user-1', 'Hafermilch', 50, now);
		expect(queryItemSuggestions(database, 'user-1', '', 6)).toEqual([
			'Hafermilch', 'Milchreis', 'Milch', 'Brot', 'Frühere Gewohnheit', 'Einmaliger Einkauf'
		]);
		expect(queryItemSuggestions(database, 'user-1', 'milch', 3)).toEqual(['Milch', 'Milchreis', 'Hafermilch']);
	});
});
