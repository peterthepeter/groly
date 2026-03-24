import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers, users } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendPushToUser } from '$lib/server/pushNotifications';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = db.select().from(lists).where(and(eq(lists.id, event.params.id), eq(lists.ownerId, user!.id))).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const members = db
		.select({ userId: listMembers.userId, username: users.username, permission: listMembers.permission, status: listMembers.status })
		.from(listMembers)
		.innerJoin(users, eq(listMembers.userId, users.id))
		.where(eq(listMembers.listId, event.params.id))
		.all();

	return json(members);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = db.select().from(lists).where(and(eq(lists.id, event.params.id), eq(lists.ownerId, user!.id))).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const { username, permission: reqPermission } = await event.request.json();
	if (!username?.trim()) return json({ error: 'Benutzername erforderlich' }, { status: 400 });

	const target = db.select().from(users).where(sql`lower(${users.username}) = lower(${username.trim()})`).get();
	if (!target) return json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
	if (target.id === user!.id) return json({ error: 'Du kannst die Liste nicht mit dir selbst teilen' }, { status: 400 });

	const memberPermission = reqPermission === 'read' ? 'read' : 'write';
	db.insert(listMembers).values({ listId: event.params.id, userId: target.id, permission: memberPermission, status: 'pending' }).onConflictDoNothing().run();

	// Push-Benachrichtigung an eingeladenen User
	await sendPushToUser(target.id, {
		title: 'Einladung zu Liste',
		body: `${user!.username ?? 'Jemand'} möchte die Liste "${list.name}" mit dir teilen`,
		url: '/'
	});

	return json({ userId: target.id, username: target.username, permission: memberPermission, status: 'pending' }, { status: 201 });
};
