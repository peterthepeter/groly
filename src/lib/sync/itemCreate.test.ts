import 'fake-indexeddb/auto';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { offlineDb, type OfflineItem } from '#lib/sync/db';
import { cacheItemsData, getOfflineLists, drainPendingMutations, getPendingCreateItems, initSync, queueItemCreate, queueItemUpdate, queueItemDelete, queueItemDeletes, undoChecklistDelete, queueChecklistOrder, queueChecklistSections, setChecklistDefault, cacheListsData, resetChecklist } from '#lib/sync/manager';

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

	it('keeps offline section creation, the explicit default and manual order through a stale refresh', async () => {
		const owner = 'user-1';
		const a = { id: 'a', name: 'Bag' };
		const b = { id: 'b', name: 'Desk' };
		const list = { id: 'list-1', ownerId: owner, kind: 'checklist' as const, name: 'Trip', description: null,
			checklistSections: [a], defaultSectionId: a.id, openCount: 0, updatedAt: 1 };
		await cacheListsData([list], owner);
		const camera = { ...item('camera', 'Camera'), sectionId: b.id };
		await queueItemCreate(owner, camera, { id: camera.id, listId: list.id, name: camera.name,
			categoryOverride: null, quantityInfo: '', sectionId: b.id, kind: 'checklist', newSection: b });
		expect((await offlineDb.accountLists.get([owner, list.id]))?.defaultSectionId).toBe(a.id);
		const phone = { ...item('phone', 'Phone'), sectionId: b.id };
		await queueItemCreate(owner, phone, { id: phone.id, listId: list.id, name: phone.name,
			categoryOverride: null, quantityInfo: '', sectionId: b.id, kind: 'checklist', setDefault: true });
		await queueChecklistOrder(owner, list.id, [b.id, a.id]);
		await queueChecklistOrder(owner, list.id, [phone.id, camera.id], b.id);
		await cacheListsData([list], owner);
		expect(await offlineDb.accountLists.get([owner, list.id])).toMatchObject({ checklistSections: [b, a], defaultSectionId: b.id });
		const refreshed = await cacheItemsData([camera, phone], owner);
		expect(refreshed.map(row => (row as OfflineItem).checklistPosition)).toEqual([1, 0]);
		await setChecklistDefault(owner, list.id, a.id);
		await cacheListsData([{ ...list, defaultSectionId: b.id }], owner);
		expect((await offlineDb.accountLists.get([owner, list.id]))?.defaultSectionId).toBe(a.id);
		await expect(setChecklistDefault(owner, list.id, 'missing')).rejects.toThrow();
		await expect(setChecklistDefault('other', list.id, b.id)).rejects.toThrow();
	});

	it('cancels a swipe deletion with its original item and queues a bulk selection as one operation', async () => {
		const owner = 'user-1';
		const checked = { ...item('first', 'Keys'), isChecked: true, checklistPosition: 1 };
		const open = item('second', 'Phone');
		const keep = item('third', 'Wallet');
		await cacheItemsData([checked, open, keep], owner);
		await queueItemDeletes(owner, [checked.id], Date.now() + 7000, checked.listId);
		expect(await undoChecklistDelete(owner, checked)).toBe(true);
		expect(await offlineDb.accountItems.get([owner, checked.id])).toMatchObject(checked);
		await queueItemDeletes(owner, [checked.id, open.id], undefined, checked.listId);
		const pending = await offlineDb.pendingMutations.toArray();
		expect(pending).toHaveLength(1);
		expect(pending[0].payload).toEqual({ listId: checked.listId, action: 'deleteEntries', ids: [checked.id, open.id] });
		expect((await cacheItemsData([checked, open, keep], owner)).map(row => row.id)).toEqual([keep.id]);
	});

	it('keeps offline note edits and section removal when a stale list reload arrives', async () => {
		const owner = 'user-1';
		const section = { id: 'bag', name: 'Bag' };
		const list = { id: 'list-1', ownerId: owner, kind: 'checklist' as const, name: 'Trip', description: null,
			checklistSections: [section], defaultSectionId: section.id, openCount: 1, updatedAt: 1 };
		const camera = { ...item('camera', 'Camera'), checklistNote: 'Original', sectionId: section.id, checklistPosition: 0 };
		await cacheListsData([list], owner);
		await cacheItemsData([camera], owner);
		await queueItemUpdate(owner, camera.id, { checklistNote: 'In the hall' });
		await queueChecklistSections(owner, list.id, { checklistSections: [], defaultSectionId: null });
		await cacheListsData([list], owner);
		expect(await offlineDb.accountLists.get([owner, list.id])).toMatchObject({ checklistSections: [], defaultSectionId: null });
		const reloaded = await cacheItemsData([camera], owner);
		expect(reloaded[0]).toMatchObject({ checklistNote: 'In the hall', sectionId: null, checklistPosition: null });
		expect((await offlineDb.pendingMutations.toArray()).map(entry => entry.payload)).toMatchObject([
			{ checklistNote: 'In the hall' }, { action: 'updateSections', checklistSections: [], defaultSectionId: null }
		]);
	});

	it('reads checklist card progress from the complete offline snapshot and retains unopened list totals', async () => {
		const owner = 'user-1';
		initSync(owner);
		const list = { id: 'list-1', ownerId: owner, kind: 'checklist' as const, name: 'Trip', description: null,
			openCount: 2, totalCount: 2, updatedAt: 1 };
		await cacheListsData([{ ...list, checklistItemsCached: true }], owner);
		const unopened = { ...list, id: 'unopened' };
		await cacheListsData([list, unopened], owner, true);
		const first = item('keys', 'Keys');
		const second = item('phone', 'Phone');
		await cacheItemsData([first, second], owner, 0, list.id);
		await queueItemUpdate(owner, first.id, { isChecked: true });
		await queueItemDelete(owner, second.id);
		const progress = new Map((await getOfflineLists()).map(row => [row.id, row]));
		expect(progress.get(list.id)).toMatchObject({ openCount: 0, totalCount: 1 });
		expect(progress.get(unopened.id)).toMatchObject({ openCount: 2, totalCount: 2 });
	});

	it('sends a pending item update before resetting the checklist', async () => {
		initSync('user-1');
		await offlineDb.pendingMutations.add({
			type: 'update_item', userId: 'user-1', createdAt: 1,
			payload: { id: 'item-1', listId: 'list-1', isChecked: true, clientUpdatedAt: 100 }
		});
		const fetchMock = vi.fn()
			.mockResolvedValueOnce(jsonResponse({ ...item('item-1', 'Camera'), isChecked: true, updatedAt: 101 }))
			.mockResolvedValueOnce(jsonResponse({ ok: true }));
		vi.stubGlobal('fetch', fetchMock);

		await resetChecklist('user-1', 'list-1');

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/items/item-1', '/api/lists/list-1/checklist']);
		expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ action: 'reset' });
		expect(await offlineDb.pendingMutations.count()).toBe(0);
	});

	it('preserves an unsynced checklist change if a reset cannot be sequenced after it', async () => {
		initSync('user-1');
		await offlineDb.pendingMutations.add({
			type: 'update_item', userId: 'user-1', createdAt: 1,
			payload: { id: 'item-1', listId: 'list-1', isChecked: true, clientUpdatedAt: 100 }
		});
		const fetchMock = vi.fn().mockRejectedValue(new TypeError('offline'));
		vi.stubGlobal('fetch', fetchMock);

		await expect(resetChecklist('user-1', 'list-1')).rejects.toThrow('Checklist changes are still pending');

		expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(['/api/items/item-1']);
		expect(await offlineDb.pendingMutations.count()).toBe(1);
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
