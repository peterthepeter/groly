import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const now = Date.now();
	db.update(recipes).set({
		cookCount: sql`${recipes.cookCount} + 1`,
		lastCookedAt: now
	}).where(eq(recipes.id, event.params.id)).run();

	const updated = db.select({ cookCount: recipes.cookCount, lastCookedAt: recipes.lastCookedAt })
		.from(recipes).where(eq(recipes.id, event.params.id)).get();

	return json({ ok: true, cookCount: updated?.cookCount, lastCookedAt: updated?.lastCookedAt });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	if ((recipe.cookCount ?? 0) <= 0) {
		return json({ ok: true, cookCount: 0, lastCookedAt: recipe.lastCookedAt });
	}

	const newCount = Math.max((recipe.cookCount ?? 0) - 1, 0);
	db.update(recipes).set({
		cookCount: newCount,
		...(newCount === 0 ? { lastCookedAt: null } : {})
	}).where(eq(recipes.id, event.params.id)).run();

	const updated = db.select({ cookCount: recipes.cookCount, lastCookedAt: recipes.lastCookedAt })
		.from(recipes).where(eq(recipes.id, event.params.id)).get();

	return json({ ok: true, cookCount: updated?.cookCount, lastCookedAt: updated?.lastCookedAt });
};
