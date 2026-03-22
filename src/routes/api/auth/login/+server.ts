import { json } from '@sveltejs/kit';
import type { RequestEvent, RequestHandler } from './$types';
import { login } from '$lib/auth';

// In-Memory Sliding Window: max. 10 Versuche pro IP in 15 Minuten
const attempts = new Map<string, { count: number; resetAt: number }>();

function getIp(event: RequestEvent): string {
	return event.request.headers.get('x-forwarded-for')?.split(',')[0].trim()
		?? event.getClientAddress();
}

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = attempts.get(ip);
	if (!entry || now > entry.resetAt) {
		attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
		return true;
	}
	if (entry.count >= 10) return false;
	entry.count++;
	return true;
}

export const POST: RequestHandler = async (event) => {
	if (!checkRateLimit(getIp(event))) {
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

	return json({ ok: true });
};
