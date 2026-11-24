type ItemEventSource = {
	id: string;
	listId: string;
	name: string;
	quantityInfo: string | null;
	isChecked: boolean;
	checkedAt: number | null;
	categoryOverride: string | null;
	sectionId?: string | null;
	checklistPosition?: number | null;
	checklistNote?: string | null;
	createdBy: string | null;
	createdAt: number;
	updatedAt: number;
};

export function toAddedItemEventPayload(item: ItemEventSource, createdByUsername: string | null) {
	return {
		id: item.id,
		listId: item.listId,
		name: item.name,
		quantityInfo: item.quantityInfo,
		isChecked: item.isChecked,
		checkedAt: item.checkedAt,
		categoryOverride: item.categoryOverride,
		...(item.checklistPosition !== undefined ? { checklistPosition: item.checklistPosition } : {}),
		...(item.sectionId !== undefined ? { sectionId: item.sectionId } : {}),
		...(item.checklistNote !== undefined ? { checklistNote: item.checklistNote } : {}),
		createdBy: item.createdBy,
		createdByUsername,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt
	};
}

export function toUpdatedItemEventPayload(item: ItemEventSource, createdByUsername: string | null) {
	return {
		id: item.id,
		name: item.name,
		quantityInfo: item.quantityInfo,
		isChecked: item.isChecked,
		checkedAt: item.checkedAt,
		categoryOverride: item.categoryOverride,
		...(item.checklistPosition !== undefined ? { checklistPosition: item.checklistPosition } : {}),
		...(item.sectionId !== undefined ? { sectionId: item.sectionId } : {}),
		...(item.checklistNote !== undefined ? { checklistNote: item.checklistNote } : {}),
		createdByUsername,
		updatedAt: item.updatedAt
	};
}
