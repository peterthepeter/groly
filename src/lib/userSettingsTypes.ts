import type { AvailableLanguageTag } from '$lib/paraglide/runtime';
import { DEFAULT_CATEGORY_ORDER } from '$lib/categories';

export type UserSettings = {
	lang?: AvailableLanguageTag;
	categorySortEnabled?: boolean;
	categoryOrder?: string[];
};

export const DEFAULT_SETTINGS = {
	lang: 'de' as AvailableLanguageTag,
	categorySortEnabled: true,
	categoryOrder: [...DEFAULT_CATEGORY_ORDER]
};
