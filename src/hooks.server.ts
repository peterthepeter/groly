import { type Handle, json } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { bootstrapAdmin } from '$lib/auth';
import { runMigrations, db } from '$lib/db';
import { appMeta, barcodeCache, items, itemHistory, sessions, pushSubscriptions, users, mealPlanEntries, supplementLogs, supplementReminderSchedules, supplements } from '$lib/db/schema';
import { eq, lt, and, sql } from 'drizzle-orm';
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

	// Group by userId → one push per user containing all due supplements
	const byUser = new Map<string, { userId: string; names: Set<string>; lang: string }>();
	for (const m of matching) {
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
			const title = lang === 'en'
				? `Time to take ${nameList}!`
				: `Zeit für die Einnahme von ${nameList}!`;
			return sendPushToUser(userId, { title, body: '', url: '/supplements' });
		})
	);
}

async function init() {
	if (initialized) return;
	runMigrations();
	bootstrapAdmin();
	migrateItemHistory();
	await notifyOnNewVersion();
	cleanupBarcodeCache();
	cleanupOldData();
	setInterval(cleanupBarcodeCache, 24 * 60 * 60 * 1000);
	setInterval(cleanupOldData, 24 * 60 * 60 * 1000);
	setInterval(() => { checkSupplementReminders().catch(console.error); }, 60 * 1000);
	logMemoryUsage();
	setInterval(logMemoryUsage, 60 * 60 * 1000); // stündlich
	initialized = true;
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
