import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { emitMemberCountToOwner } from '$lib/server/userEvents';

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const listId = event.params.id;
	const targetUserId = event.params.userId;

	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const isOwner = list.ownerId === user!.id;
	const isSelf = targetUserId === user!.id;

	if (!isOwner && !isSelf) return json({ error: 'Keine Berechtigung' }, { status: 403 });

	db.delete(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.userId, targetUserId))).run();

	emitMemberCountToOwner(listId, list.ownerId);

	return json({ ok: true });
};
