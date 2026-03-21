import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { createUser } from '$lib/auth';

export const GET: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const allUsers = db.select({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt }).from(users).all();
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
