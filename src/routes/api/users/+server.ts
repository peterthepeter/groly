import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { sql } from 'drizzle-orm';
import { createUser } from '$lib/auth';
import { createInvite } from '$lib/auth/invites';
import { randomBytes } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const allUsers = db.all(sql`
		SELECT
			u.id,
			u.username,
			u.role,
			u.created_at AS createdAt,
			u.last_login_at AS lastLoginAt,
			u.must_change_password AS mustChangePassword,
			CAST(COUNT(DISTINCT l.id) AS INTEGER) AS listCount,
			CAST(COUNT(DISTINCT i.id) AS INTEGER) AS itemCount,
			CAST(COUNT(DISTINCT r.id) AS INTEGER) AS recipeCount,
			(SELECT inv.type FROM user_invites inv WHERE inv.user_id = u.id AND inv.used_at IS NULL ORDER BY inv.created_at DESC LIMIT 1) AS openInviteType,
			(SELECT inv.expires_at FROM user_invites inv WHERE inv.user_id = u.id AND inv.used_at IS NULL ORDER BY inv.created_at DESC LIMIT 1) AS openInviteExpiresAt
		FROM users u
		LEFT JOIN lists l ON l.owner_id = u.id
		LEFT JOIN items i ON i.list_id = l.id
		LEFT JOIN recipes r ON r.user_id = u.id
		GROUP BY u.id
	`);
	return json(allUsers);
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { username, role } = await event.request.json();
	const trimmed = String(username ?? '').trim();
	if (!trimmed) return json({ error: 'Benutzername erforderlich' }, { status: 400 });

	// Placeholder password the user can never know — overwritten when invite is consumed.
	const placeholder = `!invite!${randomBytes(32).toString('base64url')}`;

	let userId: string;
	try {
		userId = await createUser(trimmed, placeholder, role === 'admin' ? 'admin' : 'user', false);
	} catch {
		return json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
	}

	const token = createInvite(userId, 'invite');
	const origin = event.url.origin;
	return json({ id: userId, inviteToken: token, inviteUrl: `${origin}/invite/${token}`, type: 'invite' }, { status: 201 });
};
