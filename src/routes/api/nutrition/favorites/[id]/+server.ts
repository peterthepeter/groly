import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { nutritionFavorites } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';

function ensureOwn(userId: string, id: string) {
	return db.select().from(nutritionFavorites)
		.where(and(eq(nutritionFavorites.id, id), eq(nutritionFavorites.userId, userId)))
		.get() ?? null;
}

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const fav = ensureOwn(user.id, event.params.id);
	if (!fav) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const updates: Partial<typeof nutritionFavorites.$inferInsert> = {};
		if (typeof body.displayName === 'string' && body.displayName.trim()) updates.displayName = body.displayName.trim().slice(0, 80);
		if (typeof body.defaultAmount === 'number' && body.defaultAmount > 0) updates.defaultAmount = body.defaultAmount;
		if (body.defaultUnit === 'g' || body.defaultUnit === 'ml' || body.defaultUnit === 'piece') updates.defaultUnit = body.defaultUnit;
		if ('defaultGramsPerPiece' in body) updates.defaultGramsPerPiece = body.defaultGramsPerPiece ?? null;
		if (typeof body.useCount === 'number') { updates.useCount = body.useCount; updates.lastUsedAt = Date.now(); }
		if (Object.keys(updates).length === 0) return json({ ok: true });
		db.update(nutritionFavorites).set(updates).where(eq(nutritionFavorites.id, fav.id)).run();
		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const fav = ensureOwn(user.id, event.params.id);
	if (!fav) return json({ error: 'Not found' }, { status: 404 });

	db.delete(nutritionFavorites).where(eq(nutritionFavorites.id, fav.id)).run();
	return json({ ok: true });
};
