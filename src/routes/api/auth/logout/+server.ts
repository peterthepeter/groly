import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logout } from '$lib/auth';

export const POST: RequestHandler = async ({ cookies }) => {
	const sessionId = cookies.get('session');
	if (sessionId) logout(sessionId);
	cookies.delete('session', { path: '/' });
	return json({ ok: true });
};
