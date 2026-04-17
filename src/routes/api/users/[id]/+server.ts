import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq, asc, count } from 'drizzle-orm';
import { hashPassword, now } from '$lib/auth';
import { validatePassword } from '$lib/password';

export const PATCH: RequestHandler = async (event) => {
	const { error, user: actingUser } = adminGuard(event);
	if (error) return error;

	const targetId = event.params.id;
	const body = await event.request.json();
	const { password, role } = body;

	const target = db.select().from(users).where(eq(users.id, targetId)).get();
	if (!target) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const firstUser = db.select().from(users).orderBy(asc(users.createdAt)).limit(1).get();
	const isBootstrap = firstUser?.id === targetId;

	// Password reset
	if (password !== undefined) {
		const pwError = validatePassword(password ?? '');
		if (pwError) return json({ error: pwError }, { status: 400 });
		const passwordHash = hashPassword(password.trim());
		db.update(users).set({ passwordHash, mustChangePassword: true, updatedAt: now() }).where(eq(users.id, targetId)).run();
	}

	// Role change
	if (role !== undefined) {
		if (role !== 'admin' && role !== 'user') return json({ error: 'Ungültige Rolle' }, { status: 400 });
		if (isBootstrap) return json({ error: 'Bootstrap-Admin kann nicht degradiert werden' }, { status: 403 });
		if (actingUser!.id === targetId) return json({ error: 'Du kannst deine eigene Rolle nicht ändern' }, { status: 403 });
		if (role === 'user' && target.role === 'admin') {
			const adminCount = db.select({ cnt: count(users.id) }).from(users).where(eq(users.role, 'admin')).get();
			if ((adminCount?.cnt ?? 0) <= 1) return json({ error: 'Der letzte Admin kann nicht degradiert werden' }, { status: 403 });
		}
		db.update(users).set({ role, updatedAt: now() }).where(eq(users.id, targetId)).run();
	}

	return json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user: actingUser } = adminGuard(event);
	if (error) return error;

	const targetId = event.params.id;
	const target = db.select().from(users).where(eq(users.id, targetId)).get();
	if (!target) return json({ error: 'Nicht gefunden' }, { status: 404 });

	// Safety: cannot delete yourself
	if (actingUser!.id === targetId) {
		return json({ error: 'Du kannst dich nicht selbst löschen' }, { status: 403 });
	}

	// Safety: cannot delete bootstrap user (first ever created)
	const firstUser = db.select().from(users).orderBy(asc(users.createdAt)).limit(1).get();
	if (firstUser?.id === targetId) {
		return json({ error: 'Der ursprüngliche Admin-Account kann nicht gelöscht werden' }, { status: 403 });
	}

	// Safety: cannot delete last remaining admin
	if (target.role === 'admin') {
		const adminCount = db.select({ cnt: count(users.id) }).from(users).where(eq(users.role, 'admin')).get();
		if ((adminCount?.cnt ?? 0) <= 1) {
			return json({ error: 'Der letzte Admin kann nicht gelöscht werden' }, { status: 403 });
		}
	}

	db.delete(users).where(eq(users.id, targetId)).run();
	return json({ ok: true });
};
