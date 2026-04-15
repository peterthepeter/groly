import type { PageServerLoad } from './$types';
import { requireAuth } from '$lib/auth/middleware';
import { redirect } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const user = requireAuth(event);
	if (!user) throw redirect(302, '/login');
	return { user: { id: user.id, username: user.username, role: user.role } };
};
