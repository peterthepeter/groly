import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, items } from '$lib/db/schema';
import { eq, and, count, sql } from 'drizzle-orm';
import { randomBytes } from 'crypto';

function now() { return Math.floor(Date.now() / 1000); }
function generateId() { return randomBytes(12).toString('base64url'); }

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const userLists = db
		.select({
			id: lists.id,
			name: lists.name,
			description: lists.description,
			ownerId: lists.ownerId,
			createdAt: lists.createdAt,
			updatedAt: lists.updatedAt,
			openCount: sql<number>`(SELECT COUNT(*) FROM items WHERE items.list_id = ${lists.id} AND items.is_checked = 0)`
		})
		.from(lists)
		.where(eq(lists.ownerId, user!.id))
		.orderBy(lists.updatedAt)
		.all();

	return json(userLists);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { name, description } = await event.request.json();
	if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });

	const id = generateId();
	const ts = now();
	db.insert(lists).values({ id, name: name.trim(), description: description?.trim() ?? null, ownerId: user!.id, createdAt: ts, updatedAt: ts }).run();

	return json({ id, name, description, ownerId: user!.id, openCount: 0, createdAt: ts, updatedAt: ts }, { status: 201 });
};
