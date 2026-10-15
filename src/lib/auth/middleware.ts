import type { RequestEvent } from '@sveltejs/kit';
import { getSession } from './index';


export function requireAuth(event: RequestEvent) {
	const sessionId = event.cookies.get('session');
	if (!sessionId) return null;
	return getSession(sessionId);
}

export function authGuard(event: RequestEvent) {
	const user = requireAuth(event);
	if (!user) {
		return { error: Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
	}
	return { error: null, user };
}

export function adminGuard(event: RequestEvent) {
	const { error, user } = authGuard(event);
	if (error || !user) return { error: error ?? Response.json({ error: 'Unauthorized' }, { status: 401 }), user: null };
	if (user.role !== 'admin') {
		return { error: Response.json({ error: 'Forbidden' }, { status: 403 }), user: null };
	}
	return { error: null, user };
}
