import { describe, expect, it } from 'vitest';
import { toAddedItemEventPayload, toUpdatedItemEventPayload } from '$lib/server/itemEventPayload';

const item = {
	id: 'item-1',
	listId: 'list-1',
	name: 'Magentabletten',
	quantityInfo: null,
	isChecked: false,
	checkedAt: null,
	categoryOverride: 'koerperpflege',
	createdBy: 'user-1',
	createdAt: 100,
	updatedAt: 101
};

describe('item SSE payload compatibility', () => {
	it('keeps the established item_added payload fields', () => {
		expect(toAddedItemEventPayload(item, 'alice')).toEqual({
			id: 'item-1',
			listId: 'list-1',
			name: 'Magentabletten',
			quantityInfo: null,
			isChecked: false,
			checkedAt: null,
			categoryOverride: 'koerperpflege',
			createdBy: 'user-1',
			createdByUsername: 'alice',
			createdAt: 100,
			updatedAt: 101
		});
	});

	it('keeps learning data out of the established item_updated payload', () => {
		expect(toUpdatedItemEventPayload(item, 'alice')).toEqual({
			id: 'item-1',
			name: 'Magentabletten',
			quantityInfo: null,
			isChecked: false,
			checkedAt: null,
			categoryOverride: 'koerperpflege',
			createdByUsername: 'alice',
			updatedAt: 101
		});
	});
});
