import { bootstrapAdmin } from '$lib/auth';
import { runMigrations, db, sqlite } from '$lib/db';
import { appMeta, pushSubscriptions, users } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { LATEST_CHANGES } from '$lib/changelog';
import { sendPushToUser } from './pushNotifications';
import { subsSize } from './userEvents';
import { attemptsSize } from './loginRateLimit';
import { cleanupBarcodeCache, cleanupOldData } from './cleanup';
import { scheduleNextReminderCheck } from './reminders';

let initialized = false;

function migrateItemHistory() {
	const done = db.select().from(appMeta).where(eq(appMeta.key, 'item_history_migrated')).get();
	if (done) return;

	db.run(sql`
		INSERT OR IGNORE INTO item_history (user_id, name, use_count, last_used_at)
		SELECT l.owner_id, i.name, COUNT(*) AS use_count, MAX(i.updated_at) AS last_used_at
		FROM items i
		JOIN lists l ON i.list_id = l.id
		GROUP BY l.owner_id, i.name
	`);

	db.insert(appMeta).values({ key: 'item_history_migrated', value: '1' }).run();
}

function ensureSupplementLogNoteColumn() {
	// Migration 0031 was silently skipped on prod DBs because its journal `when`-timestamp
	// is smaller than 0030's. Drizzle only applies a migration when its folderMillis is
	// greater than the latest applied one. PRAGMA + ALTER is idempotent and safe both for
	// affected prod DBs and fresh installs where 0031 already ran.
	const cols = sqlite.prepare(`PRAGMA table_info(supplement_logs)`).all() as Array<{ name: string }>;
	if (!cols.some((c) => c.name === 'note')) {
		sqlite.exec(`ALTER TABLE supplement_logs ADD COLUMN note text`);
	}
}

function bootstrapCaffeineTables() {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS caffeine_drinks (
			id TEXT PRIMARY KEY,
			name TEXT NOT NULL,
			default_ml INTEGER NOT NULL,
			caffeine_mg INTEGER NOT NULL,
			sort_order INTEGER NOT NULL DEFAULT 0,
			created_at INTEGER NOT NULL
		);
		CREATE TABLE IF NOT EXISTS caffeine_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			drink_name TEXT NOT NULL,
			amount_ml INTEGER NOT NULL,
			caffeine_mg INTEGER NOT NULL,
			logged_at INTEGER NOT NULL,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS caffeine_logs_user_id_idx ON caffeine_logs(user_id);
		CREATE INDEX IF NOT EXISTS caffeine_logs_logged_at_idx ON caffeine_logs(logged_at);
		DELETE FROM caffeine_drinks WHERE id IN (
			'espresso','doppelter-espresso','filterkaffee','cappuccino',
			'latte-macchiato','cold-brew','schwarztee','gruentee','energy-drink','cola'
		);
		UPDATE caffeine_drinks SET default_ml = 35 WHERE id = 'cd-espresso' AND default_ml = 30;
		UPDATE caffeine_drinks SET name = 'Double Espresso' WHERE id = 'cd-doppelter-espresso' AND name = 'Doppelter Espresso';
		UPDATE caffeine_drinks SET name = 'Filter Coffee'  WHERE id = 'cd-filterkaffee'       AND name = 'Filterkaffee';
		UPDATE caffeine_drinks SET name = 'Black Tea'      WHERE id = 'cd-schwarztee'         AND name = 'Schwarztee';
		UPDATE caffeine_drinks SET name = 'Green Tea'      WHERE id = 'cd-gruentee'           AND (name = 'Grüntee' OR name = 'Gruntee');
		INSERT OR IGNORE INTO caffeine_drinks (id, name, default_ml, caffeine_mg, sort_order, created_at) VALUES
			('cd-espresso',           'Espresso',       35,  63, 0, 0),
			('cd-doppelter-espresso', 'Double Espresso', 60, 126, 1, 0),
			('cd-filterkaffee',       'Filter Coffee',  200,  90, 2, 0),
			('cd-cappuccino',         'Cappuccino',     200,  63, 3, 0),
			('cd-latte-macchiato',    'Latte Macchiato',300,  63, 4, 0),
			('cd-cold-brew',          'Cold Brew',      250, 200, 5, 0),
			('cd-schwarztee',         'Black Tea',      200,  45, 6, 0),
			('cd-gruentee',           'Green Tea',      200,  30, 7, 0),
			('cd-energy-drink',       'Energy Drink',   250,  80, 8, 0),
			('cd-cola',               'Cola',           330,  35, 9, 0);
	`);
}

function bootstrapMoodTables() {
	sqlite.exec(`
		CREATE TABLE IF NOT EXISTS mood_logs (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			date TEXT NOT NULL,
			mood INTEGER NOT NULL,
			activities TEXT,
			note TEXT,
			created_at INTEGER NOT NULL,
			updated_at INTEGER NOT NULL
		);
		CREATE UNIQUE INDEX IF NOT EXISTS mood_logs_user_date_unique ON mood_logs(user_id, date);
		CREATE INDEX IF NOT EXISTS mood_logs_user_id_idx ON mood_logs(user_id);
		CREATE TABLE IF NOT EXISTS mood_custom_tags (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			key TEXT NOT NULL,
			label TEXT NOT NULL,
			category TEXT NOT NULL,
			emoji TEXT,
			sort_order INTEGER NOT NULL DEFAULT 0,
			active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS mood_custom_tags_user_id_idx ON mood_custom_tags(user_id);
		CREATE TABLE IF NOT EXISTS mood_reminder_schedules (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
			days TEXT NOT NULL,
			time TEXT NOT NULL,
			only_if_not_rated INTEGER NOT NULL DEFAULT 1,
			active INTEGER NOT NULL DEFAULT 1,
			created_at INTEGER NOT NULL
		);
		CREATE INDEX IF NOT EXISTS mood_reminder_schedules_user_id_idx ON mood_reminder_schedules(user_id);
	`);
}

function logMemoryUsage() {
	const m = process.memoryUsage();
	const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
	console.log(
		`[groly:mem] rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB ext=${mb(m.external)}MB sse=${subsSize()} ratelimit=${attemptsSize()}`
	);
}

async function notifyOnNewVersion() {
	const currentVersion = LATEST_CHANGES.version;
	const row = db.select().from(appMeta).where(eq(appMeta.key, 'last_push_version')).get();
	if (row?.value === currentVersion) return;

	const makePayload = (lang: 'de' | 'en') => {
		const changes = lang === 'en' ? LATEST_CHANGES.en : LATEST_CHANGES.de;
		const title = lang === 'en' ? `Groly ${currentVersion} is here!` : `Groly ${currentVersion} ist da!`;
		const body = changes.join(' · ');
		return { title, body: body.length > 120 ? body.slice(0, 117) + '…' : body };
	};

	// Get distinct users with push subscriptions + their stored language preference
	const usersWithSubs = db
		.selectDistinct({ userId: pushSubscriptions.userId, settings: users.settings })
		.from(pushSubscriptions)
		.innerJoin(users, eq(pushSubscriptions.userId, users.id))
		.all();

	await Promise.allSettled(
		usersWithSubs.map(({ userId, settings }) => {
			let lang: 'de' | 'en' = 'de';
			try {
				if (settings && JSON.parse(settings)?.lang === 'en') lang = 'en';
			} catch { /* use default */ }
			return sendPushToUser(userId, makePayload(lang));
		})
	);

	db.insert(appMeta)
		.values({ key: 'last_push_version', value: currentVersion })
		.onConflictDoUpdate({ target: appMeta.key, set: { value: currentVersion } })
		.run();
}

export async function init() {
	if (initialized) return;
	initialized = true; // set synchronously before any await to prevent concurrent init
	runMigrations();
	ensureSupplementLogNoteColumn();
	bootstrapAdmin();
	migrateItemHistory();
	bootstrapCaffeineTables();
	bootstrapMoodTables();
	await notifyOnNewVersion();
	cleanupBarcodeCache();
	cleanupOldData();
	setInterval(cleanupBarcodeCache, 24 * 60 * 60 * 1000);
	setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
	scheduleNextReminderCheck();
	logMemoryUsage();
	setInterval(logMemoryUsage, 60 * 60 * 1000); // stündlich
}
