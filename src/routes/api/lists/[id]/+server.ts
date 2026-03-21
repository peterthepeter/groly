import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

function now() { return Math.floor(Date.now() / 1000); }

function getOwnedList(listId: string, userId: string) {
	return db.select().from(lists).where(and(eq(lists.id, listId), eq(lists.ownerId, userId))).get();
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });
	return json(list);
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const { name, description } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	db.update(lists).set({ name: name.trim(), description: description?.trim() ?? null, updatedAt: now() }).where(eq(lists.id, list.id)).run();
	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	db.delete(lists).where(eq(lists.id, list.id)).run();
	return json({ ok: true });
};
