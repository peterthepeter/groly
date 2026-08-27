import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb, type OfflineSupplement } from '$lib/sync/db';
import {
	initSync,
	logSupplementOffline,
	mergePendingSupplementStock
} from '$lib/sync/manager';

function supplement(stockQuantity: number | null): OfflineSupplement {
	return {
		id: 'supplement-1',
		name: 'Magnesium',
		unit: 'piece',
		brand: null,
		active: true,
		defaultAmount: 1,
		stockQuantity,
		notes: null,
		nutrients: [],
		sortOrder: 0,
		updatedAt: 1
	};
}

describe('optimistic supplement stock', () => {
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

	it('persists the log, queue entry and decremented stock before sync', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		await offlineDb.supplements.put(supplement(50));
		initSync('user-1');

		await logSupplementOffline({
			supplementId: 'supplement-1',
			amount: 1,
			loggedAt: 1_000,
			note: null,
			clientLogId: 'client-log-1'
		});

		expect(await offlineDb.supplements.get('supplement-1')).toMatchObject({ stockQuantity: 49 });
		expect(await offlineDb.supplementLogs.get('client-log-1')).toMatchObject({ amount: 1 });
		expect(await offlineDb.pendingMutations.where('type').equals('create_supplement_log').count()).toBe(1);
	});

	it('clamps optimistic stock at zero', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		await offlineDb.supplements.put(supplement(2));
		initSync('user-1');

		await logSupplementOffline({
			supplementId: 'supplement-1',
			amount: 5,
			loggedAt: 1_000,
			note: null,
			clientLogId: 'client-log-1'
		});

		expect((await offlineDb.supplements.get('supplement-1'))?.stockQuantity).toBe(0);
	});

	it('keeps optimistic stock when a stale server read races with a pending log', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		await offlineDb.supplements.put(supplement(50));
		initSync('user-1');
		await logSupplementOffline({
			supplementId: 'supplement-1',
			amount: 1,
			loggedAt: 1_000,
			note: null,
			clientLogId: 'client-log-1'
		});

		const merged = await mergePendingSupplementStock([supplement(50)]);
		expect(merged[0].stockQuantity).toBe(49);
	});
});
