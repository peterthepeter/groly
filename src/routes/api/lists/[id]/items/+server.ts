import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function now() { return Math.floor(Date.now() / 1000); }
function generateId() { return randomBytes(12).toString('base64url'); }

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = db.select().from(lists).where(and(eq(lists.id, event.params.id), eq(lists.ownerId, user!.id))).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const listItems = db.select().from(items).where(eq(items.listId, event.params.id)).all();
	return json(listItems);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = db.select().from(lists).where(and(eq(lists.id, event.params.id), eq(lists.ownerId, user!.id))).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const { name, quantityInfo } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const id = generateId();
	const ts = now();
	db.insert(items).values({ id, listId: event.params.id, name: name.trim(), quantityInfo: quantityInfo?.trim() ?? null, isChecked: false, createdAt: ts, updatedAt: ts }).run();

	// Liste updatedAt aktualisieren
	db.update(lists).set({ updatedAt: ts }).where(eq(lists.id, event.params.id)).run();

	return json({ id, listId: event.params.id, name, quantityInfo, isChecked: false, checkedAt: null, createdAt: ts, updatedAt: ts }, { status: 201 });
};
