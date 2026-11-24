
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { lists } from '#lib/db/schema';
import { eq, and } from 'drizzle-orm';

import { hasUserPushSubscription } from '#lib/server/pushNotifications';
import { clearRemovedChecklistSections, getListAccess, parseChecklistSections } from '#lib/server/checklists';
import { now } from '#lib/auth';
import { emitToListMembers } from '#lib/server/userEvents';

function getOwnedList(listId: string, userId: string) {
	return db.select().from(lists).where(and(eq(lists.id, listId), eq(lists.ownerId, userId))).get();
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (!list) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });
	return Response.json({ ...list, userPermission: permission, ...(list.kind === 'checklist' ? { pushAvailable: hasUserPushSubscription(user!.id) } : {}) });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const { name, description, iconId, locationLat, locationLng, locationName, checklistSections, defaultSectionId } = await event.request.json();
	if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Name erforderlich' }, { status: 400 });

	const ts = now();
	const trimmedName = name.trim();
	const trimmedDesc = description?.trim() ?? null;
	const sections = checklistSections === undefined ? list.checklistSections : parseChecklistSections(checklistSections);
	const sectionDefault = defaultSectionId === undefined ? list.defaultSectionId : defaultSectionId;
	if (checklistSections !== undefined && (list.kind !== 'checklist' || !sections) ||
		defaultSectionId !== undefined && list.kind !== 'checklist') {
		return Response.json({ error: 'Invalid checklist sections' }, { status: 400 });
	}
	if (sectionDefault !== null && !sections?.some(section => section.id === sectionDefault)) {
		return Response.json({ error: 'Invalid default checklist section' }, { status: 400 });
	}

	const changes = {
		name: trimmedName, description: trimmedDesc, iconId: iconId ?? null,
		locationLat: locationLat ?? null, locationLng: locationLng ?? null, locationName: locationName ?? null,
		checklistSections: sections, defaultSectionId: sectionDefault, updatedAt: ts
	};
	db.transaction(tx => {
		tx.update(lists).set(changes).where(eq(lists.id, list.id)).run();
		if (checklistSections !== undefined && sections) clearRemovedChecklistSections(tx, list.id, sections);
	});
	emitToListMembers(list.id, { type: 'list_updated', listId: list.id, list: changes });
	return Response.json({ ok: true });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const list = getOwnedList(event.params.id, user!.id);
	if (!list) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	emitToListMembers(list.id, { type: 'list_deleted', listId: list.id });
	db.delete(lists).where(eq(lists.id, list.id)).run();
	return Response.json({ ok: true });
};
