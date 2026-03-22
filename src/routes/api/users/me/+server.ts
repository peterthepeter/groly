import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { changePassword, verifyPassword } from '$lib/auth';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS, type UserSettings } from '$lib/userSettingsTypes';

function mergeSettings(stored: string | null | undefined): UserSettings {
	const base: UserSettings = { ...DEFAULT_SETTINGS };
	if (!stored) return base;
	try {
		return { ...base, ...JSON.parse(stored) };
	} catch { return base; }
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
	return json({ settings: mergeSettings(fullUser?.settings) });
};

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const body = await event.request.json();

	// Settings update (no password required)
	if (body.settings !== undefined) {
		const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
		const current = mergeSettings(fullUser?.settings);
		const merged = { ...current, ...body.settings };
		db.update(users)
			.set({ settings: JSON.stringify(merged), updatedAt: Math.floor(Date.now() / 1000) })
			.where(eq(users.id, user!.id))
			.run();
		return json({ ok: true });
	}

	// Password change
	const { currentPassword, newPassword } = body;
	if (!currentPassword || !newPassword) return json({ error: 'Fehlende Felder' }, { status: 400 });
	if (newPassword.length < 8) return json({ error: 'Passwort zu kurz (min. 8 Zeichen)' }, { status: 400 });

	const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
	if (!fullUser || !verifyPassword(currentPassword, fullUser.passwordHash)) {
		return json({ error: 'Aktuelles Passwort falsch' }, { status: 401 });
	}
	if (newPassword === currentPassword) {
		return json({ error: 'Neues Passwort darf nicht mit dem aktuellen übereinstimmen' }, { status: 400 });
	}

	changePassword(user!.id, newPassword);
	return json({ ok: true });
};
