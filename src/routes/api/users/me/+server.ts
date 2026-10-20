import { normalizeShortcuts } from '#lib/shortcutActions';

import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { changePassword, verifyPassword } from '#lib/auth';
import { validatePassword, validatePasswordRule } from '#lib/password';
import { db } from '#lib/db';
import { users } from '#lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { DEFAULT_SETTINGS, type UserSettings } from '#lib/userSettingsTypes';
import { applyUserSettingsPatch, sanitizeUserSettingsPatch } from '#lib/userSettingsSync';

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

	let fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
	const settings = mergeSettings(fullUser?.settings);
	if (fullUser && settings.shortcuts !== undefined) {
		const shortcuts = normalizeShortcuts(settings.shortcuts);
		if (JSON.stringify(shortcuts) !== JSON.stringify(settings.shortcuts)) {
			// Lazy data migration; revision checking protects concurrent settings edits.
			db.update(users).set({ settings: JSON.stringify({ ...settings, shortcuts }), settingsRevision: fullUser.settingsRevision + 1, updatedAt: Math.floor(Date.now() / 1000) })
				.where(and(eq(users.id, user!.id), eq(users.settingsRevision, fullUser.settingsRevision))).run();
			fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
		}
	}

	return Response.json({
		settings: mergeSettings(fullUser?.settings),
		settingsRevision: fullUser?.settingsRevision ?? 0
	});
};

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const body = await event.request.json();

	// Settings update (no password required)
	if (body.settings !== undefined) {
		const patch = sanitizeUserSettingsPatch(body.settings);
		if (!patch) return Response.json({ error: 'Ungültige Einstellungen' }, { status: 400 });
		const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
		if (!fullUser) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });
		const current = mergeSettings(fullUser?.settings);
		const requestedRevision = body.settingsRevision;

		// Clients before Beta 4 did not send a revision. Keep them compatible during
		// the service-worker rollout, but every such write still advances the revision.
		if (requestedRevision === undefined) {
			// Old clients send a complete top-level snapshot, including the complete
			// per-list map. Preserve those replacement semantics during the rollout.
			const merged = { ...current, ...(patch as UserSettings) };
			const nextRevision = fullUser.settingsRevision + 1;
			db.update(users)
				.set({
					settings: JSON.stringify(merged),
					settingsRevision: nextRevision,
					updatedAt: Math.floor(Date.now() / 1000)
				})
				.where(eq(users.id, user!.id))
				.run();
			return Response.json({ ok: true, settings: merged, settingsRevision: nextRevision });
		}

		if (!Number.isSafeInteger(requestedRevision) || requestedRevision < 0) {
			return Response.json({ error: 'Ungültige Einstellungsrevision' }, { status: 400 });
		}
		if (requestedRevision !== fullUser.settingsRevision) {
			return Response.json({
				error: 'settings_conflict',
				settings: current,
				settingsRevision: fullUser.settingsRevision
			}, { status: 409 });
		}

		const merged = applyUserSettingsPatch(current, patch);
		const nextRevision = fullUser.settingsRevision + 1;
		const result = db.update(users)
			.set({
				settings: JSON.stringify(merged),
				settingsRevision: nextRevision,
				updatedAt: Math.floor(Date.now() / 1000)
			})
			.where(and(eq(users.id, user!.id), eq(users.settingsRevision, fullUser.settingsRevision)))
			.run();
		if (result.changes !== 1) {
			const latest = db.select().from(users).where(eq(users.id, user!.id)).get();
			return Response.json({
				error: 'settings_conflict',
				settings: mergeSettings(latest?.settings),
				settingsRevision: latest?.settingsRevision ?? 0
			}, { status: 409 });
		}
		return Response.json({ ok: true, settings: merged, settingsRevision: nextRevision });
	}

	// Password change
	const { currentPassword, newPassword } = body;
	if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || !currentPassword || !newPassword || currentPassword.length > 4096 || newPassword.length > 4096) return Response.json({ error: 'Fehlende Felder' }, { status: 400 });
	const pwError = validatePassword(newPassword);
	if (pwError) return Response.json({ error: pwError, code: validatePasswordRule(newPassword) }, { status: 400 });

	const fullUser = db.select().from(users).where(eq(users.id, user!.id)).get();
	if (!fullUser || !verifyPassword(currentPassword.trim(), fullUser.passwordHash)) {
		return Response.json({ error: 'Aktuelles Passwort falsch', code: 'current_password_wrong' }, { status: 401 });
	}
	if (newPassword.trim() === currentPassword.trim()) {
		return Response.json({ error: 'Neues Passwort darf nicht mit dem aktuellen übereinstimmen', code: 'same_password' }, { status: 400 });
	}

	changePassword(user!.id, newPassword, event.cookies.get('session'), event.cookies.get('push_device'));
	return Response.json({ ok: true });
};
