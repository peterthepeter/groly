
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { recipes, recipeIngredients, recipeSteps, recipeTags } from '#lib/db/schema';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { getRecipeCategory, RecipeCategoryError, recipeCategoryErrorResponse, resolveRecipeCategory } from '#lib/server/recipeCategories';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const ingredients = db.select().from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, event.params.id))
		.orderBy(asc(recipeIngredients.sortOrder))
		.all();

	const steps = db.select().from(recipeSteps)
		.where(eq(recipeSteps.recipeId, event.params.id))
		.orderBy(asc(recipeSteps.stepNumber))
		.all();

	const tags = db.select({ tag: recipeTags.tag }).from(recipeTags)
		.where(eq(recipeTags.recipeId, event.params.id))
		.all()
		.map((r) => r.tag);

	const categoryName = recipe.categoryId ? getRecipeCategory(db, user!.id, recipe.categoryId)?.name ?? null : null;
	return Response.json({ ...recipe, categoryName, ingredients, steps, tags });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const body = await event.request.json();
	const { title, description, imageUrl, sourceUrl, servings, prepTime, cookTime, ingredients, steps, isFavorite, rating, tags, category } = body;

	if (typeof title !== 'string' || !title.trim()) return Response.json({ error: 'Titel erforderlich' }, { status: 400 });

	const now = Date.now();

	const ratingValue = typeof rating === 'number' && rating >= 1 && rating <= 5
		? Math.round(rating)
		: rating === null
			? null
			: recipe.rating;

	try {
		db.transaction(tx => {
			const categoryId = category === undefined ? null : resolveRecipeCategory(tx, user!.id, category)?.id ?? null;
			tx.update(recipes).set({
				title: title.trim(),
				description: description?.trim() || null,
				imageUrl: imageUrl?.trim() || null,
				sourceUrl: sourceUrl?.trim() || null,
				servings: servings ?? recipe.servings,
				prepTime: prepTime ?? null,
				cookTime: cookTime ?? null,
				...(category === undefined ? {} : { categoryId }),
				isFavorite: typeof isFavorite === 'boolean' ? isFavorite : recipe.isFavorite,
				rating: ratingValue,
				updatedAt: now
			}).where(eq(recipes.id, event.params.id)).run();

			if (Array.isArray(tags)) {
				tx.delete(recipeTags).where(eq(recipeTags.recipeId, event.params.id)).run();
				const seen = new Set<string>();
				for (const raw of tags) {
					const t = typeof raw === 'string' ? raw.trim() : '';
					if (!t || seen.has(t.toLowerCase())) continue;
					seen.add(t.toLowerCase());
					tx.insert(recipeTags).values({ recipeId: event.params.id, tag: t }).run();
				}
			}

			if (Array.isArray(ingredients)) {
				const existing = tx.select({ id: recipeIngredients.id })
					.from(recipeIngredients)
					.where(eq(recipeIngredients.recipeId, event.params.id))
					.all();
				const existingIds = new Set(existing.map(i => i.id));
				const keptIds = new Set<string>();

				for (let i = 0; i < ingredients.length; i++) {
					const ing = ingredients[i];
					if (!ing.name?.trim()) continue;
					if (ing.id && existingIds.has(ing.id)) {
						// Update in place — preserves ID so exclusions survive
						tx.update(recipeIngredients).set({
							amount: ing.amount?.trim() || null,
							unit: ing.unit?.trim() || null,
							name: ing.name.trim(),
							sortOrder: i
						}).where(eq(recipeIngredients.id, ing.id)).run();
						keptIds.add(ing.id);
					} else {
						const newId = randomUUID();
						tx.insert(recipeIngredients).values({
							id: newId,
							recipeId: event.params.id,
							amount: ing.amount?.trim() || null,
							unit: ing.unit?.trim() || null,
							name: ing.name.trim(),
							sortOrder: i
						}).run();
						keptIds.add(newId);
					}
				}

				// Delete removed ingredients (CASCADE removes their exclusions)
				for (const old of existing) {
					if (!keptIds.has(old.id)) {
						tx.delete(recipeIngredients).where(eq(recipeIngredients.id, old.id)).run();
					}
				}
			}

			if (Array.isArray(steps)) {
				tx.delete(recipeSteps).where(eq(recipeSteps.recipeId, event.params.id)).run();
				for (let i = 0; i < steps.length; i++) {
					const step = steps[i];
					if (!step.text?.trim()) continue;
					tx.insert(recipeSteps).values({
						id: randomUUID(),
						recipeId: event.params.id,
						stepNumber: i + 1,
						text: step.text.trim()
					}).run();
				}
			}
		});
	} catch (error) {
		if (error instanceof RecipeCategoryError) return recipeCategoryErrorResponse(error);
		throw error;
	}

	return Response.json({ ok: true });
};

export const PATCH: RequestHandler = async event => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const userId = user!.id;
	const condition = and(eq(recipes.id, event.params.id), eq(recipes.userId, userId));
	const body = await event.request.json().catch(() => null);

	try {
		const result = db.transaction(tx => {
			const recipe = tx.select({ id: recipes.id }).from(recipes).where(condition).get();
			if (!recipe) return null;
			const category = resolveRecipeCategory(tx, userId, body?.category);
			const updatedAt = Date.now();
			tx.update(recipes).set({ categoryId: category?.id ?? null, updatedAt }).where(condition).run();
			return { category, updatedAt };
		});
		return result ? Response.json(result) : Response.json({ error: 'Nicht gefunden' }, { status: 404 });
	} catch (error) {
		if (error instanceof RecipeCategoryError) return recipeCategoryErrorResponse(error);
		throw error;
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	db.delete(recipes).where(eq(recipes.id, event.params.id)).run();
	return Response.json({ ok: true });
};
