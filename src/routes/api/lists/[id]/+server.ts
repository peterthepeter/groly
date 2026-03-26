import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

import { now } from '$lib/auth';
import { emitToListMembers } from '$lib/server/userEvents';

function getOwnedList(listId: string, userId: string) {
	return db.select().from(lists).where(and(eq(lists.id, listId), eq(lists.ownerId, userId))).get();
}

function getAccessibleList(listId: string, userId: string): { list: typeof lists.$inferSelect | null; permission: 'owner' | 'write' | 'read' | null } {
	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return { list: null, permission: null };
	if (list.ownerId === userId) return { list, permission: 'owner' };
	const member = db.select().from(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId), eq(listMembers.status, 'accepted'))).get();
	if (!member) return { list: null, permission: null };
	return { list, permission: member.permission === 'write' ? 'write' : 'read' };
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getAccessibleList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });
	return json({ ...list, userPermission: permission });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const { name, description, iconId } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const trimmedName = name.trim();
	const trimmedDesc = description?.trim() ?? null;
	db.update(lists).set({ name: trimmedName, description: trimmedDesc, iconId: iconId ?? null, updatedAt: now() }).where(eq(lists.id, list.id)).run();
	emitToListMembers(list.id, { type: 'list_updated', listId: list.id, list: { name: trimmedName, description: trimmedDesc, iconId: iconId ?? null } });
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	emitToListMembers(list.id, { type: 'list_deleted', listId: list.id });
	db.delete(lists).where(eq(lists.id, list.id)).run();
	return json({ ok: true });
};
