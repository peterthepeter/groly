#!/usr/bin/env node
// Local preview only: add 30 days of identifiable, repeatable tracker examples.
// Existing entries, settings, schedules and supplement stock remain untouched.
// Usage: node scripts/seed-tracker-preview.mjs --user admin --date 2026-10-21
import Database from 'better-sqlite3';
import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { parseArgs } from 'node:util';

process.env.TZ = 'Europe/Berlin';
const { values } = parseArgs({ options: {
	database: { type: 'string', default: './data/groly.db' },
	user: { type: 'string', default: 'admin' },
	date: { type: 'string' }
} });
const today = values.date ? new Date(`${values.date}T12:00:00`) : new Date();
if (Number.isNaN(today.getTime())) throw new Error('Invalid preview date');
today.setHours(12, 0, 0, 0);
const dbPath = resolve(values.database);
const db = new Database(dbPath, { fileMustExist: true });
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

try {
	const user = db.prepare('SELECT id FROM users WHERE username = ?').get(values.user);
	if (!user) throw new Error(`User '${values.user}' not found`);
	const supplements = db.prepare('SELECT id, default_amount FROM supplements WHERE user_id = ? AND active = 1 ORDER BY name').all(user.id);
	const prefix = `tracker-preview:${user.id}:`;
	const now = Date.now();
	const counts = {};
	const statements = new Map();
	function insert(table, key, row) {
		const record = { id: `${prefix}${key}`, ...row };
		if (!statements.has(table)) {
			const columns = Object.keys(record);
			statements.set(table, db.prepare(`INSERT OR IGNORE INTO ${table} (${columns.join(',')}) VALUES (${columns.map(c => `@${c}`).join(',')})`));
		}
		const result = statements.get(table).run(record);
		counts[table] = (counts[table] ?? 0) + result.changes;
	}

	// SQLite's backup API includes WAL contents and leaves a recoverable snapshot.
	const backupDir = join(dirname(dbPath), 'backups');
	await mkdir(backupDir, { recursive: true });
	const backup = join(backupDir, `before-tracker-preview-${now}.db`);
	await db.backup(backup);

	db.transaction(() => {
		for (let ago = 29; ago >= 0; ago--) {
			const day = new Date(today);
			day.setDate(day.getDate() - ago);
			const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
			const time = (hour, minute = 0) => {
				const stamp = new Date(day);
				stamp.setHours(hour, minute, 0, 0);
				return stamp.getTime();
			};
			const isPast = stamp => stamp <= now;
			const common = { user_id: user.id, created_at: now };
			// Deliberately sparse days exercise missing sections in the history.
			if (ago === 13 || ago === 20) continue;
			supplements.forEach((supp, index) => {
				if (ago !== 0 && (ago + index) % 6 === 0) return;
				const stamp = time(index % 2 ? 8 : 9, index * 5);
				if (!isPast(stamp)) return;
				insert('supplement_logs', `${date}:supp:${supp.id}`, {
					...common, supplement_id: supp.id, amount: supp.default_amount,
					logged_at: stamp, note: 'Testdaten · Tracker-Vorschau',
					client_log_id: `${prefix}${date}:supp:${supp.id}`, stock_deducted: 0
				});
			});
			if (ago === 6) continue;
			for (let i = 0; i < 6; i++) {
				const stamp = time(7 + i * 2, 15);
				if (isPast(stamp)) insert('water_logs', `${date}:water:${i}`, {
					...common, amount_ml: [250, 300, 400][(ago + i) % 3], logged_at: stamp
				});
			}
			for (let i = 0; i < (ago % 3 === 0 ? 1 : 2); i++) {
				const stamp = time(8 + i * 5, 30);
				if (isPast(stamp)) insert('caffeine_logs', `${date}:caffeine:${i}`, {
					...common, drink_name: i ? 'Grüner Tee · Testdaten' : 'Cappuccino · Testdaten',
					amount_ml: i ? 250 : 180, caffeine_mg: i ? 30 : 75, logged_at: stamp
				});
			}
			if (ago % 3 !== 1 && isPast(time(7, 30))) insert('meditation_logs', `${date}:meditation`, {
				...common, duration_seconds: [600, 900, 1200][ago % 3], logged_at: time(7, 30)
			});
			// Preserve the user's existing single mood entry for each date.
			if (ago % 7 !== 4) insert('mood_logs', `${date}:mood`, {
				...common, date, mood: [4, 3, 5, 4, 2][ago % 5], energy: [4, 3, 5, 3][ago % 4],
				activities: JSON.stringify(['walk', 'cooking']), note: 'Testdaten · Spaziergang und entspannt gekocht.',
				gratitude: ago % 3 === 0 ? 'Testdaten · Zeit mit der Familie' : null, updated_at: now
			});
			const mealExamples = [
				{ name: 'Frühstück', hour: 8, food: 'Haferflocken mit Joghurt und Beeren', grams: 320, kcal: 420, protein: 24, fat: 12, carbs: 51, fiber: 9 },
				{ name: 'Mittagessen', hour: 12, food: 'Reis mit Gemüse und Tofu', grams: 450, kcal: 620, protein: 30, fat: 20, carbs: 80, fiber: 12 },
				{ name: 'Abendessen', hour: 18, food: 'Vollkornbrot mit Hüttenkäse', grams: 280, kcal: 480, protein: 28, fat: 14, carbs: 59, fiber: 8 }
			];
			for (const [i, meal] of mealExamples.entries()) {
				if (!isPast(time(meal.hour))) continue;
				const key = `${date}:meal:${i}`;
				insert('meals', key, { ...common, name: `${meal.name} · Testdaten`, date, time: `${meal.hour.toString().padStart(2, '0')}:00`, updated_at: now });
				const factor = 1 + (ago % 5 - 2) * 0.05;
				const totals = Object.fromEntries(['kcal', 'protein', 'fat', 'carbs', 'fiber'].map(k => [k, Math.round(meal[k] * factor)]));
				const per100 = Object.fromEntries(Object.entries(totals).map(([key, value]) => [`${key}_per_100`, value / meal.grams * 100]));
				insert('meal_components', `${key}:food`, { meal_id: `${prefix}${key}`, display_name: meal.food, custom_name: meal.food, amount: meal.grams, unit: 'g', ...totals, ...per100 });
			}
		}
	})();
	console.log(JSON.stringify({ database: dbPath, user: values.user, backup, added: counts }, null, 2));
} finally {
	db.close();
}
