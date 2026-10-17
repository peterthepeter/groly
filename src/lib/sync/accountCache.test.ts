import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb } from './db';
import { migrateAccountCache } from './accountCache';
import { cacheListsData, cacheItemsData, cacheRecipes, cacheRecipeDetail, cacheWaterLogs, cacheCaffeineLogs, cacheMeditationLogs, drainPendingMutations, getOfflineLists, getOfflineItems, getOfflineRecipes, getOfflineRecipeDetail, getOfflineWaterLogsToday, getOfflineCaffeineLogsToday, getOfflineMeditationLogsToday, initSync, queueItemUpdate } from './manager';

beforeEach(async () => {
	initSync(null); vi.restoreAllMocks(); vi.unstubAllGlobals();
	offlineDb.close(); await offlineDb.delete(); await offlineDb.open();
});
afterAll(async () => { initSync(null); offlineDb.close(); await offlineDb.delete(); });

describe('private offline caches', () => {
	it('retains independent views of a shared list and keeps unsent edits with their author', async () => {
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		const list = { id: 'shared-list', ownerId: 'alice', name: 'Shared', description: null, openCount: 1, updatedAt: 1 };
		const item = { id: 'shared-item', listId: list.id, name: 'Milk', quantityInfo: null, categoryOverride: null, isChecked: false, checkedAt: null, updatedAt: 1 };
		initSync('alice'); await cacheListsData([list]); await cacheItemsData([item]);
		await queueItemUpdate('alice', item.id, { name: 'Alice unsent change' });
		initSync('bob'); await cacheListsData([list]); await cacheItemsData([item]);
		expect((await getOfflineItems(list.id))[0].name).toBe('Milk');
		initSync('alice');
		expect(await getOfflineLists()).toHaveLength(1);
		expect((await getOfflineItems(list.id))[0].name).toBe('Alice unsent change');
		expect((await offlineDb.pendingMutations.toArray())[0].userId).toBe('alice');
		initSync('bob'); await cacheListsData([], 'bob', true);
		expect(await getOfflineLists()).toEqual([]);
		expect(await getOfflineItems(list.id)).toEqual([]);
		initSync('alice'); expect(await getOfflineItems(list.id)).toHaveLength(1);
	});

	it('isolates lists, recipes, details and tracker logs across account switches and reloads', async () => {
		initSync('alice');
		await cacheListsData([{ id: 'list-a', ownerId: 'alice', name: 'Private list', description: null, openCount: 0, updatedAt: 1 }]);
		const recipe = { id: 'recipe-a', title: 'Private recipe', description: null, imageUrl: null, servings: 2, prepTime: null, cookTime: null, updatedAt: 1 };
		await cacheRecipes([recipe]);
		await cacheRecipeDetail({ ...recipe, sourceUrl: null, ingredients: [], steps: [] });
		await cacheWaterLogs([{ id: 'water-a', amountMl: 250, loggedAt: Date.now() }]);
		await cacheCaffeineLogs([{ id: 'coffee-a', drinkName: 'Coffee', caffeineMg: 80, amountMl: 125, loggedAt: Date.now() }]);
		await cacheMeditationLogs([{ id: 'meditation-a', durationSeconds: 300, loggedAt: Date.now() }]);
		initSync('bob');
		expect(await getOfflineLists()).toEqual([]);
		expect(await getOfflineRecipes()).toEqual([]);
		expect(await getOfflineRecipeDetail(recipe.id)).toBeUndefined();
		expect(await getOfflineWaterLogsToday()).toEqual([]);
		expect(await getOfflineCaffeineLogsToday()).toEqual([]);
		expect(await getOfflineMeditationLogsToday()).toEqual([]);
		initSync(null);
		expect(await getOfflineLists()).toEqual([]);
		offlineDb.close(); await offlineDb.open();
		initSync('alice');
		expect(await getOfflineLists()).toHaveLength(1);
		expect(await getOfflineRecipes()).toHaveLength(1);
		expect(await getOfflineRecipeDetail(recipe.id)).toBeDefined();
		expect(await getOfflineWaterLogsToday()).toHaveLength(1);
	});

	it('keeps a delayed response assigned to its originating account', async () => {
		initSync('bob');
		await cacheRecipes([{ id: 'late-a', title: 'Alice', description: null, imageUrl: null, servings: 1, prepTime: null, cookTime: null, updatedAt: 1 }], 'alice');
		expect(await getOfflineRecipes()).toEqual([]);
		initSync('alice');
		expect(await getOfflineRecipes()).toHaveLength(1);
	});

	it('upgrades a version-7 IndexedDB without losing or misassigning old queued writes', async () => {
		offlineDb.close(); await offlineDb.delete();
		const legacy = new Dexie('groly');
		legacy.version(7).stores({
			lists: 'id, ownerId, updatedAt', items: 'id, listId, isChecked, updatedAt', pendingMutations: '++id, type, userId, createdAt',
			supplements: 'id, updatedAt', supplementLogs: 'id, supplementId, loggedAt', recipes: 'id, updatedAt', recipeDetails: 'id',
			waterLogs: 'id, loggedAt', caffeineLogs: 'id, loggedAt', meditationLogs: 'id, loggedAt', caffeineDrinks: 'id, sortOrder',
			categoryPreferences: '[userId+normalizedName], userId, updatedAt', userSettings: 'userId, updatedAt'
		});
		await legacy.table('pendingMutations').add({ type: 'create_water_log', payload: { clientLogId: 'legacy-log', amountMl: 250, loggedAt: Date.now() }, createdAt: Date.now() });
		await legacy.table('waterLogs').add({ id: 'legacy-log', amountMl: 250, loggedAt: Date.now() });
		legacy.close(); await offlineDb.open();
		await migrateAccountCache('alice');
		const fetchMock = vi.fn().mockResolvedValue(Response.json({ ok: true })); vi.stubGlobal('fetch', fetchMock);
		initSync('bob'); await drainPendingMutations();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await offlineDb.pendingMutations.count()).toBe(1);
		expect(await getOfflineWaterLogsToday()).toEqual([]);
		// A later account cannot steal the legacy migration by running it again.
		await migrateAccountCache('bob');
		initSync('alice');
		expect(await getOfflineWaterLogsToday()).toHaveLength(1);
		await drainPendingMutations();
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][1].headers['X-Groly-User']).toBe('alice');
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('preserves writes with unknown legacy ownership instead of sending them as the next user', async () => {
		await offlineDb.pendingMutations.add({ type: 'create_water_log', payload: { amountMl: 250, loggedAt: Date.now() }, createdAt: Date.now() });
		await migrateAccountCache(null);
		const fetchMock = vi.fn(); vi.stubGlobal('fetch', fetchMock);
		initSync('bob'); await drainPendingMutations();
		expect(fetchMock).not.toHaveBeenCalled();
		expect(await offlineDb.pendingMutations.count()).toBe(1);
	});
});
