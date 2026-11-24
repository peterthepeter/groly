import { t } from '#lib/i18n.svelte';
import type { RecipeCategory } from '#lib/recipeCategories';
import { cacheRecipeCategories, getOfflineRecipeCategories } from '#lib/sync/manager';

export async function loadRecipeCategoryCatalog(userId: string | null, signal?: AbortSignal): Promise<RecipeCategory[]> {
	const response = await fetch('/api/recipes/categories', { signal });
	if (!response.ok) throw new Error('Could not load recipe categories');
	const { categories }: { categories: RecipeCategory[] } = await response.json();
	void cacheRecipeCategories(categories, userId).catch(() => {});
	return categories;
}

export async function loadRecipeCategoryChoices(userId: string | null, signal: AbortSignal): Promise<RecipeCategory[]> {
	try {
		return await loadRecipeCategoryCatalog(userId, signal);
	} catch (error) {
		if (signal.aborted) throw error;
		const categories = await getOfflineRecipeCategories(userId);
		if (!categories) throw error;
		return categories;
	}
}

export function recipeCategoryErrorMessage(code: unknown): string | undefined {
	switch (code) {
		case 'recipe_categories_changed': return t.recipe_categories_changed;
		case 'recipe_category_unavailable': return t.recipe_category_unavailable;
		case 'recipe_category_limit': return t.recipe_category_limit;
		case 'invalid_recipe_category': return t.recipe_category_invalid;
	}
}
