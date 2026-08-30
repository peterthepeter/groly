import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb, type OfflineSupplement } from '$lib/sync/db';
import {
	cacheTodayLogs,
	getOfflineTodayLogs,
	initSync,
	logSupplementOffline,
	mergePendingSupplementStock,
	onSupplementLogSynced
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

	it('keeps a confirmed log and stock when a stale GET started before the POST completed', async () => {
		const loggedAt = Date.now();
		const requestStartedAt = Date.now() - 10;
		const serverLog = {
			id: 'server-log-1',
			userId: 'user-1',
			supplementId: 'supplement-1',
			amount: 1,
			loggedAt,
			note: null,
			clientLogId: 'client-log-1',
			stockDeducted: 1,
			createdAt: loggedAt
		};
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
			ok: true,
			json: async () => ({ id: serverLog.id, log: serverLog, stockQuantity: 49 })
		}));
		await offlineDb.supplements.put({ ...supplement(50), userId: 'user-1' });
		initSync('user-1');

		await logSupplementOffline({
			supplementId: 'supplement-1',
			amount: 1,
			loggedAt,
			note: null,
			clientLogId: 'client-log-1'
		});
		await vi.waitFor(async () => expect(await offlineDb.pendingMutations.count()).toBe(0));

		const mergedSupplements = await mergePendingSupplementStock([supplement(50)], requestStartedAt);
		expect(mergedSupplements[0].stockQuantity).toBe(49);

		const mergedLogs = await cacheTodayLogs([], requestStartedAt);
		expect(mergedLogs).toHaveLength(1);
		expect(mergedLogs[0]).toMatchObject({ id: 'server-log-1', clientLogId: 'client-log-1' });
		expect(await getOfflineTodayLogs()).toHaveLength(1);
	});

	it('replaces the local client row with one server row instead of duplicating it', async () => {
		const loggedAt = Date.now();
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		await offlineDb.supplements.put({ ...supplement(50), userId: 'user-1' });
		initSync('user-1');
		await logSupplementOffline({
			supplementId: 'supplement-1', amount: 1, loggedAt, note: null, clientLogId: 'client-log-1'
		});

		const merged = await cacheTodayLogs([{
			id: 'server-log-1',
			userId: 'user-1',
			supplementId: 'supplement-1',
			amount: 1,
			loggedAt,
			note: null,
			clientLogId: 'client-log-1'
		}], Date.now());

		expect(merged).toHaveLength(1);
		expect(merged[0].id).toBe('server-log-1');
		expect(await getOfflineTodayLogs()).toHaveLength(1);
	});

	it('keeps later optimistic deductions while an earlier log is being confirmed', async () => {
		let releaseFirst!: () => void;
		const firstGate = new Promise<void>(resolve => { releaseFirst = resolve; });
		const fetchMock = vi.fn().mockImplementation(async (_url: string, init?: RequestInit) => {
			const payload = JSON.parse(String(init?.body)) as { clientLogId: string; loggedAt: number };
			if (payload.clientLogId === 'client-log-1') await firstGate;
			const first = payload.clientLogId === 'client-log-1';
			return {
				ok: true,
				json: async () => ({
					id: first ? 'server-log-1' : 'server-log-2',
					log: {
						id: first ? 'server-log-1' : 'server-log-2',
						userId: 'user-1', supplementId: 'supplement-1', amount: 1,
						loggedAt: payload.loggedAt, note: null, clientLogId: payload.clientLogId,
						stockDeducted: 1, createdAt: payload.loggedAt
					},
					stockQuantity: first ? 49 : 48
				})
			};
		});
		vi.stubGlobal('fetch', fetchMock);
		await offlineDb.supplements.put({ ...supplement(50), userId: 'user-1' });
		initSync('user-1');
		const observedStocks: Array<number | null> = [];
		const unsubscribe = onSupplementLogSynced(result => observedStocks.push(result.stockQuantity));

		await logSupplementOffline({ supplementId: 'supplement-1', amount: 1, loggedAt: Date.now(), note: null, clientLogId: 'client-log-1' });
		await logSupplementOffline({ supplementId: 'supplement-1', amount: 1, loggedAt: Date.now(), note: null, clientLogId: 'client-log-2' });
		expect((await offlineDb.supplements.get('supplement-1'))?.stockQuantity).toBe(48);
		releaseFirst();
		await vi.waitFor(async () => expect(await offlineDb.pendingMutations.count()).toBe(0));

		expect(observedStocks).toEqual([48, 48]);
		expect((await offlineDb.supplements.get('supplement-1'))?.stockQuantity).toBe(48);
		unsubscribe();
	});
});
