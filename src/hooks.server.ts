import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit/hooks';
import { getSession } from '#lib/auth';
import { init, startupStatus } from '#lib/server/startup';
import { applySecurityHeaders } from '#lib/server/security';
import { languageFromAcceptLanguage } from '#lib/language';
import { withRequestLocale } from '#lib/server/requestLocale';
import { APP_ICON_COOKIE, appIconAssets, isAppIcon, isIconInstallPage } from '#lib/appIcon';

export const handle: Handle = async ({ event, resolve }) => {
	const initialization = init();
	if (event.url.pathname === '/api/health') {
		void initialization.catch(() => {});
		const status = startupStatus();
		return Response.json({ status }, { status: status === 'ready' ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
	}
	try { await initialization; }
	catch { return Response.json({ error: 'Startup unavailable; check container logs' }, { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }); }

	// The installed start URL carries the variant even after a manual reinstall.
	// This preference grants no access and is independent of account settings.
	const startupIcon = event.url.pathname === '/' ? event.url.searchParams.get('app-icon') : null;
	if (isAppIcon(startupIcon)) {
		event.cookies.set(APP_ICON_COOKIE, startupIcon, { path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365 * 5 });
	}
	const savedIcon = event.cookies.get(APP_ICON_COOKIE);
	const icon = appIconAssets(isAppIcon(savedIcon) ? savedIcon : 'dark');

	const sessionId = event.cookies.get('session');
	const user = sessionId ? getSession(sessionId) : null;

	event.locals.user = user ?? undefined;

	const path = event.url.pathname;
	const isAuthRoute = path.startsWith('/login');
	const isInviteRoute = path.startsWith('/invite/');
	const isApiRoute = path.startsWith('/api');
	const expectedUser = event.request.headers.get('x-groly-user');
	if (isApiRoute && path !== '/api/auth/login' && expectedUser && expectedUser !== user?.id && !(path === '/api/auth/logout' && !user)) {
		return Response.json({ error: 'Account changed; sign in again' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
	}

	if (!isApiRoute && !isAuthRoute && !isInviteRoute && !isIconInstallPage(path) && !user) {
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
			.replace('__GROLY_TOUCH_ICON__', icon.touch)
			.replace('__GROLY_ICON_MANIFEST__', isAppIcon(savedIcon) ? icon.manifest : '/manifest.webmanifest')
	}));
	applySecurityHeaders(response);
	response.headers.set('X-Groly-User', user?.id ?? '');
	// API-Antworten nie cachen: die URLs (z.B. /api/supplement-logs?from=…&to=…) sind
	// über den Tag identisch. Ohne no-store beantwortet iOS Safari sie nach langem
	// Standby aus dem eigenen HTTP-Cache statt neu zu laden → frisch geloggte Einträge
	// erscheinen nicht (überlebt sogar App-Neustart). no-store erzwingt echten Abgleich.
	if (isApiRoute) response.headers.set('Cache-Control', 'no-store');
	return response;
};
