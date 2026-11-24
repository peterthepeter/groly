
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { lists, items, checklistReminders, users } from '#lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { emitToListMembers } from '#lib/server/userEvents';

import { getListAccess } from '#lib/server/checklists';
import { parseChecklistNote } from '#lib/checklists';
import { now } from '#lib/auth';
import { isValidCategoryKey } from '#lib/categories';
import { toUpdatedItemEventPayload } from '#lib/server/itemEventPayload';

function getWritableItem(itemId: string, userId: string) {
	const item = db.select().from(items).where(eq(items.id, itemId)).get();
	if (!item) return null;
	const { list, permission } = getListAccess(item.listId, userId);
	return list && (permission === 'owner' || permission === 'write') ? { item, list } : null;
}

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const writable = getWritableItem(event.params.id, user!.id);
	if (!writable) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const { item, list } = writable;
	const body = await event.request.json();

	// Konfliktprüfung: Item wurde server-seitig geändert seit letztem Client-Stand
	if (body.clientUpdatedAt !== undefined && item.updatedAt > body.clientUpdatedAt) {
		const reminder = list.kind === 'checklist' ? db.select().from(checklistReminders)
			.where(and(eq(checklistReminders.itemId, item.id), eq(checklistReminders.userId, user!.id))).get() : undefined;
		return Response.json({ error: 'Konflikt', current: { ...item, remindAt: reminder?.dueAt ?? null, reminderStatus: reminder?.status ?? null } }, { status: 409 });
	}

	const ts = now();
	const updates: Record<string, unknown> = { updatedAt: ts };

	if (body.name !== undefined) {
		if (typeof body.name !== 'string' || !body.name.trim()) return Response.json({ error: 'Name required' }, { status: 400 });
		updates.name = body.name.trim();
	}
	if (list.kind === 'shopping' && body.quantityInfo !== undefined) updates.quantityInfo = body.quantityInfo?.trim() ?? null;
	if (body.isChecked !== undefined) {
		updates.isChecked = body.isChecked;
		updates.checkedAt = body.isChecked ? ts : null;
		if (!body.isChecked && item.isChecked) {
			updates.createdBy = user!.id;
		}
	}
	if (list.kind === 'shopping' && body.categoryOverride !== undefined) {
		if (list.kind === 'shopping' && body.categoryOverride !== null && !isValidCategoryKey(body.categoryOverride)) {
			return Response.json({ error: 'Ungültige Kategorie' }, { status: 400 });
		}
		updates.categoryOverride = body.categoryOverride ?? null;
	}

	const checklist = list.kind === 'checklist';
	if (body.checklistNote !== undefined) {
		const note = parseChecklistNote(body.checklistNote);
		if (!checklist || note === undefined) return Response.json({ error: 'Invalid checklist note' }, { status: 400 });
		updates.checklistNote = note;
	}
	if (checklist && body.sectionId !== undefined) {
		updates.sectionId = list.checklistSections?.some(section => section.id === body.sectionId) ? body.sectionId : null;
		if (updates.sectionId !== item.sectionId) updates.checklistPosition = null;
	}
	const dueAt = body.remindAt;
	const checked = body.isChecked ?? item.isChecked;
	const updatedAt = checklist ? Math.max(Date.now(), item.updatedAt + 1) : ts;
	updates.updatedAt = updatedAt;
	if (dueAt !== undefined && (!checklist || (dueAt !== null &&
		(!Number.isSafeInteger(dueAt) || dueAt <= 0 || dueAt > 8.64e15 || checked)))) {
		return Response.json({ error: 'Invalid reminder' }, { status: 400 });
	}
	const personalReminder = and(eq(checklistReminders.itemId, item.id), eq(checklistReminders.userId, user!.id));
	db.transaction(tx => {
		tx.update(items).set(updates).where(eq(items.id, item.id)).run();
		tx.update(lists).set({ updatedAt: ts }).where(eq(lists.id, item.listId)).run();
		if (checklist && checked) {
			tx.delete(checklistReminders).where(eq(checklistReminders.itemId, item.id)).run();
		} else if (dueAt === null) {
			tx.delete(checklistReminders).where(personalReminder).run();
		} else if (dueAt !== undefined) {
			const schedule = { dueAt, nextAttemptAt: dueAt, status: dueAt < Date.now() ? 'missed' as const : 'pending' as const };
			tx.insert(checklistReminders).values({ itemId: item.id, userId: user!.id, ...schedule })
				.onConflictDoUpdate({ target: [checklistReminders.itemId, checklistReminders.userId], set: schedule }).run();
		}
	});

	const updated = db.select().from(items).where(eq(items.id, item.id)).get()!;
	const createdByUsername = updated.createdBy
		? (db.select({ username: users.username }).from(users).where(eq(users.id, updated.createdBy)).get()?.username ?? null)
		: null;
	const openCountDelta = body.isChecked !== undefined
		? (body.isChecked && !item.isChecked ? -1 : !body.isChecked && item.isChecked ? 1 : 0)
		: 0;
	emitToListMembers(item.listId, { type: 'item_updated', listId: item.listId, item: toUpdatedItemEventPayload(updated, createdByUsername), openCountDelta, listUpdatedAt: ts, byUserId: user!.id });

	const reminder = checklist ? db.select().from(checklistReminders).where(personalReminder).get() : undefined;
	return Response.json({ ok: true, updatedAt, ...(checklist ? {
		sectionId: updated.sectionId, checklistNote: updated.checklistNote,
		remindAt: reminder?.dueAt ?? null, reminderStatus: reminder?.status ?? null
	} : {}) });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const writable = getWritableItem(event.params.id, user!.id);
	if (!writable) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const { item } = writable;
	const ts = now();
	db.transaction(tx => {
		tx.delete(items).where(eq(items.id, item.id)).run();
		tx.update(lists).set({ updatedAt: ts }).where(eq(lists.id, item.listId)).run();
	});
	emitToListMembers(item.listId, { type: 'item_deleted', listId: item.listId, id: item.id, wasChecked: item.isChecked, listUpdatedAt: ts, byUserId: user!.id });
	return Response.json({ ok: true });
};
