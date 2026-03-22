import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq, asc, count } from 'drizzle-orm';
import { hashPassword } from '$lib/auth';
import { validatePassword } from '$lib/password';

function now() { return Math.floor(Date.now() / 1000); }

export const PATCH: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { password } = await event.request.json();
	const pwError = validatePassword(password ?? '');
	if (pwError) return json({ error: pwError }, { status: 400 });

	const user = db.select().from(users).where(eq(users.id, event.params.id)).get();
	if (!user) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const passwordHash = hashPassword(password);
	db.update(users).set({ passwordHash, updatedAt: now() }).where(eq(users.id, user.id)).run();
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
