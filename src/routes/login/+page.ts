import type { PageLoad } from './$types';

export const load: PageLoad = ({ url }) => {
	return {
		prefillUsername: url.searchParams.get('u') ?? ''
	};
};
