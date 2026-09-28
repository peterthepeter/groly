import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { validateInvite, consumeInvite } from '$lib/auth/invites';
import { validatePasswordRule } from '$lib/password';
import { languageFromAcceptLanguage } from '$lib/language';

export const load: PageServerLoad = ({ params, request }) => {
	const lang = languageFromAcceptLanguage(request.headers.get('accept-language'));
	const result = validateInvite(params.token);
	if (result.status === 'valid') {
		return {
			lang,
			status: 'valid' as const,
			username: result.username,
			type: result.type,
			expiresAt: result.expiresAt
		};
	}
	return { status: result.status, lang };
};

export const actions: Actions = {
	default: async ({ params, request, cookies }) => {
		const data = await request.formData();
		const password = String(data.get('password') ?? '');
		const confirm = String(data.get('confirm') ?? '');

		if (password !== confirm) {
			return fail(400, { error: 'mismatch' });
		}
		const pwError = validatePasswordRule(password);
		if (pwError) {
			return fail(400, { error: 'invalid', reason: pwError });
		}

		const result = consumeInvite(params.token, password);
		if ('error' in result) {
			return fail(400, { error: result.error });
		}

		cookies.set('session', result.sessionId, {
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 30,
			secure: process.env.ORIGIN?.startsWith('https://') ?? false
		});

		redirect(303, '/');
	}
};
