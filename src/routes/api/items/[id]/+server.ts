import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items, listMembers } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

function now() { return Math.floor(Date.now() / 1000); }

async function getWritableItem(itemId: string, userId: string) {
	const item = db.select().from(items).where(eq(items.id, itemId)).get();
	if (!item) return null;
	const list = db.select().from(lists).where(eq(lists.id, item.listId)).get();
	if (!list) return null;
	if (list.ownerId === userId) return item;
	const member = db.select().from(listMembers).where(and(eq(listMembers.listId, list.id), eq(listMembers.userId, userId))).get();
	if (member?.permission === 'write') return item;
	return null;
}

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const item = await getWritableItem(event.params.id, user!.id);
	if (!item) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const body = await event.request.json();
	const ts = now();
	const updates: Record<string, unknown> = { updatedAt: ts };

	if (body.name !== undefined) updates.name = body.name.trim();
	if (body.quantityInfo !== undefined) updates.quantityInfo = body.quantityInfo?.trim() ?? null;
	if (body.isChecked !== undefined) {
		updates.isChecked = body.isChecked;
		updates.checkedAt = body.isChecked ? ts : null;
	}
	if (body.categoryOverride !== undefined) updates.categoryOverride = body.categoryOverride ?? null;

	db.update(items).set(updates).where(eq(items.id, item.id)).run();
	db.update(lists).set({ updatedAt: ts }).where(eq(lists.id, item.listId)).run();

	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const item = await getWritableItem(event.params.id, user!.id);
	if (!item) return json({ error: 'Nicht gefunden' }, { status: 404 });

	db.delete(items).where(eq(items.id, item.id)).run();
	return json({ ok: true });
};
