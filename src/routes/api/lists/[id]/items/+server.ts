import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items, listMembers, users } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function now() { return Math.floor(Date.now() / 1000); }
function generateId() { return randomBytes(12).toString('base64url'); }

function getListAccess(listId: string, userId: string): { list: typeof lists.$inferSelect; permission: 'owner' | 'write' | null } {
	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return { list: null as any, permission: null };
	if (list.ownerId === userId) return { list, permission: 'owner' };
	const member = db.select().from(listMembers).where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId))).get();
	if (member) return { list, permission: member.permission === 'write' ? 'write' : null };
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

	const { name, quantityInfo } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const id = generateId();
	const ts = now();
	db.insert(items).values({ id, listId: event.params.id, name: name.trim(), quantityInfo: quantityInfo?.trim() ?? null, isChecked: false, createdBy: user!.id, createdAt: ts, updatedAt: ts }).run();

	// Liste updatedAt aktualisieren
	db.update(lists).set({ updatedAt: ts }).where(eq(lists.id, event.params.id)).run();

	return json({ id, listId: event.params.id, name, quantityInfo, isChecked: false, checkedAt: null, createdBy: user!.id, createdByUsername: null, createdAt: ts, updatedAt: ts }, { status: 201 });
};
