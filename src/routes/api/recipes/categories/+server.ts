import { and, eq, inArray, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { recipeCategories } from '#lib/db/schema';
import { parseRecipeCategoryName, RECIPE_CATEGORY_LIMIT, recipeCategoryDraftValid, type RecipeCategory } from '#lib/recipeCategories';
import { getRecipeCategories, RecipeCategoryError, recipeCategoryErrorResponse } from '#lib/server/recipeCategories';

export const GET: RequestHandler = async event => {
	const { error, user } = authGuard(event);
	if (error) return error;
	return Response.json({ categories: getRecipeCategories(db, user!.id) });
};

function parseCategories(value: unknown): RecipeCategory[] | null {
	if (!Array.isArray(value) || value.length > RECIPE_CATEGORY_LIMIT) return null;
	const categories: RecipeCategory[] = [];
	const ids = new Set<string>();
	for (const row of value) {
		const name = parseRecipeCategoryName(row?.name);
		const id = row?.id;
		if (!name || typeof id !== 'string' || !/^[a-zA-Z0-9_:-]{1,120}$/.test(id) || ids.has(id)) return null;
		ids.add(id);
		categories.push({ id, name });
	}
	return recipeCategoryDraftValid(categories) ? categories : null;
}

export const PUT: RequestHandler = async event => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const userId = user!.id;
	const body = await event.request.json().catch(() => null);
	const base = parseCategories(body?.base);
	const categories = parseCategories(body?.categories);
	if (!base || !categories) return recipeCategoryErrorResponse(new RecipeCategoryError('invalid_recipe_category'));

	try {
		db.transaction(tx => {
			const current = getRecipeCategories(tx, userId);
			if (JSON.stringify(current) !== JSON.stringify(base)) throw new RecipeCategoryError('recipe_categories_changed', 409);
			const ids = new Set(categories.map(category => category.id));
			const originalNames = new Map(current.map(category => [category.id, category.name]));
			const removedIds = current.filter(category => !ids.has(category.id)).map(category => category.id);
			if (removedIds.length) tx.delete(recipeCategories).where(and(eq(recipeCategories.userId, userId), inArray(recipeCategories.id, removedIds))).run();
			const renamedIds = categories.filter(category => originalNames.has(category.id) && originalNames.get(category.id) !== category.name)
				.map(category => category.id);
			if (renamedIds.length) {
				// Reserve temporary keys within this transaction so valid name swaps are allowed.
				tx.update(recipeCategories).set({ normalizedName: sql`char(0) || ${recipeCategories.id}` })
					.where(and(eq(recipeCategories.userId, userId), inArray(recipeCategories.id, renamedIds))).run();
			}
			for (const [sortOrder, category] of categories.entries()) {
				const values = { name: category.name, normalizedName: category.name.toLowerCase(), sortOrder };
				if (originalNames.has(category.id)) {
					tx.update(recipeCategories).set(values)
						.where(and(eq(recipeCategories.userId, userId), eq(recipeCategories.id, category.id))).run();
				} else {
					const inserted = tx.insert(recipeCategories).values({ id: category.id, userId, ...values }).onConflictDoNothing().run();
					if (!inserted.changes) throw new RecipeCategoryError('recipe_categories_changed', 409);
				}
			}
		});
		return Response.json({ categories });
	} catch (error) {
		if (error instanceof RecipeCategoryError) return recipeCategoryErrorResponse(error);
		throw error;
	}
};
