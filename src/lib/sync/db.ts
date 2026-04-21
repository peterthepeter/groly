import Dexie, { type EntityTable } from 'dexie';

interface OfflineList {
	id: string;
	name: string;
	description: string | null;
	ownerId: string;
	openCount: number;
	updatedAt: number;
}

interface OfflineItem {
	id: string;
	listId: string;
	name: string;
	quantityInfo: string | null;
	isChecked: boolean;
	checkedAt: number | null;
	categoryOverride: string | null;
	updatedAt: number;
}

interface PendingMutation {
	id?: number;
	type:
		| 'create_list'
		| 'update_list'
		| 'delete_list'
		| 'create_item'
		| 'update_item'
		| 'delete_item'
		| 'create_supplement_log'
		| 'delete_supplement_log';
	payload: Record<string, unknown>;
	createdAt: number;
}

interface OfflineSupplement {
	id: string;
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
}

interface OfflineSupplementLog {
	id: string;
	supplementId: string;
	amount: number;
	loggedAt: number;
}

interface OfflineRecipe {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	updatedAt: number;
}

interface OfflineRecipeDetail extends OfflineRecipe {
	sourceUrl: string | null;
	ingredients: { id: string; amount: number | null; unit: string | null; name: string; sortOrder: number }[];
	steps: { id: string; stepNumber: number; text: string }[];
}

class GrolydDb extends Dexie {
	lists!: EntityTable<OfflineList, 'id'>;
	items!: EntityTable<OfflineItem, 'id'>;
	pendingMutations!: EntityTable<PendingMutation, 'id'>;
	supplements!: EntityTable<OfflineSupplement, 'id'>;
	supplementLogs!: EntityTable<OfflineSupplementLog, 'id'>;
	recipes!: EntityTable<OfflineRecipe, 'id'>;
	recipeDetails!: EntityTable<OfflineRecipeDetail, 'id'>;

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
	OfflineRecipeDetail
};
