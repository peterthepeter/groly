import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import { expect, it } from 'vitest';

it('moves existing favorites into account-specific categories and leaves ordinary recipes unassigned', () => {
	const sqlite = new Database(':memory:');
	try {
		sqlite.pragma('foreign_keys = ON');
		sqlite.exec(`
			CREATE TABLE users (id TEXT PRIMARY KEY, settings TEXT);
			CREATE TABLE recipes (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), is_favorite INTEGER NOT NULL);
			INSERT INTO users VALUES ('de', '{"lang":"de"}'), ('en', '{"lang":"en"}'), ('plain', 'invalid-json');
			INSERT INTO recipes VALUES ('de1','de',1), ('de2','de',1), ('en1','en',1), ('plain1','plain',0), ('de3','de',0);
		`);
		sqlite.exec(readFileSync(new URL('../db/migrations/0054_recipe_categories.sql', import.meta.url), 'utf8'));
		expect(sqlite.prepare('SELECT user_id, name FROM recipe_categories ORDER BY user_id').all()).toEqual([
			{ user_id: 'de', name: 'Favoriten' }, { user_id: 'en', name: 'Favorites' }
		]);
		expect(sqlite.prepare('SELECT id, category_id FROM recipes ORDER BY id').all()).toEqual([
			{ id: 'de1', category_id: 'legacy-favorites:de' },
			{ id: 'de2', category_id: 'legacy-favorites:de' },
			{ id: 'de3', category_id: null },
			{ id: 'en1', category_id: 'legacy-favorites:en' },
			{ id: 'plain1', category_id: null }
		]);
		sqlite.prepare("DELETE FROM recipe_categories WHERE user_id = 'de'").run();
		expect(sqlite.prepare("SELECT category_id FROM recipes WHERE id = 'de1'").get()).toEqual({ category_id: null });
	} finally {
		sqlite.close();
	}
});
