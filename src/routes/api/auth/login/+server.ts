
import type { RequestHandler } from './$types';
import { login } from '#lib/auth';
import { checkRateLimit } from '#lib/server/loginRateLimit';
import { languageFromAcceptLanguage } from '#lib/language';
import * as m from '#lib/paraglide/messages';

export const POST: RequestHandler = async (event) => {
	const lang = languageFromAcceptLanguage(event.request.headers.get('accept-language'));
	let body;
	try { body = await event.request.json(); } catch { body = null; }
	const { username, password } = body ?? {};
	if (typeof username !== 'string' || typeof password !== 'string' || !username.trim() || !password || username.length > 256 || password.length > 4096) {
		return Response.json({ error: m.login_missing_credentials({}, { locale: lang }) }, { status: 400 });
	}

	const normalizedUsername = username.trim();
	const ip = event.getClientAddress();
	if (!checkRateLimit(`ip:${ip}`, 100) || !checkRateLimit(JSON.stringify([ip, normalizedUsername.toLowerCase()]))) {
		return Response.json({ error: m.login_rate_limited({}, { locale: lang }) }, { status: 429 });
	}

	const result = await login(normalizedUsername, password);
	if (!result) {
		return Response.json({ error: m.login_error({}, { locale: lang }) }, { status: 401 });
	}

	event.cookies.set('session', result.sessionId, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: 60 * 60 * 24 * 30,
		secure: process.env.ORIGIN?.startsWith('https://') ?? false
	});

	return Response.json({ ok: true });
};
