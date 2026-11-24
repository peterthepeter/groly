import type { Locale } from '#lib/paraglide/runtime';
import type { DateFormat, TimeFormat } from '#lib/dates';
import { DEFAULT_CATEGORY_ORDER } from '#lib/categories';

export type ItemSortDirection = 'az' | 'za';
export type ShoppingItemSortMode = 'category' | ItemSortDirection | 'off';

export type ListCategorySettings = {
	enabled: boolean;
	order: string[];
	itemSortDirection?: ItemSortDirection | null;
};

export function resolveShoppingItemSortMode(categoryEnabled: boolean, direction?: ItemSortDirection | null): ShoppingItemSortMode {
	if (direction === 'az' || direction === 'za') return direction;
	return categoryEnabled ? 'category' : 'off';
}

export type ShortcutAction = 'go' | 'add' | 'scanner' | 'log-tracker' | 'log-supplement';

export type Shortcut = {
	id: string;
	name: string;
	listId?: string;
	listName?: string;
	action: ShortcutAction;
};

export type UserSettings = {
	lang?: Locale;
	timeZone?: string;
	dateFormat?: DateFormat;
	timeFormat?: TimeFormat;
	/** Read the previous local checklist preferences during the first initialization. */
	checklistDateFormat?: DateFormat;
	checklistTimeFormat?: TimeFormat;
	theme?: 'system' | 'light' | 'dark';
	colorScheme?: 'forest' | 'classic' | 'indigo';
	categorySortEnabled?: boolean;
	categoryOrder?: string[];
	itemSortDirection?: ItemSortDirection | null;
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
	moodTrackerEnabled?: boolean;
	moodWeeklyReviewEnabled?: boolean;
	dismissedMoodWeeklyReviewWeek?: string;
	nutritionTrackerEnabled?: boolean;
	hiddenMoodTags?: string[];
	greetingEnabled?: boolean;
	wakeLockLists?: boolean;
	wakeLockRecipes?: boolean;
	wakeLockMeditation?: boolean;
};

export const DEFAULT_SETTINGS = {
	lang: 'de' as Locale,
	categorySortEnabled: true,
	categoryOrder: [...DEFAULT_CATEGORY_ORDER]
};
