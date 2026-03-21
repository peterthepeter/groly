import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { changePassword, verifyPassword } from '$lib/auth';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { currentPassword, newPassword } = await event.request.json();
	if (!currentPassword || !newPassword) return json({ error: 'Fehlende Felder' }, { status: 400 });
	if (newPassword.length < 8) return json({ error: 'Passwort zu kurz (min. 8 Zeichen)' }, { status: 400 });

	const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
	if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
		return json({ error: 'Aktuelles Passwort falsch' }, { status: 401 });
	}

	changePassword(user!.id, newPassword);
	return json({ ok: true });
};
