import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb } from './db';
import { cacheFavorites, drainPendingMutations, getOfflineFavorites, initSync, refreshUserSettings, setFavoriteOffline } from './manager';

const favorite = { name: 'Milch', quantityInfo: '1 l', categoryOverride: 'milch' };
describe('offline favorites', () => {
	beforeEach(async () => {
		initSync(null);
		vi.restoreAllMocks(); vi.unstubAllGlobals();
		offlineDb.close(); await offlineDb.delete(); await offlineDb.open();
	});
	afterAll(async () => { initSync(null); offlineDb.close(); await offlineDb.delete(); });
	it('keeps the cached catalog across reload and language/settings refresh, scoped to the account', async () => {
		await cacheFavorites('a', [favorite]);
		offlineDb.close(); await offlineDb.open();
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		await refreshUserSettings('a', { settings: { lang: 'en' }, settingsRevision: 2 });
		expect(await getOfflineFavorites('a')).toEqual([favorite]);
		expect(await getOfflineFavorites('b')).toBeNull();
	});
	it('persists offline additions/removals and overlays them on stale server responses', async () => {
		await cacheFavorites('a', [favorite]);
		await setFavoriteOffline('a', favorite, true);
		const bread = { name: 'Brot', quantityInfo: null, categoryOverride: null };
		await setFavoriteOffline('a', bread);
		expect(await cacheFavorites('a', [favorite])).toEqual([bread]);
		vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(new Response('{"ok":true}', { headers: { 'Content-Type': 'application/json' } }))));
		initSync('a'); await drainPendingMutations();
		expect(fetch).toHaveBeenCalledTimes(2);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await getOfflineFavorites('a')).toEqual([bread]);
	});
	it('retains favorites through a transient proxy rejection and does not sync another account', async () => {
		await setFavoriteOffline('a', favorite);
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 403 })));
		initSync('b'); await drainPendingMutations(); expect(fetch).not.toHaveBeenCalled();
		initSync('a'); await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(1);
		expect(await getOfflineFavorites('a')).toEqual([favorite]);
	});
	it('renames a favorite atomically offline and keeps the rename through reload and a stale server read', async () => {
		await cacheFavorites('a', [favorite]);
		const edited = { name: 'Hafermilch', quantityInfo: '2 l', categoryOverride: 'getraenke' };
		await setFavoriteOffline('a', edited, false, favorite.name);
		offlineDb.close(); await offlineDb.open();
		expect(await getOfflineFavorites('a')).toEqual([edited]);
		expect(await cacheFavorites('a', [favorite])).toEqual([edited]);
		const request = vi.fn(async (_url: string, _options?: RequestInit) => new Response('{"ok":true}'));
		vi.stubGlobal('fetch', request);
		initSync('a'); await drainPendingMutations();
		expect(request).toHaveBeenCalledTimes(1);
		expect(JSON.parse(String(request.mock.calls[0][1]?.body))).toEqual({ ...edited, previousName: 'Milch' });
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await getOfflineFavorites('a')).toEqual([edited]);
	});
	it('keeps confirmed favorites when an earlier server read completes after queue acknowledgement', async () => {
		await setFavoriteOffline('a', favorite);
		const started = Date.now();
		vi.stubGlobal('fetch', vi.fn(async () => new Response('{"ok":true}')));
		initSync('a'); await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await cacheFavorites('a', [], started)).toEqual([favorite]);
		const newerRead = (await offlineDb.userSettings.get('a'))!.favoritesUpdatedAt! + 1;
		expect(await cacheFavorites('a', [], newerRead)).toEqual([]);
	});
	it('does not let a later removal overtake an addition rejected by a proxy', async () => {
		await setFavoriteOffline('a', favorite);
		await setFavoriteOffline('a', favorite, true);
		let names: string[] = [];
		vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
			if (options.method === 'DELETE') names = [];
			return new Response('{}', { status: 403 });
		}));
		initSync('a'); await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(2);
		expect(fetch).toHaveBeenCalledTimes(1);
		vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
			names = options.method === 'POST' ? [favorite.name] : [];
			return new Response('{"ok":true}');
		}));
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(names).toEqual([]);
	});
});
