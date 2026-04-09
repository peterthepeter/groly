import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers, users, items } from '$lib/db/schema';
import { eq, and, sql, count as sqlCount } from 'drizzle-orm';
import { sendPushToUser } from '$lib/server/pushNotifications';
import { emit, emitMemberCountToOwner } from '$lib/server/userEvents';

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
	const insertResult = db.insert(listMembers).values({ listId: event.params.id, userId: target.id, permission: memberPermission, status: 'pending' }).onConflictDoNothing().run();

	if (insertResult.changes === 0) {
		return json({ error: 'Benutzer ist bereits Mitglied dieser Liste' }, { status: 409 });
	}

	// SSE: memberCount an Owner senden (Teilen-Icon erscheint sofort)
	emitMemberCountToOwner(event.params.id, user!.id);

	// SSE: Einladungs-Event an eingeladenen User senden (erscheint sofort in Übersicht)
	const openCount = db.select({ count: sqlCount() }).from(items).where(and(eq(items.listId, list.id), eq(items.isChecked, false))).get()?.count ?? 0;
	const ownerData = db.select({ username: users.username }).from(users).where(eq(users.id, user!.id)).get();
	emit(target.id, {
		type: 'list_invitation',
		invitation: {
			id: list.id,
			name: list.name,
			description: list.description,
			iconId: list.iconId,
			ownerId: list.ownerId,
			ownerUsername: ownerData?.username ?? null,
			openCount,
			updatedAt: list.updatedAt
		}
	});

	// Push-Benachrichtigung an eingeladenen User
	await sendPushToUser(target.id, {
		title: `Groly – ${user!.username ?? 'Jemand'}`,
		body: `${user!.username ?? 'Jemand'} möchte die Einkaufsliste ${list.name} mit dir teilen`,
		url: '/'
	});

	return json({ userId: target.id, username: target.username, permission: memberPermission, status: 'pending' }, { status: 201 });
};
