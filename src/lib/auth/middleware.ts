import type { RequestEvent } from '@sveltejs/kit';
import { getSession } from './index';
import { json } from '@sveltejs/kit';

export function requireAuth(event: RequestEvent) {
	const sessionId = event.cookies.get('session');
	if (!sessionId) return null;
	return getSession(sessionId);
}

export function authGuard(event: RequestEvent) {
	const user = requireAuth(event);
	if (!user) {
		return { error: json({ error: 'Unauthorized' }, { status: 401 }), user: null };
	}
	return { error: null, user };
}

export function adminGuard(event: RequestEvent) {
	const { error, user } = authGuard(event);
	if (error || !user) return { error: error ?? json({ error: 'Unauthorized' }, { status: 401 }), user: null };
	if (user.role !== 'admin') {
		return { error: json({ error: 'Forbidden' }, { status: 403 }), user: null };
	}
	return { error: null, user };
}
