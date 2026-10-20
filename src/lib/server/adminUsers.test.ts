import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

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

import { db, sqlite } from '#lib/db';
import { users, lists, items, recipes, userInvites } from '#lib/db/schema';
import { createHash } from 'node:crypto';
import { createInvite, getOpenInviteFor, validateInvite, consumeInvite } from '#lib/auth/invites';
import { changePassword } from '#lib/auth';
import { listAdminUsers } from './adminUsers';
import { load as loadUser } from '../../routes/einstellungen/admin/benutzer/[id]/+page.server';
import { load as loadAdmin } from '../../routes/einstellungen/admin/+layout.server';

function user(id: string, role: 'admin' | 'user', createdAt: number) {
	const value = { id, username: id, role, passwordHash: 'fixture', createdAt, updatedAt: createdAt };
	db.insert(users).values(value).run();
	return value;
}
function context(actor: ReturnType<typeof user> | undefined, id = 'member') {
	return { locals: { user: actor }, params: { id }, url: new URL(`http://localhost/einstellungen/admin/benutzer/${id}`), setHeaders: vi.fn() } as never;
}
beforeEach(() => { sqlite.exec('DELETE FROM users'); });
afterEach(() => { vi.restoreAllMocks(); });

describe('admin user details', () => {
	it('redirects ordinary and anonymous visitors before returning account details', () => {
		const member = user('member', 'user', 2);
		for (const actor of [undefined, member]) {
			for (const load of [loadAdmin, loadUser]) {
				try { load(context(actor)); expect.unreachable(); }
				catch (redirect) { expect(redirect).toMatchObject({ status: 302, location: '/einstellungen' }); }
			}
		}
	});
	it('protects the original admin and own account, including matching creation timestamps', () => {
		const original = user('z-original', 'admin', 1);
		const second = user('a-second', 'admin', 1);
		user('member', 'user', 2);
		expect(loadUser(context(second, original.id))).toMatchObject({ isBootstrap: true, canChangeRole: false, canDelete: false });
		expect(loadUser(context(second, second.id))).toMatchObject({ isBootstrap: false, canChangeRole: false, canDelete: false });
		expect(loadUser(context(original))).toMatchObject({ isBootstrap: false, canChangeRole: true, canDelete: true });
	});
	it('returns 404 for a deleted user instead of rendering stale actions', () => {
		const admin = user('admin', 'admin', 1);
		try { loadUser(context(admin, 'missing')); expect.unreachable(); }
		catch (error) { expect(error).toMatchObject({ status: 404 }); }
	});
	it('keeps usage counts distinct across list, item, and recipe joins', () => {
		user('admin', 'admin', 1);
		db.insert(lists).values(['one','two'].map(id => ({ id, name: id, ownerId: 'admin', createdAt: 1, updatedAt: 1 }))).run();
		db.insert(items).values(['a','b','c'].map(id => ({ id, name: id, listId: 'one', createdAt: 1, updatedAt: 1 }))).run();
		db.insert(recipes).values(['r1','r2'].map(id => ({ id, title: id, userId: 'admin', createdAt: 1, updatedAt: 1 }))).run();
		expect(listAdminUsers()[0]).toMatchObject({ listCount: 2, itemCount: 3, recipeCount: 2, openInviteType: null });
	});
});


describe('recoverable admin links', () => {
	it('reloads the same live link from the database and keeps it out of the user overview', () => {
		const admin = user('admin', 'admin', 1);
		user('member', 'user', 2);
		const token = createInvite('member', 'reset');
		const event = context(admin);
		const first = loadUser(event);
		expect(first).toMatchObject({ invite: { inviteUrl: `http://localhost/invite/${token}`, type: 'reset' }, legacyInvite: false });
		expect(loadUser(context(admin))).toEqual(first);
		expect((event as unknown as { setHeaders: ReturnType<typeof vi.fn> }).setHeaders).toHaveBeenCalledWith({ 'Cache-Control': 'no-store' });
		expect(JSON.stringify(listAdminUsers())).not.toContain(token);
		expect(validateInvite(token)).not.toHaveProperty('tokenValue');
	});
	it('preserves legacy hashed links and explains why they need regeneration to be displayed', () => {
		const admin = user('admin', 'admin', 1);
		user('member', 'user', 2);
		const legacyToken = 'old-reset-token';
		const ts = Math.floor(Date.now() / 1000);
		db.insert(userInvites).values({ id: 'old', userId: 'member', tokenHash: createHash('sha256').update(legacyToken).digest('hex'), type: 'reset', createdAt: ts, expiresAt: ts + 60 }).run();
		expect(validateInvite(legacyToken).status).toBe('valid');
		expect(loadUser(context(admin))).toMatchObject({ invite: null, legacyInvite: true });
		const replacement = createInvite('member', 'reset');
		expect(validateInvite(legacyToken).status).toBe('used');
		expect(loadUser(context(admin))).toMatchObject({ invite: { inviteUrl: `http://localhost/invite/${replacement}` } });
	});
	it('clears replaced links and rolls back the replacement if storing the new invite fails', () => {
		user('member', 'user', 1);
		const first = createInvite('member', 'invite');
		const second = createInvite('member', 'invite');
		expect(validateInvite(first).status).toBe('used');
		expect(sqlite.prepare('SELECT token_value FROM user_invites WHERE token_hash = ?').get(createHash('sha256').update(first).digest('hex'))).toEqual({ token_value: null });
		sqlite.exec("CREATE TRIGGER reject_invite BEFORE INSERT ON user_invites BEGIN SELECT RAISE(ABORT, 'fixture'); END");
		try { expect(() => createInvite('member', 'invite')).toThrow(); }
		finally { sqlite.exec('DROP TRIGGER reject_invite'); }
		expect(validateInvite(second).status).toBe('valid');
		expect(getOpenInviteFor('member')?.token).toBe(second);
	});
	it('removes recoverable copies after use or password changes, and at the exact expiry boundary', () => {
		user('member', 'user', 1);
		const token = createInvite('member', 'invite');
		expect(consumeInvite(token, 'New-password-2026!')).toHaveProperty('sessionId');
		expect(getOpenInviteFor('member')).toBeNull();
		expect(sqlite.prepare('SELECT token_value FROM user_invites').get()).toEqual({ token_value: null });
		const reset = createInvite('member', 'reset');
		changePassword('member', 'Changed-password-2026!');
		expect(validateInvite(reset).status).toBe('used');
		expect(sqlite.prepare('SELECT COUNT(*) AS count FROM user_invites WHERE token_value IS NOT NULL').get()).toEqual({ count: 0 });
		const expiring = createInvite('member', 'reset');
		const expiresAt = getOpenInviteFor('member')!.expiresAt;
		vi.spyOn(Date, 'now').mockReturnValue(expiresAt * 1000);
		expect(validateInvite(expiring).status).toBe('expired');
		expect(consumeInvite(expiring, 'Another-password-2026!')).toEqual({ error: 'expired' });
		expect(getOpenInviteFor('member')).toMatchObject({ expired: true, token: null });
		expect(sqlite.prepare('SELECT COUNT(*) AS count FROM user_invites WHERE token_value IS NOT NULL').get()).toEqual({ count: 0 });
	});
});
