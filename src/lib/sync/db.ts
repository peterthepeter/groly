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
	updatedAt: number;
}

interface PendingMutation {
	id?: number;
	type: 'create_list' | 'update_list' | 'delete_list' | 'create_item' | 'update_item' | 'delete_item';
	payload: Record<string, unknown>;
	createdAt: number;
}

class GrolydDb extends Dexie {
	lists!: EntityTable<OfflineList, 'id'>;
	items!: EntityTable<OfflineItem, 'id'>;
	pendingMutations!: EntityTable<PendingMutation, 'id'>;

	constructor() {
		super('groly');
		this.version(1).stores({
			lists: 'id, ownerId, updatedAt',
			items: 'id, listId, isChecked, updatedAt',
			pendingMutations: '++id, type, createdAt'
		});
	}
}

export const offlineDb = new GrolydDb();
export type { OfflineList, OfflineItem, PendingMutation };
