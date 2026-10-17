import Dexie, { type EntityTable, type Table } from 'dexie';

export interface AccountCache {
	cacheUserId?: string;
	userId?: string;
}

interface OfflineList extends AccountCache {
	id: string;
	name: string;
	description: string | null;
	ownerId: string;
	openCount: number;
	updatedAt: number;
	locationLat?: number | null;
	locationLng?: number | null;
	locationName?: string | null;
}

interface OfflineItem extends AccountCache {
	id: string;
	listId: string;
	name: string;
	quantityInfo: string | null;
	isChecked: boolean;
	checkedAt: number | null;
	categoryOverride: string | null;
	updatedAt: number;
	localConfirmedAt?: number;
}

interface PendingMutation {
	id?: number;
	userId?: string;
	type:
		| 'create_list'
		| 'update_list'
		| 'delete_list'
		| 'create_item'
		| 'update_item'
		| 'delete_item'
		| 'create_supplement_log'
		| 'delete_supplement_log'
		| 'create_water_log'
		| 'create_caffeine_log'
		| 'create_meditation_log'
		| 'set_category_preference'
		| 'delete_category_preference'
		| 'set_favorite'
		| 'delete_favorite'
		| 'update_user_settings';
	payload: Record<string, unknown>;
	createdAt: number;
}

interface OfflineCategoryPreference {
	userId: string;
	normalizedName: string;
	categoryOverride: string;
	updatedAt: number;
}

interface OfflineUserSettings {
	userId: string;
	settings: Record<string, unknown>;
	revision: number;
	updatedAt: number;
	favorites?: OfflineFavorite[];
	favoritesUpdatedAt?: number;
}

interface OfflineFavorite {
	name: string;
	quantityInfo: string | null;
	categoryOverride: string | null;
}

interface OfflineSupplement extends AccountCache {
	id: string;
	userId?: string;
	name: string;
	unit: string;
	brand: string | null;
	active: boolean;
	defaultAmount: number;
	stockQuantity: number | null;
	notes: string | null;
	nutrients: unknown[];
	sortOrder: number;
	updatedAt: number;
	localStockUpdatedAt?: number;
}

interface OfflineSupplementLog extends AccountCache {
	id: string;
	userId?: string;
	supplementId: string;
	amount: number;
	loggedAt: number;
	note?: string | null;
	clientLogId?: string | null;
	stockDeducted?: number | null;
	createdAt?: number;
	localConfirmedAt?: number;
}

interface OfflineRecipe extends AccountCache {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	updatedAt: number;
	isFavorite?: boolean;
	rating?: number | null;
	cookCount?: number;
	lastCookedAt?: number | null;
	tags?: string[];
}

interface OfflineRecipeDetail extends OfflineRecipe {
	sourceUrl: string | null;
	ingredients: { id: string; amount: number | null; unit: string | null; name: string; sortOrder: number }[];
	steps: { id: string; stepNumber: number; text: string }[];
}

interface OfflineWaterLog extends AccountCache {
	id: string;
	amountMl: number;
	loggedAt: number;
	clientLogId?: string | null;
}

interface OfflineCaffeineLog extends AccountCache {
	id: string;
	drinkName: string;
	caffeineMg: number;
	amountMl: number;
	loggedAt: number;
	clientLogId?: string | null;
}

interface OfflineMeditationLog extends AccountCache {
	id: string;
	durationSeconds: number;
	loggedAt: number;
	clientLogId?: string | null;
}

interface OfflineCaffeineDrink {
	id: string;
	name: string;
	defaultMl: number;
	caffeineMg: number;
	sortOrder: number;
	createdAt: number;
}

class GrolydDb extends Dexie {
	lists!: EntityTable<OfflineList, 'id'>;
	items!: EntityTable<OfflineItem, 'id'>;
	pendingMutations!: EntityTable<PendingMutation, 'id'>;
	supplements!: EntityTable<OfflineSupplement, 'id'>;
	supplementLogs!: EntityTable<OfflineSupplementLog, 'id'>;
	recipes!: EntityTable<OfflineRecipe, 'id'>;
	recipeDetails!: EntityTable<OfflineRecipeDetail, 'id'>;
	waterLogs!: EntityTable<OfflineWaterLog, 'id'>;
	caffeineLogs!: EntityTable<OfflineCaffeineLog, 'id'>;
	meditationLogs!: EntityTable<OfflineMeditationLog, 'id'>;
	caffeineDrinks!: EntityTable<OfflineCaffeineDrink, 'id'>;
	categoryPreferences!: Table<OfflineCategoryPreference, [string, string]>;
	userSettings!: EntityTable<OfflineUserSettings, 'userId'>;
	cacheMeta!: EntityTable<{ key: string; value: string | null }, 'key'>;
	accountLists!: Table<OfflineList & { cacheUserId: string }, [string, string]>;
	accountItems!: Table<OfflineItem & { cacheUserId: string }, [string, string]>;

	constructor() {
		super('groly');
		this.version(1).stores({
			lists: 'id, ownerId, updatedAt',
			items: 'id, listId, isChecked, updatedAt',
			pendingMutations: '++id, type, createdAt'
		});
		this.version(2).stores({
			supplements: 'id, updatedAt',
			supplementLogs: 'id, supplementId, loggedAt',
			recipes: 'id, updatedAt',
			recipeDetails: 'id'
		});
		this.version(3).stores({
			waterLogs: 'id, loggedAt',
			caffeineLogs: 'id, loggedAt'
		});
		this.version(4).stores({
			meditationLogs: 'id, loggedAt'
		});
		this.version(5).stores({
			caffeineDrinks: 'id, sortOrder'
		});
		this.version(6).stores({
			pendingMutations: '++id, type, userId, createdAt',
			categoryPreferences: '[userId+normalizedName], userId, updatedAt'
		});
		this.version(7).stores({
			userSettings: 'userId, updatedAt'
		});
		this.version(8).stores({
			cacheMeta: 'key',
			accountLists: '[cacheUserId+id], cacheUserId',
			accountItems: '[cacheUserId+id], cacheUserId, [cacheUserId+listId]'
		});
	}
}

export const offlineDb = new GrolydDb();
export type {
	OfflineList,
	OfflineItem,
	PendingMutation,
	OfflineSupplement,
	OfflineSupplementLog,
	OfflineRecipe,
	OfflineRecipeDetail,
	OfflineWaterLog,
	OfflineCaffeineLog,
	OfflineMeditationLog,
	OfflineCaffeineDrink,
	OfflineCategoryPreference,
	OfflineUserSettings,
	OfflineFavorite
};
