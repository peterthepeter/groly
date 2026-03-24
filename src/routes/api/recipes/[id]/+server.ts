import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes, recipeIngredients, recipeSteps } from '$lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const ingredients = db.select().from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, event.params.id))
		.orderBy(asc(recipeIngredients.sortOrder))
		.all();

	const steps = db.select().from(recipeSteps)
		.where(eq(recipeSteps.recipeId, event.params.id))
		.orderBy(asc(recipeSteps.stepNumber))
		.all();

	return json({ ...recipe, ingredients, steps });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const body = await event.request.json();
	const { title, description, imageUrl, sourceUrl, servings, prepTime, cookTime, ingredients, steps } = body;

	if (!title?.trim()) return json({ error: 'Titel erforderlich' }, { status: 400 });

	const now = Date.now();

	db.update(recipes).set({
		title: title.trim(),
		description: description?.trim() || null,
		imageUrl: imageUrl?.trim() || null,
		sourceUrl: sourceUrl?.trim() || null,
		servings: servings ?? recipe.servings,
		prepTime: prepTime ?? null,
		cookTime: cookTime ?? null,
		updatedAt: now
	}).where(eq(recipes.id, event.params.id)).run();

	if (Array.isArray(ingredients)) {
		db.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, event.params.id)).run();
		for (let i = 0; i < ingredients.length; i++) {
			const ing = ingredients[i];
			if (!ing.name?.trim()) continue;
			db.insert(recipeIngredients).values({
				id: randomUUID(),
				recipeId: event.params.id,
				amount: ing.amount?.trim() || null,
				unit: ing.unit?.trim() || null,
				name: ing.name.trim(),
				sortOrder: i
			}).run();
		}
	}

	if (Array.isArray(steps)) {
		db.delete(recipeSteps).where(eq(recipeSteps.recipeId, event.params.id)).run();
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			if (!step.text?.trim()) continue;
			db.insert(recipeSteps).values({
				id: randomUUID(),
				recipeId: event.params.id,
				stepNumber: i + 1,
				text: step.text.trim()
			}).run();
		}
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	db.delete(recipes).where(eq(recipes.id, event.params.id)).run();
	return json({ ok: true });
};
