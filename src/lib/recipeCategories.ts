export type RecipeCategory = { id: string; name: string };
export type RecipeCategoryChoice = { categoryId: string | null } | { newCategoryName: string };

export const RECIPE_CATEGORY_LIMIT = 50;
export const RECIPE_CATEGORY_NAME_LIMIT = 80;

export function parseRecipeCategoryName(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const name = value.trim();
	return name && name.length <= RECIPE_CATEGORY_NAME_LIMIT && !/[\u0000-\u001f\u007f]/u.test(name) ? name : null;
}

export function recipeCategoryChoiceValid(choice: RecipeCategoryChoice): boolean {
	return !('newCategoryName' in choice) || parseRecipeCategoryName(choice.newCategoryName) !== null;
}

export function recipeCategoryDraftValid(categories: RecipeCategory[]): boolean {
	const names = categories.map(category => parseRecipeCategoryName(category.name)?.toLowerCase());
	return names.every(Boolean) && new Set(names).size === names.length;
}
