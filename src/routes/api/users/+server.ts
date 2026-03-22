import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { createUser } from '$lib/auth';
import { sql } from 'drizzle-orm';

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
			CAST(COUNT(DISTINCT l.id) AS INTEGER) AS listCount,
			CAST(COUNT(i.id) AS INTEGER) AS itemCount
		FROM users u
		LEFT JOIN lists l ON l.owner_id = u.id
		LEFT JOIN items i ON i.list_id = l.id
		GROUP BY u.id
	`);
	return json(allUsers);
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { username, password, role } = await event.request.json();
	if (!username?.trim() || !password) return json({ error: 'Fehlende Felder' }, { status: 400 });

	try {
		const id = await createUser(username.trim(), password, role === 'admin' ? 'admin' : 'user', true);
		return json({ id }, { status: 201 });
	} catch {
		return json({ error: 'Benutzername bereits vergeben' }, { status: 409 });
	}
};
