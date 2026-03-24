import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes, recipeIngredients, recipeSteps } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const RECIPE_LIMIT = 50;

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const userRecipes = db
		.select({
			id: recipes.id,
			title: recipes.title,
			description: recipes.description,
			imageUrl: recipes.imageUrl,
			sourceUrl: recipes.sourceUrl,
			servings: recipes.servings,
			prepTime: recipes.prepTime,
			cookTime: recipes.cookTime,
			createdAt: recipes.createdAt,
			updatedAt: recipes.updatedAt
		})
		.from(recipes)
		.where(eq(recipes.userId, user!.id))
		.orderBy(recipes.updatedAt)
		.all();

	return json({ recipes: userRecipes, limit: RECIPE_LIMIT });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const count = db.select().from(recipes).where(eq(recipes.userId, user!.id)).all().length;
	if (count >= RECIPE_LIMIT) {
		return json({ error: `Maximale Anzahl von ${RECIPE_LIMIT} Rezepten erreicht` }, { status: 400 });
	}

	const body = await event.request.json();
	const { title, description, imageUrl, sourceUrl, servings, prepTime, cookTime, ingredients, steps } = body;

	if (!title?.trim()) return json({ error: 'Titel erforderlich' }, { status: 400 });

	const now = Date.now();
	const recipeId = randomUUID();

	db.insert(recipes).values({
		id: recipeId,
		userId: user!.id,
		title: title.trim(),
		description: description?.trim() || null,
		imageUrl: imageUrl?.trim() || null,
		sourceUrl: sourceUrl?.trim() || null,
		servings: servings ?? 4,
		prepTime: prepTime ?? null,
		cookTime: cookTime ?? null,
		createdAt: now,
		updatedAt: now
	}).run();

	if (Array.isArray(ingredients)) {
		for (let i = 0; i < ingredients.length; i++) {
			const ing = ingredients[i];
			if (!ing.name?.trim()) continue;
			db.insert(recipeIngredients).values({
				id: randomUUID(),
				recipeId,
				amount: ing.amount?.trim() || null,
				unit: ing.unit?.trim() || null,
				name: ing.name.trim(),
				sortOrder: i
			}).run();
		}
	}

	if (Array.isArray(steps)) {
		for (let i = 0; i < steps.length; i++) {
			const step = steps[i];
			if (!step.text?.trim()) continue;
			db.insert(recipeSteps).values({
				id: randomUUID(),
				recipeId,
				stepNumber: i + 1,
				text: step.text.trim()
			}).run();
		}
	}

	return json({ id: recipeId }, { status: 201 });
};
