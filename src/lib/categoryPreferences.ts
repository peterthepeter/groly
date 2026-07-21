import { isValidCategoryKey } from '$lib/categories';
import { normalizeItemName } from '$lib/itemResolver';

export type CategoryPreferenceValue = {
	normalizedName: string;
	categoryOverride: string;
	updatedAt: number;
};

export type CategoryPreferenceAction =
	| { type: 'unchanged' }
	| { type: 'set'; categoryOverride: string }
	| { type: 'delete' };

export function normalizeCategoryPreferenceName(name: string): string {
	return normalizeItemName(name);
}

export function resolveCategoryOverrideForCreate(
	name: string,
	favoriteOverride: unknown,
	preferences: ReadonlyMap<string, string>
): string | null {
	if (isValidCategoryKey(favoriteOverride)) return favoriteOverride;
	const learned = preferences.get(normalizeCategoryPreferenceName(name));
	return isValidCategoryKey(learned) ? learned : null;
}

export function getCategoryPreferenceAction(
	categoryPickerUsed: boolean,
	categoryOverride: unknown
): CategoryPreferenceAction {
	if (!categoryPickerUsed) return { type: 'unchanged' };
	if (categoryOverride === null) return { type: 'delete' };
	return isValidCategoryKey(categoryOverride)
		? { type: 'set', categoryOverride }
		: { type: 'unchanged' };
}
