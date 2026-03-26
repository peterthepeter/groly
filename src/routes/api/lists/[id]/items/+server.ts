import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items, listMembers, users } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { emitToListMembers } from '$lib/server/userEvents';
import { sendPushToListMembers } from '$lib/server/pushNotifications';
import { now, generateId } from '$lib/auth';

function getListAccess(listId: string, userId: string): { list: typeof lists.$inferSelect; permission: 'owner' | 'write' | 'read' | null } {
	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return { list: null as any, permission: null };
	if (list.ownerId === userId) return { list, permission: 'owner' };
	const member = db.select().from(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId), eq(listMembers.status, 'accepted'))).get();
	if (member) return { list, permission: member.permission === 'write' ? 'write' : 'read' };
	return { list: null as any, permission: null };
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (!list || permission === null) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const listItems = db
		.select({
			id: items.id,
			listId: items.listId,
			name: items.name,
			quantityInfo: items.quantityInfo,
			isChecked: items.isChecked,
			checkedAt: items.checkedAt,
			categoryOverride: items.categoryOverride,
			createdBy: items.createdBy,
			createdByUsername: users.username,
			createdAt: items.createdAt,
			updatedAt: items.updatedAt
		})
		.from(items)
		.leftJoin(users, eq(items.createdBy, users.id))
		.where(eq(items.listId, event.params.id))
		.all();

	return json(listItems);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (!list || permission === null) return json({ error: 'Nicht gefunden' }, { status: 404 });
	if (permission === 'read') return json({ error: 'Keine Schreibberechtigung' }, { status: 403 });

	const { name, quantityInfo, id: clientId } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const id = typeof clientId === 'string' && clientId.length > 0 && clientId.length <= 32
		? clientId
		: generateId(16);
	const ts = now();
	const trimmedName = name.trim();
	const trimmedQty = quantityInfo?.trim() ?? null;
	db.insert(items).values({ id, listId: event.params.id, name: trimmedName, quantityInfo: trimmedQty, isChecked: false, createdBy: user!.id, createdAt: ts, updatedAt: ts }).run();

	// Liste updatedAt aktualisieren
	db.update(lists).set({ updatedAt: ts }).where(eq(lists.id, event.params.id)).run();

	const creator = db.select({ username: users.username }).from(users).where(eq(users.id, user!.id)).get();
	const newItem = { id, listId: event.params.id, name: trimmedName, quantityInfo: trimmedQty, isChecked: false, checkedAt: null, categoryOverride: null, createdBy: user!.id, createdByUsername: creator?.username ?? null, createdAt: ts, updatedAt: ts };

	emitToListMembers(event.params.id, { type: 'item_added', listId: event.params.id, item: newItem, byUserId: user!.id });

	void sendPushToListMembers(event.params.id, user!.id, {
		title: list.name,
		body: `${creator?.username ?? 'Jemand'} hat „${trimmedName}" hinzugefügt`,
		url: `/listen/${event.params.id}`
	});

	return json(newItem, { status: 201 });
};
