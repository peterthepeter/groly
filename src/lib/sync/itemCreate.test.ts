import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb, type OfflineItem } from '$lib/sync/db';
import { drainPendingMutations, getPendingCreateItems, initSync, queueItemCreate } from '$lib/sync/manager';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

function item(id: string, name: string): OfflineItem {
	return {
		id,
		listId: 'list-1',
		name,
		quantityInfo: null,
		isChecked: false,
		checkedAt: null,
		categoryOverride: null,
		updatedAt: 100
	};
}

async function queue(id: string, name: string) {
	await queueItemCreate('user-1', item(id, name), {
		id,
		listId: 'list-1',
		name,
		quantityInfo: '',
		categoryOverride: null
	});
}

describe('local-first item creation', () => {
	beforeEach(async () => {
		initSync(null);
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		offlineDb.close();
		await offlineDb.delete();
		await offlineDb.open();
	});

	afterAll(async () => {
		initSync(null);
		offlineDb.close();
		await offlineDb.delete();
	});

	it('commits the item and mutation together before a network retry', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		initSync('user-1');
		await queue('item-1', 'Hafermilch');
		await vi.waitFor(async () => expect(await offlineDb.pendingMutations.count()).toBe(1));

		offlineDb.close();
		await offlineDb.open();

		expect(await offlineDb.items.get('item-1')).toMatchObject({ name: 'Hafermilch', listId: 'list-1' });
		expect(await getPendingCreateItems('user-1', 'list-1')).toEqual([
		expect.objectContaining({ id: 'item-1', name: 'Hafermilch' })
		]);
	});

	it('runs a follow-up drain when another rapid item is queued during sync', async () => {
		let resolveFirst!: (response: Response) => void;
		const fetchMock = vi.fn()
			.mockImplementationOnce(() => new Promise<Response>((resolve) => { resolveFirst = resolve; }))
			.mockResolvedValue(jsonResponse({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-1');

		await queue('item-1', 'Milch');
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		await queue('item-2', 'Brot');
		resolveFirst(jsonResponse({ ok: true }));
		await drainPendingMutations();

		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});
});
