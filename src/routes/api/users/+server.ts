
import type { RequestHandler } from './$types';
import { adminGuard } from '#lib/auth/middleware';
import { listAdminUsers } from '#lib/server/adminUsers';
import { createUser } from '#lib/auth';
import { createInvite } from '#lib/auth/invites';
import { randomBytes } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const allUsers = listAdminUsers();
	return Response.json(allUsers);
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { username, role } = await event.request.json();
	const trimmed = String(username ?? '').trim();
	if (!trimmed) return Response.json({ error: 'Benutzername erforderlich' }, { status: 400 });

	// Placeholder password the user can never know — overwritten when invite is consumed.
	const placeholder = `!invite!${randomBytes(32).toString('base64url')}`;

	let userId: string;
	try {
		userId = await createUser(trimmed, placeholder, role === 'admin' ? 'admin' : 'user', false);
	} catch {
		return Response.json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
	}

	const token = createInvite(userId, 'invite');
	const origin = event.url.origin;
	return Response.json({ id: userId, inviteToken: token, inviteUrl: `${origin}/invite/${token}`, type: 'invite' }, { status: 201 });
};
