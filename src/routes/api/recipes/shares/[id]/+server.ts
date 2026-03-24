import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipeShares, recipes, recipeIngredients, recipeSteps } from '$lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const RECIPE_LIMIT = 50;

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const share = db.select().from(recipeShares)
		.where(and(eq(recipeShares.id, event.params.id), eq(recipeShares.receiverId, user!.id)))
		.get();
	if (!share) return json({ error: 'Nicht gefunden' }, { status: 404 });

	let body: { action?: string };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage' }, { status: 400 });
	}
	const { action } = body;

	if (action === 'decline') {
		db.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
		return json({ ok: true });
	}

	if (action === 'accept') {
		// Check recipient's recipe limit
		const count = db.select().from(recipes).where(eq(recipes.userId, user!.id)).all().length;
		if (count >= RECIPE_LIMIT) {
			return json({ error: `Maximale Anzahl von ${RECIPE_LIMIT} Rezepten erreicht` }, { status: 400 });
		}

		const original = db.select().from(recipes).where(eq(recipes.id, share.recipeId)).get();
		if (!original) {
			db.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
			return json({ error: 'Originalrezept nicht mehr vorhanden' }, { status: 404 });
		}

		const now = Date.now();
		const newRecipeId = randomUUID();

		// Copy the recipe
		db.insert(recipes).values({
			id: newRecipeId,
			userId: user!.id,
			title: original.title,
			description: original.description,
			imageUrl: original.imageUrl,
			sourceUrl: original.sourceUrl,
			servings: original.servings,
			prepTime: original.prepTime,
			cookTime: original.cookTime,
			createdAt: now,
			updatedAt: now
		}).run();

		const origIngredients = db.select().from(recipeIngredients)
			.where(eq(recipeIngredients.recipeId, original.id))
			.orderBy(asc(recipeIngredients.sortOrder))
			.all();
		for (const ing of origIngredients) {
			db.insert(recipeIngredients).values({ ...ing, id: randomUUID(), recipeId: newRecipeId }).run();
		}

		const origSteps = db.select().from(recipeSteps)
			.where(eq(recipeSteps.recipeId, original.id))
			.orderBy(asc(recipeSteps.stepNumber))
			.all();
		for (const step of origSteps) {
			db.insert(recipeSteps).values({ ...step, id: randomUUID(), recipeId: newRecipeId }).run();
		}

		db.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
		return json({ recipeId: newRecipeId });
	}

	return json({ error: 'Ungültige Aktion' }, { status: 400 });
};
