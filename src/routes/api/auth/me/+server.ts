import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAuth } from '$lib/auth/middleware';

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);
	if (!user) return json({ error: 'Unauthorized' }, { status: 401 });
	return json({
		id: user.id,
		username: user.username,
		role: user.role,
		mustChangePassword: user.mustChangePassword
	});
};
