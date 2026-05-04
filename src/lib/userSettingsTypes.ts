import type { AvailableLanguageTag } from '$lib/paraglide/runtime';
import { DEFAULT_CATEGORY_ORDER } from '$lib/categories';

export type ListCategorySettings = {
	enabled: boolean;
	order: string[];
};

export type ShortcutAction = 'go' | 'add' | 'scanner' | 'recipes' | 'mealplan';

export type Shortcut = {
	id: string;
	name: string;
	listId?: string;
	listName?: string;
	action: ShortcutAction;
};

export type UserSettings = {
	lang?: AvailableLanguageTag;
	theme?: 'system' | 'light' | 'dark';
	categorySortEnabled?: boolean;
	categoryOrder?: string[];
	listCategorySettings?: Record<string, ListCategorySettings>;
	shortcuts?: Shortcut[];
	locationNavEnabled?: boolean;
	listLocationDisabled?: string[];
	itemLayout?: 'grid' | 'list';
	showAllCheckedItems?: boolean;
	showFavoriteIndicator?: boolean;
	showSupplementTracker?: boolean;
	showRecipes?: boolean;
	supplementSortOrder?: 'az' | 'za' | 'freq';
	waterTrackerEnabled?: boolean;
	waterGoalMl?: number;
	waterPresets?: [number, number];
	caffeineTrackerEnabled?: boolean;
	caffeineLimitMg?: number;
	caffeineHiddenDrinks?: string[];
	caffeineCustomAmounts?: Record<string, number>;
	meditationTrackerEnabled?: boolean;
	meditationDailyGoalMinutes?: number;
	meditationDefaultDurationMinutes?: number;
	meditationPrepSeconds?: number;
	meditationStartSound?: string;
	meditationEndSound?: string;
	meditationVolume?: number;
};

export const DEFAULT_SETTINGS = {
	lang: 'de' as AvailableLanguageTag,
	categorySortEnabled: true,
	categoryOrder: [...DEFAULT_CATEGORY_ORDER]
};
