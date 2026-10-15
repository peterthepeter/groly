
import type { RequestHandler } from './$types';
import { login } from '#lib/auth';
import { checkRateLimit } from '#lib/server/loginRateLimit';
import { languageFromAcceptLanguage } from '#lib/language';
import * as m from '#lib/paraglide/messages';

export const POST: RequestHandler = async (event) => {
	const lang = languageFromAcceptLanguage(event.request.headers.get('accept-language'));
	const { username, password } = await event.request.json();
	if (!username || !password) {
		return Response.json({ error: m.login_missing_credentials({}, { locale: lang }) }, { status: 400 });
	}

	// Rate-limit per IP+username so failed attempts on one account don't block others
	if (!checkRateLimit(`${event.getClientAddress()}:${String(username).toLowerCase()}`)) {
		return Response.json({ error: m.login_rate_limited({}, { locale: lang }) }, { status: 429 });
	}

	const result = await login(username, password);
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
