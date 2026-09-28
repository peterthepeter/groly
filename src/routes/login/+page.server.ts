import type { PageServerLoad } from './$types';
import { languageFromAcceptLanguage } from '$lib/language';

export const load: PageServerLoad = ({ request, url }) => ({
	prefillUsername: url.searchParams.get('u') ?? '',
	lang: languageFromAcceptLanguage(request.headers.get('accept-language'))
});
