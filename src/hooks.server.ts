import type { Handle } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { getSession } from '$lib/auth';
import { bootstrapAdmin } from '$lib/auth';
import { runMigrations } from '$lib/db';

let initialized = false;

function init() {
	if (initialized) return;
	initialized = true;
	runMigrations();
	bootstrapAdmin();
}

export const handle: Handle = async ({ event, resolve }) => {
	init();

	const sessionId = event.cookies.get('session');
	const user = sessionId ? getSession(sessionId) : null;

	event.locals.user = user ?? undefined;

	const isAuthRoute = event.url.pathname.startsWith('/login');
	const isApiRoute = event.url.pathname.startsWith('/api');

	if (!isApiRoute && !isAuthRoute && !user) {
		redirect(302, '/login');
	}

	if (isAuthRoute && user) {
		redirect(302, '/');
	}

	return resolve(event);
};
