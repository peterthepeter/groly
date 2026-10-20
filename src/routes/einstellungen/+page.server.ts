import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { APP_ICON_COOKIE, isAppIcon } from '#lib/appIcon';

export const load: PageServerLoad = ({ cookies, url }) => {
	if (url.searchParams.get('expand') === 'shortcuts') redirect(302, '/einstellungen/schnellzugriff');
	const icon = cookies.get(APP_ICON_COOKIE);
	return { appIcon: isAppIcon(icon) ? icon : 'dark' as const };
};
