import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb, type OfflineItem } from '#lib/sync/db';
import { cacheItemsData, drainPendingMutations, getPendingCreateItems, initSync, queueItemCreate, queueItemUpdate, queueItemDelete } from '#lib/sync/manager';

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

	it('keeps offline list activity current for create, check and delete without touching another account', async () => {
		const row = { id: 'list-1', cacheUserId: 'user-1', ownerId: 'user-1', name: 'List', description: null, openCount: 1, updatedAt: 1 };
		await offlineDb.lists.put(row);
		await offlineDb.accountLists.put(row);
		await offlineDb.accountLists.put({ ...row, cacheUserId: 'user-2', updatedAt: 2 });
		await queue('item-1', 'Milk');
		expect((await offlineDb.accountLists.get(['user-1', 'list-1']))!.updatedAt).toBeGreaterThan(1);
		await offlineDb.accountLists.update(['user-1', 'list-1'], { updatedAt: 1 });
		await queueItemUpdate('user-1', 'item-1', { isChecked: true });
		expect((await offlineDb.accountLists.get(['user-1', 'list-1']))!.updatedAt).toBeGreaterThan(1);
		await offlineDb.accountLists.update(['user-1', 'list-1'], { updatedAt: 1 });
		await queueItemDelete('user-1', 'item-1');
		expect((await offlineDb.accountLists.get(['user-1', 'list-1']))!.updatedAt).toBeGreaterThan(1);
		expect((await offlineDb.accountLists.get(['user-2', 'list-1']))!.updatedAt).toBe(2);
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

	it('preserves legacy queued create-then-check intent after the server assigns a newer revision', async () => {
		await queue('item-1', 'Milch');
		await offlineDb.pendingMutations.add({ userId: 'user-1', type: 'update_item', payload: { id: 'item-1', isChecked: true, clientUpdatedAt: 100 }, createdAt: Date.now() });
		let checked = false;
		const fetchMock = vi.fn(async (_url, options) => {
			const body = JSON.parse(options.body);
			if (options.method === 'POST') return jsonResponse({ id: 'item-1', updatedAt: 200 });
			if (body.clientUpdatedAt !== 200) return jsonResponse({ error: 'conflict' }, 409);
			checked = body.isChecked;
			return jsonResponse({ ok: true, updatedAt: 201 });
		});
		vi.stubGlobal('fetch', fetchMock);
		initSync('user-1');
		await drainPendingMutations();
		expect(checked).toBe(true);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('rebases multiple offline edits in order without suppressing real remote conflicts', async () => {
		await offlineDb.items.put(item('item-1', 'Milch'));
		await queueItemUpdate('user-1', 'item-1', { isChecked: true, checkedAt: 101 });
		await queueItemUpdate('user-1', 'item-1', { name: 'Hafermilch' });
		await queueItemUpdate('user-1', 'item-1', { isChecked: false, checkedAt: null });
		let revision = 100;
		const accepted: unknown[] = [];
		vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
			const body = JSON.parse(options.body);
			if (body.clientUpdatedAt !== revision) return jsonResponse({ error: 'conflict' }, 409);
			accepted.push(body);
			return jsonResponse({ ok: true, updatedAt: ++revision });
		}));
		initSync('user-1');
		await drainPendingMutations();
		expect(accepted).toHaveLength(3);
		expect(await offlineDb.items.get('item-1')).toMatchObject({ name: 'Hafermilch', isChecked: false, updatedAt: 103 });
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		initSync(null);
		await queueItemUpdate('user-1', 'item-1', { isChecked: true });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ error: 'conflict', current: { updatedAt: 999 } }, 409)));
		initSync('user-1');
		await drainPendingMutations();
		expect(fetch).toHaveBeenCalledTimes(1);
	});

	it('retains the chain across a lost create response and rebases its retry idempotently', async () => {
		await queue('item-1', 'Milch');
		await queueItemUpdate('user-1', 'item-1', { isChecked: true, checkedAt: 100 });
		let created = 0, attempt = 0, checked = false;
		vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
			if (options.method === 'POST') {
				if (++attempt === 1) { created++; throw new TypeError('lost response'); }
				return jsonResponse({ id: 'item-1', updatedAt: 500 });
			}
			const body = JSON.parse(options.body);
			expect(body.clientUpdatedAt).toBe(500);
			checked = body.isChecked;
			return jsonResponse({ ok: true, updatedAt: 501 });
		}));
		initSync('user-1');
		await drainPendingMutations();
		await drainPendingMutations();
		expect(created).toBe(1);
		expect(checked).toBe(true);
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('does not overwrite pending checks or resurrect pending deletions during a server refresh', async () => {
		await offlineDb.items.bulkPut([item('item-1', 'Milch'), item('item-2', 'Brot')]);
		await queueItemUpdate('user-1', 'item-1', { isChecked: true, checkedAt: 110 });
		await queueItemDelete('user-1', 'item-2');
		const refreshed = await cacheItemsData([item('item-1', 'Milch'), item('item-2', 'Brot')], 'user-1');
		expect(refreshed).toEqual([expect.objectContaining({ id: 'item-1', isChecked: true })]);
		expect(await offlineDb.items.get('item-1')).toMatchObject({ isChecked: true, checkedAt: 110 });
		expect(await offlineDb.items.get('item-2')).toBeUndefined();
	});

	it('keeps later edits when an update succeeded but its response was lost', async () => {
		await offlineDb.items.put(item('item-1', 'Milch'));
		await queueItemUpdate('user-1', 'item-1', { isChecked: true });
		await queueItemUpdate('user-1', 'item-1', { name: 'Hafermilch' });
		let requests = 0;
		vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
			const body = JSON.parse(options.body);
			if (++requests === 1) throw new TypeError('Response lost after commit');
			if (body.clientUpdatedAt === 100) return jsonResponse({ current: { isChecked: true, updatedAt: 200 } }, 409);
			expect(body).toMatchObject({ name: 'Hafermilch', clientUpdatedAt: 200 });
			return jsonResponse({ ok: true, updatedAt: 201 });
		}));
		initSync('user-1');
		await drainPendingMutations();
		await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await offlineDb.items.get('item-1')).toMatchObject({ name: 'Hafermilch', isChecked: true, updatedAt: 201 });
	});

	it('preserves a confirmed create and check against an older GET that finishes after sync', async () => {
		await queue('item-1', 'Milch');
		await queueItemUpdate('user-1', 'item-1', { isChecked: true });
		const requestStartedAt = Date.now();
		vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ ok: true, updatedAt: 200 })));
		initSync('user-1'); await drainPendingMutations();
		expect(await offlineDb.pendingMutations.count()).toBe(0);
		expect(await getPendingCreateItems('user-1', 'list-1', requestStartedAt)).toEqual([expect.objectContaining({ id: 'item-1', isChecked: true })]);
		expect(await cacheItemsData([item('item-1', 'Milch')], 'user-1', requestStartedAt)).toEqual([expect.objectContaining({ isChecked: true, updatedAt: 200 })]);
		const newerGet = (await offlineDb.items.get('item-1'))!.localConfirmedAt! + 1;
		expect(await getPendingCreateItems('user-1', 'list-1', newerGet)).toEqual([]);
		expect(await cacheItemsData([item('item-1', 'Milch')], 'user-1', newerGet)).toEqual([expect.objectContaining({ isChecked: false })]);
	});
});
