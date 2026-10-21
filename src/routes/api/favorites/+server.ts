
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { favorites } from '#lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { now } from '#lib/auth';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db.select().from(favorites)
		.where(eq(favorites.userId, user!.id))
		.orderBy(desc(favorites.createdAt))
		.all();

	return Response.json(rows);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const body = await event.request.json();
	const name = body.name?.trim();
	if (!name) return Response.json({ error: 'Name required' }, { status: 400 });

	db.transaction(tx => {
		const previousName = typeof body.previousName === 'string' ? body.previousName.trim() : name;
		const previous = tx.select().from(favorites).where(and(eq(favorites.userId, user!.id), eq(favorites.name, previousName))).get();
		if (previousName !== name) tx.delete(favorites).where(and(eq(favorites.userId, user!.id), eq(favorites.name, previousName))).run();
		tx.insert(favorites)
			.values({
				userId: user!.id,
				name,
				quantityInfo: body.quantityInfo?.trim() ?? null,
				categoryOverride: body.categoryOverride ?? null,
				createdAt: previous?.createdAt ?? now()
			})
			.onConflictDoUpdate({
				target: [favorites.userId, favorites.name],
				set: {
					quantityInfo: body.quantityInfo?.trim() ?? null,
					categoryOverride: body.categoryOverride ?? null
				}
			})
			.run();
	});

	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const body = await event.request.json();
	if (!body.name) return Response.json({ error: 'Name required' }, { status: 400 });

	db.delete(favorites)
		.where(and(eq(favorites.userId, user!.id), eq(favorites.name, body.name)))
		.run();

	return Response.json({ ok: true });
};
