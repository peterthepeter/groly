import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb } from '$lib/sync/db';
import {
	deleteCategoryPreferenceOffline,
	drainPendingMutations,
	getCategoryOverrideForCreate,
	getOfflineCategoryPreferences,
	initSync,
	refreshCategoryPreferences,
	setCategoryPreferenceOffline
} from '$lib/sync/manager';

function jsonResponse(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});
}

describe('offline category preferences', () => {
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

	it('keeps learned categories and offline creation strictly separated by user', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));

		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Magentabletten', 'koerperpflege');
		initSync('user-b');
		await setCategoryPreferenceOffline('user-b', 'Magentabletten', 'haushalt');

		expect(await getCategoryOverrideForCreate('user-a', 'Magentabletten')).toBe('koerperpflege');
		expect(await getCategoryOverrideForCreate('user-b', 'Magentabletten')).toBe('haushalt');
		expect(await getCategoryOverrideForCreate('user-a', 'Magentabletten', 'snacks')).toBe('snacks');
	});

	it('persists the user-scoped cache across an IndexedDB reload', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Crème fraîche', 'milch');

		offlineDb.close();
		await offlineDb.open();

		expect(await getCategoryOverrideForCreate('user-a', 'Creme fraiche')).toBe('milch');
	});

	it('retries an idempotent set mutation and removes it only after success', async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('timeout'));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Magentabletten', 'koerperpflege');
		expect(await offlineDb.pendingMutations.count()).toBe(1);

		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		await drainPendingMutations();

		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(fetchMock).toHaveBeenLastCalledWith('/api/category-preferences', expect.objectContaining({ method: 'PUT' }));
	});

	it('keeps a preference mutation after transient proxy-style 403 responses', async () => {
		const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Magentabletten', 'koerperpflege');

		fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'blocked upstream' }, 403));
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(1);

		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('deletes locally immediately and retries an idempotent delete mutation', async () => {
		const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Magentabletten', 'koerperpflege');

		fetchMock.mockRejectedValueOnce(new TypeError('offline'));
		await deleteCategoryPreferenceOffline('user-a', 'Magentabletten');
		expect((await getOfflineCategoryPreferences('user-a')).has('magentabletten')).toBe(false);
		expect(await offlineDb.pendingMutations.count()).toBe(1);

		fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true }));
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('never drains another user’s queued preference under the active account', async () => {
		const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-a');
		await setCategoryPreferenceOffline('user-a', 'Artikel A', 'snacks');
		initSync('user-b');
		await setCategoryPreferenceOffline('user-b', 'Artikel B', 'haushalt');

		fetchMock.mockReset().mockImplementation(async () => jsonResponse({ ok: true }));
		await drainPendingMutations();
		const remaining = await offlineDb.pendingMutations.toArray();
		expect(remaining).toHaveLength(1);
		expect(remaining[0].userId).toBe('user-a');
		expect(fetchMock).toHaveBeenCalledTimes(1);

		initSync('user-a');
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('hands the drain safely to a newly active user while a request is in flight', async () => {
		await offlineDb.pendingMutations.bulkAdd([
			{ type: 'set_category_preference', userId: 'user-a', payload: { name: 'artikel a', categoryOverride: 'snacks' }, createdAt: 1 },
			{ type: 'set_category_preference', userId: 'user-b', payload: { name: 'artikel b', categoryOverride: 'haushalt' }, createdAt: 2 }
		]);
		let resolveFirst!: (response: Response) => void;
		const fetchMock = vi.fn()
			.mockImplementationOnce(() => new Promise<Response>(resolve => { resolveFirst = resolve; }))
			.mockImplementation(async () => jsonResponse({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);

		initSync('user-a');
		const firstDrain = drainPendingMutations();
		await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
		initSync('user-b');
		const secondDrain = drainPendingMutations();
		resolveFirst(jsonResponse({ ok: true }));
		await Promise.all([firstDrain, secondDrain]);

		expect(fetchMock).toHaveBeenCalledTimes(2);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('overlays a pending delete on a stale server response during reload sync', async () => {
		await offlineDb.categoryPreferences.put({
			userId: 'user-a', normalizedName: 'magentabletten', categoryOverride: 'koerperpflege', updatedAt: 1
		});
		const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('offline'));
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-a');
		await deleteCategoryPreferenceOffline('user-a', 'Magentabletten');

		fetchMock
			.mockRejectedValueOnce(new TypeError('still offline during drain'))
			.mockResolvedValueOnce(jsonResponse([
				{ normalizedName: 'magentabletten', categoryOverride: 'koerperpflege', updatedAt: 10 }
			]));
		await refreshCategoryPreferences('user-a');

		expect((await getOfflineCategoryPreferences('user-a')).has('magentabletten')).toBe(false);
		expect(await offlineDb.pendingMutations.count()).toBe(1);
	});

	it('refreshes only the active user’s server cache', async () => {
		await offlineDb.categoryPreferences.bulkPut([
			{ userId: 'user-a', normalizedName: 'alt', categoryOverride: 'snacks', updatedAt: 1 },
			{ userId: 'user-b', normalizedName: 'privat', categoryOverride: 'haushalt', updatedAt: 1 }
		]);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse([
			{ normalizedName: 'Neu', categoryOverride: 'milch', updatedAt: 10 }
		])));
		initSync('user-a');
		await refreshCategoryPreferences('user-a');

		expect(await getOfflineCategoryPreferences('user-a')).toEqual(new Map([['neu', 'milch']]));
		expect(await getOfflineCategoryPreferences('user-b')).toEqual(new Map([['privat', 'haushalt']]));
	});
});
