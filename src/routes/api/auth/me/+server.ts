
import type { RequestHandler } from './$types';
import { requireAuth } from '#lib/auth/middleware';

export const GET: RequestHandler = async (event) => {
	const user = requireAuth(event);
	if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
	return Response.json({
		id: user.id,
		username: user.username,
		role: user.role
	});
};
