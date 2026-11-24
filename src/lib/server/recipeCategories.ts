import { and, asc, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import type { db } from '#lib/db';
import { recipeCategories } from '#lib/db/schema';
import { parseRecipeCategoryName, RECIPE_CATEGORY_LIMIT, type RecipeCategory } from '#lib/recipeCategories';

type RecipeCategoryDatabase = Pick<typeof db, 'select' | 'insert'>;

export class RecipeCategoryError extends Error {
	constructor(readonly code: string, readonly status = 400) { super(code); }
}

export function recipeCategoryErrorResponse(error: RecipeCategoryError): Response {
	return Response.json({ code: error.code }, { status: error.status });
}

export function getRecipeCategories(database: RecipeCategoryDatabase, userId: string): RecipeCategory[] {
	return database.select({ id: recipeCategories.id, name: recipeCategories.name })
		.from(recipeCategories).where(eq(recipeCategories.userId, userId))
		.orderBy(asc(recipeCategories.sortOrder), asc(recipeCategories.id)).all();
}

export function getRecipeCategory(database: RecipeCategoryDatabase, userId: string, id: string): RecipeCategory | undefined {
	return database.select({ id: recipeCategories.id, name: recipeCategories.name })
		.from(recipeCategories).where(and(eq(recipeCategories.userId, userId), eq(recipeCategories.id, id))).get();
}

export function resolveRecipeCategory(database: RecipeCategoryDatabase, userId: string, choice: unknown): RecipeCategory | null {
	if (!choice || typeof choice !== 'object') throw new RecipeCategoryError('invalid_recipe_category');
	if ('newCategoryName' in choice) {
		const name = parseRecipeCategoryName(choice.newCategoryName);
		if (!name || 'categoryId' in choice) throw new RecipeCategoryError('invalid_recipe_category');
		const normalizedName = name.toLowerCase();
		const existing = database.select({ id: recipeCategories.id, name: recipeCategories.name })
			.from(recipeCategories).where(and(eq(recipeCategories.userId, userId), eq(recipeCategories.normalizedName, normalizedName))).get();
		if (existing) return existing;
		const rows = database.select({ sortOrder: recipeCategories.sortOrder }).from(recipeCategories)
			.where(eq(recipeCategories.userId, userId)).all();
		if (rows.length >= RECIPE_CATEGORY_LIMIT) throw new RecipeCategoryError('recipe_category_limit');
		const id = randomUUID();
		const sortOrder = Math.max(-1, ...rows.map(row => row.sortOrder)) + 1;
		database.insert(recipeCategories).values({ id, userId, name, normalizedName, sortOrder }).run();
		return { id, name };
	}
	if (!('categoryId' in choice)) throw new RecipeCategoryError('invalid_recipe_category');
	if (choice.categoryId === null) return null;
	if (typeof choice.categoryId !== 'string') throw new RecipeCategoryError('invalid_recipe_category');
	const category = getRecipeCategory(database, userId, choice.categoryId);
	if (!category) throw new RecipeCategoryError('recipe_category_unavailable', 409);
	return category;
}
