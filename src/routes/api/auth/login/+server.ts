import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { login } from '$lib/auth';
import { checkRateLimit } from '$lib/server/loginRateLimit';

export const POST: RequestHandler = async (event) => {
	if (!checkRateLimit(event.getClientAddress())) {
		return json({ error: 'Zu viele Versuche. Bitte warte 15 Minuten.' }, { status: 429 });
	}

	const { username, password } = await event.request.json();
	if (!username || !password) {
		return json({ error: 'Benutzername und Passwort erforderlich' }, { status: 400 });
	}

	const result = await login(username, password);
	if (!result) {
		return json({ error: 'Falscher Benutzername oder Passwort' }, { status: 401 });
	}

	event.cookies.set('session', result.sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30,
		secure: process.env.NODE_ENV === 'production'
	});

	return json({ ok: true, mustChangePassword: result.mustChangePassword });
};
