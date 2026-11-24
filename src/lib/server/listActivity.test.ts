import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/db/schema');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './src/lib/db/migrations' });
	return { db, sqlite };
});
vi.mock('#lib/server/pushDebounce', () => ({ schedulePushForItemAdded: vi.fn() }));
vi.mock('#lib/server/userEvents', () => ({ emit: vi.fn(), emitToListMembers: vi.fn() }));
vi.mock('#lib/server/pushNotifications', () => ({
	sendPushToUser: vi.fn(async () => 'sent'),
	hasUserPushSubscription: vi.fn(() => true)
}));
const actor = vi.hoisted(() => ({ id: 'owner' }));

import { db, sqlite } from '#lib/db';
import { users, lists, items, itemHistory, listMembers, checklistReminders } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import { emitToListMembers } from './userEvents';
import { GET as getItems, POST } from '../../routes/api/lists/[id]/items/+server';
import { GET as getLists, POST as createList } from '../../routes/api/lists/+server';
import { POST as checklistAction } from '../../routes/api/lists/[id]/checklist/+server';
import { checkChecklistReminders } from './checklistReminders';
import { sendPushToUser } from './pushNotifications';
import { PUT, DELETE } from '../../routes/api/items/[id]/+server';
import { PUT as updateList } from '../../routes/api/lists/[id]/+server';

vi.mock('#lib/auth/middleware', () => ({ authGuard: () => ({ user: actor, error: null }) }));
function event(id: string, body: unknown = {}) {
	return { params: { id }, url: new URL('http://localhost'), request: new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } as never;
}
function timestamp() { return db.select().from(lists).where(eq(lists.id, 'list')).get()!.updatedAt; }

beforeEach(() => {
	vi.clearAllMocks();
	actor.id = 'owner';
	sqlite.exec('DELETE FROM users');
	db.insert(users).values({ id: 'owner', username: 'owner', passwordHash: 'fixture', createdAt: 1, updatedAt: 1 }).run();
	db.insert(lists).values({ id: 'list', name: 'List', ownerId: 'owner', createdAt: 1, updatedAt: 1 }).run();
	db.insert(items).values({ id: 'item', listId: 'list', name: 'Milk', createdBy: 'owner', createdAt: 1, updatedAt: 1 }).run();
});

describe('list activity timestamps', () => {
	it('publishes the stored timestamp for new items, edits and deletions', async () => {
		expect((await POST(event('list', { id: 'new', name: 'Bread' }))).status).toBe(201);
		expect(timestamp()).toBeGreaterThan(1);
		expect(emitToListMembers).toHaveBeenLastCalledWith('list', expect.objectContaining({ type: 'item_added', listUpdatedAt: timestamp() }));
		sqlite.exec('UPDATE lists SET updated_at = 1');
		expect((await PUT(event('item', { isChecked: true }))).status).toBe(200);
		expect(timestamp()).toBeGreaterThan(1);
		expect(emitToListMembers).toHaveBeenLastCalledWith('list', expect.objectContaining({ type: 'item_updated', listUpdatedAt: timestamp(), openCountDelta: -1 }));
		sqlite.exec('UPDATE lists SET updated_at = 1');
		expect((await DELETE(event('item'))).status).toBe(200);
		expect(timestamp()).toBeGreaterThan(1);
		expect(emitToListMembers).toHaveBeenLastCalledWith('list', expect.objectContaining({ type: 'item_deleted', listUpdatedAt: timestamp(), wasChecked: true }));
		expect(db.select().from(items).where(eq(items.id, 'item')).get()).toBeUndefined();
	});
	it('includes metadata changes and leaves activity unchanged after rejected writes', async () => {
		expect((await updateList(event('list', { name: 'Renamed', locationLat: 52, locationLng: 13 }))).status).toBe(200);
		expect(timestamp()).toBeGreaterThan(1);
		expect(emitToListMembers).toHaveBeenLastCalledWith('list', expect.objectContaining({ type: 'list_updated', list: expect.objectContaining({ name: 'Renamed', updatedAt: timestamp(), locationLat: 52 }) }));
		sqlite.exec('UPDATE lists SET updated_at = 1');
		expect((await PUT(event('missing', { name: 'No' }))).status).toBe(404);
		expect((await DELETE(event('missing'))).status).toBe(404);
		expect(timestamp()).toBe(1);
	});
});

describe('checklists', () => {
	async function checklist() {
		const list = await (await createList(event('', { name: 'Weekend', kind: 'checklist' }))).json();
		const changes = { name: list.name, checklistSections: [{ id: 'pack', name: 'Pack' }], defaultSectionId: 'pack' };
		expect((await updateList(event(list.id, changes))).status).toBe(200);
		expect((await POST(event(list.id, { id: 'camera', name: 'Camera' }))).status).toBe(201);
		return { list, changes };
	}

	it('keeps checklist entries out of shopping targets and history, and preserves entries when sections are removed', async () => {
		const { list, changes } = await checklist();
		const shoppingEvent = { ...event('') as object, url: new URL('http://localhost/api/lists?kind=shopping') } as never;
		expect((await (await getLists(shoppingEvent)).json()).lists.map((entry: { id: string }) => entry.id)).toEqual(['list']);
		expect(db.select().from(itemHistory).all()).toEqual([]);
		expect((await POST(event(list.id, { name: 'Groceries', kind: 'shopping' }))).status).toBe(409);
		expect((await (await getItems(event(list.id))).json())[0].sectionId).toBe('pack');
		expect((await updateList(event(list.id, { ...changes, checklistSections: [], defaultSectionId: null }))).status).toBe(200);
		expect((await (await getItems(event(list.id))).json())[0]).toMatchObject({ name: 'Camera', sectionId: null });
	});

	it('shares completion, cancels personal reminders, and duplicates a private list with fresh entries', async () => {
		const { list } = await checklist();
		db.insert(users).values({ id: 'editor', username: 'editor', passwordHash: 'fixture', createdAt: 1, updatedAt: 1 }).run();
		db.insert(listMembers).values({ userId: 'editor', listId: list.id, permission: 'write' }).run();
		const dueAt = Date.now() + 60_000;
		expect((await PUT(event('camera', { remindAt: dueAt }))).status).toBe(200);
		actor.id = 'editor';
		expect((await (await getItems(event(list.id))).json())[0].remindAt).toBeNull();
		expect((await PUT(event('camera', { isChecked: true }))).status).toBe(200);
		expect(db.select().from(checklistReminders).all()).toEqual([]);
		expect((await checklistAction(event(list.id, { action: 'reset' }))).status).toBe(403);
		actor.id = 'owner';
		const duplication = { action: 'duplicate', id: 'copy-with_section123', name: 'Holiday' };
		expect((await checklistAction(event(list.id, duplication))).status).toBe(201);
		expect((await checklistAction(event(list.id, duplication))).status).toBe(201);
		expect(await (await getItems(event(duplication.id))).json()).toMatchObject([{ name: 'Camera', sectionId: 'pack', isChecked: false, remindAt: null }]);
		expect(await (await getItems(event(list.id))).json()).toMatchObject([{ isChecked: true }]);
		expect((await checklistAction(event(list.id, { action: 'reset' }))).status).toBe(200);
		expect(await (await getItems(event(list.id))).json()).toMatchObject([{ isChecked: false }]);
	});

	it('shares notes with readers, preserves them in copies, and lets editors clear them', async () => {
		const { list } = await checklist();
		const created = await POST(event(list.id, { id: 'tickets', name: 'Tickets', checklistNote: '  Second drawer\nBlue folder  ' }));
		expect(created.status).toBe(201);
		expect(await created.json()).toMatchObject({ checklistNote: 'Second drawer\nBlue folder' });
		expect(emitToListMembers).toHaveBeenLastCalledWith(list.id, expect.objectContaining({
			type: 'item_added', item: expect.objectContaining({ id: 'tickets', checklistNote: 'Second drawer\nBlue folder' })
		}));
		expect((await POST(event('list', { name: 'Milk', checklistNote: 'A note' }))).status).toBe(400);
		expect((await PUT(event('tickets', { checklistNote: { text: 'Invalid' } }))).status).toBe(400);
		const copy = { action: 'duplicate', id: 'copy-with-notes123', name: 'Copy' };
		expect((await checklistAction(event(list.id, copy))).status).toBe(201);
		expect(await (await getItems(event(copy.id))).json()).toContainEqual(expect.objectContaining({
			name: 'Tickets', checklistNote: 'Second drawer\nBlue folder'
		}));

		db.insert(users).values({ id: 'member', username: 'member', passwordHash: 'fixture', createdAt: 1, updatedAt: 1 }).run();
		db.insert(listMembers).values({ userId: 'member', listId: list.id, permission: 'read' }).run();
		actor.id = 'member';
		expect(await (await getItems(event(list.id))).json()).toContainEqual(expect.objectContaining({ id: 'tickets', checklistNote: 'Second drawer\nBlue folder' }));
		expect((await PUT(event('tickets', { checklistNote: null }))).status).toBe(404);
		db.update(listMembers).set({ permission: 'write' }).where(eq(listMembers.listId, list.id)).run();
		expect(await (await PUT(event('tickets', { checklistNote: '  ' }))).json()).toMatchObject({ checklistNote: null });
		expect(emitToListMembers).toHaveBeenLastCalledWith(list.id, expect.objectContaining({
			type: 'item_updated', item: expect.objectContaining({ id: 'tickets', checklistNote: null })
		}));
	});

	it('updates sections without changing list details or the order of already unassigned entries', async () => {
		const { list } = await checklist();
		await updateList(event(list.id, { name: 'Weekend', description: 'Shared trip' }));
		await POST(event(list.id, { id: 'keys', name: 'Keys', sectionId: null }));
		await checklistAction(event(list.id, { action: 'orderEntries', ids: ['keys'], sectionId: null }));
		expect((await checklistAction(event(list.id, { action: 'updateSections', checklistSections: [], defaultSectionId: 'pack' }))).status).toBe(400);
		expect((await checklistAction(event(list.id, { action: 'updateSections', checklistSections: [], defaultSectionId: null }))).status).toBe(200);
		expect(db.select().from(lists).where(eq(lists.id, list.id)).get()).toMatchObject({
			name: 'Weekend', description: 'Shared trip', checklistSections: [], defaultSectionId: null
		});
		expect(await (await getItems(event(list.id))).json()).toEqual(expect.arrayContaining([
			expect.objectContaining({ id: 'camera', sectionId: null, checklistPosition: null }),
			expect.objectContaining({ id: 'keys', sectionId: null, checklistPosition: 0 })
		]));
	});

	it('processes a stored one-time reminder once, even after its scheduled minute', async () => {
		const { list } = await checklist();
		const dueAt = Date.now() + 60_000;
		expect((await PUT(event('camera', { remindAt: dueAt }))).status).toBe(200);
		await checkChecklistReminders(dueAt + 90_000);
		await checkChecklistReminders(dueAt + 150_000);
		expect(sendPushToUser).toHaveBeenCalledTimes(1);
		expect(sendPushToUser).toHaveBeenCalledWith('owner', expect.objectContaining({
			body: 'Camera', url: `/listen/${list.id}?entry=camera`
		}));
		expect(await (await getItems(event(list.id))).json()).toMatchObject([{ remindAt: dueAt, reminderStatus: 'sent' }]);
	});
});
