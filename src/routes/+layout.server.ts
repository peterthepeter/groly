import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null };
	return {
		user: {
			id: locals.user.id,
			username: locals.user.username,
			role: locals.user.role,
			mustChangePassword: locals.user.mustChangePassword
		}
	};
};
