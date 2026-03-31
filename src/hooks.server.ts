import { type Handle, json } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { bootstrapAdmin } from '$lib/auth';
import { runMigrations, db } from '$lib/db';
import { appMeta } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { LATEST_CHANGES } from '$lib/changelog';
import { sendPushToAllSubscribers } from '$lib/server/pushNotifications';

let initialized = false;

async function init() {
	if (initialized) return;
	initialized = true;
	runMigrations();
	bootstrapAdmin();
	await notifyOnNewVersion();
}

async function notifyOnNewVersion() {
	const currentVersion = LATEST_CHANGES.version;
	const row = db.select().from(appMeta).where(eq(appMeta.key, 'last_push_version')).get();
	if (row?.value === currentVersion) return;

	const body = LATEST_CHANGES.de.join(' · ');
	await sendPushToAllSubscribers({
		title: `Groly ${currentVersion} ist da!`,
		body: body.length > 120 ? body.slice(0, 117) + '…' : body
	});

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
