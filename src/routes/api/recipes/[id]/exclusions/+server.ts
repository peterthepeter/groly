import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes, recipeIngredients, recipeIngredientExclusions } from '$lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select({ id: recipes.id }).from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const exclusions = db.select({ ingredientId: recipeIngredientExclusions.ingredientId })
		.from(recipeIngredientExclusions)
		.innerJoin(recipeIngredients, eq(recipeIngredientExclusions.ingredientId, recipeIngredients.id))
		.where(and(
			eq(recipeIngredientExclusions.userId, user!.id),
			eq(recipeIngredients.recipeId, event.params.id)
		))
		.all();

	return json({ excludedIds: exclusions.map(e => e.ingredientId) });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select({ id: recipes.id }).from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const body = await event.request.json();
	const excludedIds: string[] = Array.isArray(body.excludedIds) ? body.excludedIds : [];

	// Get all ingredient IDs for this recipe to validate input
	const validIngredients = db.select({ id: recipeIngredients.id }).from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, event.params.id))
		.all();
	const validIds = new Set(validIngredients.map(i => i.id));
	const safeExcludedIds = excludedIds.filter(id => validIds.has(id));

	// Delete existing exclusions for this recipe's ingredients
	if (validIngredients.length > 0) {
		db.delete(recipeIngredientExclusions)
			.where(and(
				eq(recipeIngredientExclusions.userId, user!.id),
				inArray(recipeIngredientExclusions.ingredientId, validIngredients.map(i => i.id))
			))
			.run();
	}

	// Insert new exclusions
	for (const ingredientId of safeExcludedIds) {
		db.insert(recipeIngredientExclusions).values({
			userId: user!.id,
			ingredientId
		}).run();
	}

	return json({ ok: true });
};
