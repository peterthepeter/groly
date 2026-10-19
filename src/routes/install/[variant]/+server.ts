import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { installLanguage, isAppIcon } from '#lib/appIcon';
import { iconInstallPage } from '#lib/server/iconInstallPage';

export const GET: RequestHandler = ({ params, request, url, locals }) => {
	if (!isAppIcon(params.variant)) error(404, 'Not found');
	let savedLanguage: unknown;
	try { savedLanguage = JSON.parse(locals.user?.settings ?? '{}').lang; } catch { /* Use browser language. */ }
	const lang = installLanguage(url.searchParams.get('lang'), savedLanguage, request.headers.get('accept-language'));
	return new Response(iconInstallPage(params.variant, lang, /android/i.test(request.headers.get('user-agent') ?? ''), import.meta.env.PROD), {
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Language': lang, 'Cache-Control': 'no-store' }
	});
};
