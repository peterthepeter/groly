import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getSession } from '#lib/auth';
import { init, startupStatus } from '#lib/server/startup';
import { applySecurityHeaders } from '#lib/server/security';
import { languageFromAcceptLanguage } from '#lib/language';
import { withRequestLocale } from '#lib/server/requestLocale';

export const handle: Handle = async ({ event, resolve }) => {
	const initialization = init();
	if (event.url.pathname === '/api/health') {
		void initialization.catch(() => {});
		const status = startupStatus();
		return Response.json({ status }, { status: status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
	}
	try { await initialization; }
	catch { return Response.json({ error: 'Startup unavailable; check container logs' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }); }

	const sessionId = event.cookies.get('session');
	const user = sessionId ? getSession(sessionId) : null;

	event.locals.user = user ?? undefined;

	const path = event.url.pathname;
	const isAuthRoute = path.startsWith('/login');
	const isInviteRoute = path.startsWith('/invite/');
	const isApiRoute = path.startsWith('/api');

	if (!isApiRoute && !isAuthRoute && !isInviteRoute && !user) {
		redirect(302, '/login');
	}

	if (isAuthRoute && user) {
		redirect(302, '/');
	}

	const anonymousLang = !user && (isAuthRoute || isInviteRoute)
		? languageFromAcceptLanguage(event.request.headers.get('accept-language'))
		: null;
	let locale = anonymousLang ?? 'de';
	try {
		const settings = user?.settings ? JSON.parse(user.settings) : null;
		if (settings?.lang === 'en') locale = 'en';
	} catch { /* Invalid legacy settings use the existing German default. */ }
	const response = await withRequestLocale(locale, event.url.origin, () => resolve(event, {
		transformPageChunk: ({ html }) => html.replace('<html lang="de">', `<html lang="${locale}">`)
	}));
	applySecurityHeaders(response);
	// API-Antworten nie cachen: die URLs (z.B. /api/supplement-logs?from=…&to=…) sind
	// über den Tag identisch. Ohne no-store beantwortet iOS Safari sie nach langem
	// Standby aus dem eigenen HTTP-Cache statt neu zu laden → frisch geloggte Einträge
	// erscheinen nicht (überlebt sogar App-Neustart). no-store erzwingt echten Abgleich.
	if (isApiRoute) response.headers.set('Cache-Control', 'no-store');
	return response;
};
