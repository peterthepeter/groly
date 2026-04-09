import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers, listNotificationPrefs } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const listId = event.params.id;
	const { enabled } = await event.request.json();

	if (typeof enabled !== 'boolean') {
		return json({ error: 'enabled muss ein Boolean sein' }, { status: 400 });
	}

	// Prüfen ob User Zugang zur Liste hat (Owner oder Member)
	const list = db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const isOwner = list.ownerId === user!.id;
	const member = db
		.select()
		.from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id)))
		.get();

	if (!isOwner && member?.status !== 'accepted') return json({ error: 'Keine Berechtigung' }, { status: 403 });

	if (isOwner) {
		// Owner-Präferenz in list_notification_prefs speichern
		db.insert(listNotificationPrefs)
			.values({ listId, userId: user!.id, enabled })
			.onConflictDoUpdate({
				target: [listNotificationPrefs.listId, listNotificationPrefs.userId],
				set: { enabled }
			})
			.run();
	} else {
		// Member: in listMembers.notificationsEnabled + list_notification_prefs (für konsistente Abfrage)
		db.update(listMembers)
			.set({ notificationsEnabled: enabled })
			.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id)))
			.run();

		db.insert(listNotificationPrefs)
			.values({ listId, userId: user!.id, enabled })
			.onConflictDoUpdate({
				target: [listNotificationPrefs.listId, listNotificationPrefs.userId],
				set: { enabled }
			})
			.run();
	}

	return json({ ok: true, enabled });
};

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const listId = event.params.id;

	const list = db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).get();
	if (!list) return json({ error: 'Nicht gefunden' }, { status: 404 });

	const isOwner = list.ownerId === user!.id;
	const member = db
		.select()
		.from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id)))
		.get();

	if (!isOwner && member?.status !== 'accepted') return json({ error: 'Keine Berechtigung' }, { status: 403 });

	const pref = db
		.select()
		.from(listNotificationPrefs)
		.where(
			and(eq(listNotificationPrefs.listId, listId), eq(listNotificationPrefs.userId, user!.id))
		)
		.get();

	return json({ enabled: pref === undefined ? true : pref.enabled });
};
