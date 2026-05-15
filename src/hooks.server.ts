import { type Handle, json, redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { init } from '$lib/server/startup';
import { applySecurityHeaders } from '$lib/server/security';

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
	applySecurityHeaders(response);
	return response;
};
