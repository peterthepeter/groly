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
vi.mock('#lib/server/userEvents', () => ({ emitToListMembers: vi.fn() }));

import { db, sqlite } from '#lib/db';
import { users, lists, items } from '#lib/db/schema';
import { eq } from 'drizzle-orm';
import { emitToListMembers } from './userEvents';
import { POST } from '../../routes/api/lists/[id]/items/+server';
import { PUT, DELETE } from '../../routes/api/items/[id]/+server';
import { PUT as updateList } from '../../routes/api/lists/[id]/+server';

vi.mock('#lib/auth/middleware', () => ({ authGuard: () => ({ user: { id: 'owner' }, error: null }) }));
function event(id: string, body: unknown = {}) {
	return { params: { id }, request: new Request('http://localhost', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) } as never;
}
function timestamp() { return db.select().from(lists).where(eq(lists.id, 'list')).get()!.updatedAt; }

beforeEach(() => {
	vi.clearAllMocks();
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
