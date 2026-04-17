import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { mealPlanEntries } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { now as dbNow } from '$lib/auth';

// PATCH /api/meal-plan/[id] — update servings/recipe/note of a specific entry
export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const entry = db
		.select()
		.from(mealPlanEntries)
		.where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, user!.id)))
		.get();

	if (!entry) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const ts = dbNow();

		db.update(mealPlanEntries)
			.set({
				recipeId: 'recipeId' in body ? (body.recipeId ?? null) : entry.recipeId,
				note: 'note' in body ? (body.note?.trim() ?? null) : entry.note,
				servings: 'servings' in body ? (body.servings ?? null) : entry.servings,
				updatedAt: ts
			})
			.where(eq(mealPlanEntries.id, id))
			.run();

		return json({ id });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

// DELETE /api/meal-plan/[id] — delete a specific entry
export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	db.delete(mealPlanEntries)
		.where(and(eq(mealPlanEntries.id, id), eq(mealPlanEntries.userId, user!.id)))
		.run();

	return json({ deleted: true });
};
