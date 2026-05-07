import { type Handle, json } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { bootstrapAdmin } from '$lib/auth';
import { runMigrations, db, sqlite } from '$lib/db';
import { appMeta, barcodeCache, items, itemHistory, sessions, pushSubscriptions, users, mealPlanEntries, supplementLogs, supplementReminderSchedules, supplements, waterReminderSchedules, waterLogs, meditationReminderSchedules, meditationLogs } from '$lib/db/schema';
import { eq, lt, and, gte, sql } from 'drizzle-orm';
import { LATEST_CHANGES } from '$lib/changelog';
import { sendPushToUser } from '$lib/server/pushNotifications';
import { subsSize } from '$lib/server/userEvents';
import { attemptsSize } from '$lib/server/loginRateLimit';

let initialized = false;

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TWO_MONTHS_S = 60 * 24 * 60 * 60;
const SIX_MONTHS_S = 6 * 30 * 24 * 60 * 60;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function cleanupBarcodeCache() {
	db.delete(barcodeCache).where(lt(barcodeCache.lastSeenAt, Date.now() - SIX_MONTHS_MS)).run();
}

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

function cleanupOldData() {
	const nowS = Math.floor(Date.now() / 1000);
	// Abgehakte Items löschen, die älter als 60 Tage sind
	db.delete(items).where(and(eq(items.isChecked, true), lt(items.checkedAt, nowS - TWO_MONTHS_S))).run();
	// Vorschläge löschen, die seit mehr als 6 Monaten nicht genutzt wurden
	db.delete(itemHistory).where(lt(itemHistory.lastUsedAt, nowS - SIX_MONTHS_S)).run();
	// Supplement-Logs älter als 2 Jahre löschen
	db.delete(supplementLogs).where(lt(supplementLogs.loggedAt, Date.now() - TWO_YEARS_MS)).run();
	// Abgelaufene Sessions löschen
	db.delete(sessions).where(lt(sessions.expiresAt, nowS)).run();
	// Wochenplan-Einträge löschen, die älter als 6 Monate sind
	const sixMonthsAgoDate = new Date(Date.now() - SIX_MONTHS_MS);
	const cutoffDate = sixMonthsAgoDate.toISOString().slice(0, 10);
	db.delete(mealPlanEntries).where(lt(mealPlanEntries.date, cutoffDate)).run();
}

function logMemoryUsage() {
	const m = process.memoryUsage();
	const mb = (bytes: number) => (bytes / 1024 / 1024).toFixed(2);
	console.log(
		`[groly:mem] rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}/${mb(m.heapTotal)}MB ext=${mb(m.external)}MB sse=${subsSize()} ratelimit=${attemptsSize()}`
	);
}

async function checkSupplementReminders() {
	const now = new Date();
	const currentDay = now.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	// Load all active schedules with supplement name, userId and user language
	const activeSchedules = db
		.select({
			id: supplementReminderSchedules.id,
			days: supplementReminderSchedules.days,
			time: supplementReminderSchedules.time,
			supplementName: supplements.name,
			userId: supplements.userId,
			userSettings: users.settings
		})
		.from(supplementReminderSchedules)
		.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
		.innerJoin(users, eq(supplements.userId, users.id))
		.where(eq(supplementReminderSchedules.active, true))
		.all();

	// Filter to those matching current day + time
	const matching = activeSchedules.filter(s => {
		try {
			const days: number[] = JSON.parse(s.days);
			return days.includes(currentDay) && s.time === currentTime;
		} catch {
			return false;
		}
	});

	if (matching.length === 0) return;

	const PRE_WINDOW_MS = 30 * 60 * 1000;
	const windowStart = now.getTime() - PRE_WINDOW_MS;

	// Group by userId → one push per user containing all due supplements
	const byUser = new Map<string, { userId: string; names: Set<string>; lang: string }>();
	for (const m of matching) {
		// Skip if supplement was already logged within the pre-window
		const alreadyLogged = db
			.select({ id: supplementLogs.id })
			.from(supplementLogs)
			.innerJoin(supplements, eq(supplementLogs.supplementId, supplements.id))
			.where(and(
				eq(supplements.name, m.supplementName),
				eq(supplementLogs.userId, m.userId),
				gte(supplementLogs.loggedAt, windowStart)
			))
			.get();
		if (alreadyLogged) continue;

		if (!byUser.has(m.userId)) {
			let lang = 'de';
			try { if (m.userSettings && JSON.parse(m.userSettings)?.lang === 'en') lang = 'en'; } catch { /* use default */ }
			byUser.set(m.userId, { userId: m.userId, names: new Set(), lang });
		}
		byUser.get(m.userId)!.names.add(m.supplementName);
	}

	await Promise.allSettled(
		Array.from(byUser.values()).map(({ userId, names, lang }) => {
			const list = Array.from(names);
			const nameList = list.length === 1
				? list[0]
				: `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
			const title = lang === 'en' ? 'Supplement Reminder' : 'Supplement-Erinnerung';
			const body = lang === 'en' ? `Time to take: ${nameList}` : `Zeit für die Einnahme von: ${nameList}`;
			return sendPushToUser(userId, { title, body, url: '/supplements', tag: 'supplement-reminder' });
		})
	);
}

async function checkWaterReminders() {
	const now = new Date();
	const currentDay = now.getDay();
	const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

	const activeSchedules = db
		.select({
			days: waterReminderSchedules.days,
			startTime: waterReminderSchedules.startTime,
			endTime: waterReminderSchedules.endTime,
			intervalMinutes: waterReminderSchedules.intervalMinutes,
			userId: waterReminderSchedules.userId,
			userSettings: users.settings
		})
		.from(waterReminderSchedules)
		.innerJoin(users, eq(waterReminderSchedules.userId, users.id))
		.where(eq(waterReminderSchedules.active, true))
		.all();

	// Collect users whose schedule fires right now
	const usersToNotify = new Map<string, { intervalMinutes: number; settings: Record<string, unknown> }>();

	for (const s of activeSchedules) {
		try {
			const days: number[] = JSON.parse(s.days);
			if (!days.includes(currentDay)) continue;

			const settings = s.userSettings ? JSON.parse(s.userSettings) : {};
			if (!settings?.waterTrackerEnabled) continue;

			const [startH, startM] = s.startTime.split(':').map(Number);
			const [endH, endM] = s.endTime.split(':').map(Number);
			const startTotal = startH * 60 + startM;
			const endTotal = endH * 60 + endM;

			if (currentTotalMinutes < startTotal || currentTotalMinutes > endTotal) continue;

			// Only fire at exact interval slots (elapsed since window start)
			const elapsed = currentTotalMinutes - startTotal;
			if (elapsed % s.intervalMinutes !== 0) continue;

			// Keep the shortest interval if a user has multiple matching schedules
			const existing = usersToNotify.get(s.userId);
			if (!existing || s.intervalMinutes < existing.intervalMinutes) {
				usersToNotify.set(s.userId, { intervalMinutes: s.intervalMinutes, settings });
			}
		} catch { /* skip invalid schedule */ }
	}

	if (usersToNotify.size === 0) return;

	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	await Promise.allSettled(
		Array.from(usersToNotify.entries()).map(async ([userId, { intervalMinutes, settings }]) => {
			const goalMl: number = (settings?.waterGoalMl as number) ?? 2000;

			// Skip if daily goal already reached
			const totalRow = db
				.select({ total: sql<number>`COALESCE(SUM(amount_ml), 0)` })
				.from(waterLogs)
				.where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, todayStart)))
				.get();
			if ((totalRow?.total ?? 0) >= goalMl) return;

			// Skip if logged within the last interval
			const intervalMs = intervalMinutes * 60 * 1000;
			const recentLog = db
				.select({ id: waterLogs.id })
				.from(waterLogs)
				.where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, Date.now() - intervalMs)))
				.get();
			if (recentLog) return;

			const lang = settings?.lang === 'en' ? 'en' : 'de';
			const title = lang === 'en' ? 'Hydration Tracker' : 'Wassertracker';
			const body = lang === 'en' ? 'Time for a glass of water (250 ml)' : 'Zeit für ein Glas Wasser (250 ml)';
			return sendPushToUser(userId, { title, body, url: '/supplements', tag: 'water-reminder' });
		})
	);
}

async function checkMeditationReminders() {
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

	const activeSchedules = db
		.select({
			time: meditationReminderSchedules.time,
			onlyIfNotMeditated: meditationReminderSchedules.onlyIfNotMeditated,
			userId: meditationReminderSchedules.userId,
			userSettings: users.settings
		})
		.from(meditationReminderSchedules)
		.innerJoin(users, eq(meditationReminderSchedules.userId, users.id))
		.where(eq(meditationReminderSchedules.active, true))
		.all();

	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	await Promise.allSettled(
		activeSchedules.map(async (s) => {
			try {
				if (s.time !== currentTime) return;
				const settings = s.userSettings ? JSON.parse(s.userSettings) : {};
				if (!settings?.meditationTrackerEnabled) return;

				if (s.onlyIfNotMeditated) {
					const existing = db
						.select({ id: meditationLogs.id })
						.from(meditationLogs)
						.where(and(eq(meditationLogs.userId, s.userId), gte(meditationLogs.loggedAt, todayStart)))
						.get();
					if (existing) return;
				}

				const lang = settings?.lang === 'en' ? 'en' : 'de';
				const title = lang === 'en' ? 'Meditation' : 'Meditation';
				const body = lang === 'en' ? 'Time for your daily meditation' : 'Zeit für deine tägliche Meditation';
				return sendPushToUser(s.userId, { title, body, url: '/supplements', tag: 'meditation-reminder' });
			} catch { /* skip invalid */ }
		})
	);
}

async function init() {
	if (initialized) return;
	initialized = true; // set synchronously before any await to prevent concurrent init
	runMigrations();
	ensureSupplementLogNoteColumn();
	bootstrapAdmin();
	migrateItemHistory();
	bootstrapCaffeineTables();
	await notifyOnNewVersion();
	cleanupBarcodeCache();
	cleanupOldData();
	setInterval(cleanupBarcodeCache, 24 * 60 * 60 * 1000);
	setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
	function scheduleNextReminderCheck() {
		const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
		setTimeout(async () => {
			await Promise.allSettled([
				checkSupplementReminders().catch(console.error),
				checkWaterReminders().catch(console.error),
				checkMeditationReminders().catch(console.error)
			]);
			scheduleNextReminderCheck();
		}, msUntilNextMinute);
	}
	scheduleNextReminderCheck();
	logMemoryUsage();
	setInterval(logMemoryUsage, 60 * 60 * 1000); // stündlich
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

const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
};

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com",
	"img-src 'self' data: https:",
	"connect-src 'self'",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	"frame-ancestors 'none'"
].join('; ');

// API-Endpoints die trotz mustChangePassword erlaubt sind
const ALLOWED_WHILE_MUST_CHANGE = ['/api/auth/logout', '/api/users/me', '/api/auth/me'];

export const handle: Handle = async ({ event, resolve }) => {
	await init();

	const sessionId = event.cookies.get('session');
	const user = sessionId ? getSession(sessionId) : null;

	event.locals.user = user ?? undefined;

	const path = event.url.pathname;
	const isAuthRoute = path.startsWith('/login');
	const isApiRoute = path.startsWith('/api');

	if (!isApiRoute && !isAuthRoute && !user) {
		redirect(302, '/login');
	}

	if (isAuthRoute && user) {
		redirect(302, '/');
	}

	// mustChangePassword server-seitig erzwingen
	if (user?.mustChangePassword) {
		if (isApiRoute && !ALLOWED_WHILE_MUST_CHANGE.some(a => path.startsWith(a))) {
			return json({ error: 'mustChangePassword' }, { status: 403 });
		}
		if (!isApiRoute && !path.startsWith('/einstellungen') && !isAuthRoute) {
			redirect(302, '/einstellungen?mustChange=1');
		}
	}

	const response = await resolve(event);

	// Security Headers auf alle Responses
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}

	// CSP nur auf HTML-Responses
	if (response.headers.get('content-type')?.includes('text/html')) {
		response.headers.set('Content-Security-Policy', CSP);
	}

	return response;
};
