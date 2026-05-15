import { type Handle, redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { init } from '$lib/server/startup';
import { applySecurityHeaders } from '$lib/server/security';

export const handle: Handle = async ({ event, resolve }) => {
	await init();

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

	const response = await resolve(event);
	applySecurityHeaders(response);
	return response;
};
