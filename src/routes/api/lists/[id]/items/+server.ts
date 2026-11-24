
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { items, users, lists, checklistReminders } from '#lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { emitToListMembers } from '#lib/server/userEvents';
import { schedulePushForItemAdded } from '#lib/server/pushDebounce';
import { now, generateId } from '#lib/auth';
import { isValidCategoryKey } from '#lib/categories';
import { getCategoryPreference } from '#lib/server/categoryPreferences';
import { getListAccess, parseChecklistSections } from '#lib/server/checklists';
import { parseChecklistNote } from '#lib/checklists';
import { toAddedItemEventPayload } from '#lib/server/itemEventPayload';
import { persistItemCreate } from '#lib/server/itemCreate';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (!list || permission === null) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	const listItems = db
		.select({
			id: items.id,
			listId: items.listId,
			name: items.name,
			quantityInfo: items.quantityInfo,
			isChecked: items.isChecked,
			checkedAt: items.checkedAt,
			categoryOverride: items.categoryOverride,
			sectionId: items.sectionId,
			checklistPosition: items.checklistPosition,
			checklistNote: items.checklistNote,
			remindAt: checklistReminders.dueAt,
			reminderStatus: checklistReminders.status,
			createdBy: items.createdBy,
			createdByUsername: users.username,
			createdAt: items.createdAt,
			updatedAt: items.updatedAt
		})
		.from(items)
		.leftJoin(checklistReminders, and(eq(checklistReminders.itemId, items.id), eq(checklistReminders.userId, user!.id)))
		.leftJoin(users, eq(items.createdBy, users.id))
		.where(eq(items.listId, event.params.id))
		.all();

	return Response.json(listItems);
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (!list || permission === null) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });
	if (permission === 'read') return Response.json({ error: 'Keine Schreibberechtigung' }, { status: 403 });

	const { name, quantityInfo, id: clientId, categoryOverride: requestedCategoryOverride, sectionId, kind, newSection, setDefault, checklistNote } = await event.request.json();
	if (typeof name !== 'string' || !name.trim()) return Response.json({ error: 'Name erforderlich' }, { status: 400 });
	if (kind !== undefined && kind !== list.kind) return Response.json({ error: 'List type does not match' }, { status: 409 });
	const checklist = list.kind === 'checklist';
	const note = checklistNote === undefined ? null : parseChecklistNote(checklistNote);
	if (checklistNote !== undefined && (!checklist || note === undefined)) {
		return Response.json({ error: 'Invalid checklist note' }, { status: 400 });
	}
	const changesSections = newSection !== undefined || setDefault === true;
	if (changesSections && (!checklist || permission !== 'owner')) {
		return Response.json({ error: 'Owner required' }, { status: 403 });
	}
	if (newSection !== undefined && (!newSection || newSection.id !== sectionId)) {
		return Response.json({ error: 'Invalid new section' }, { status: 400 });
	}
	if (!checklist && requestedCategoryOverride != null && !isValidCategoryKey(requestedCategoryOverride)) {
		return Response.json({ error: 'Ungültige Kategorie' }, { status: 400 });
	}

	const id = typeof clientId === 'string' && clientId.length > 0 && clientId.length <= 32
		? clientId
		: generateId(16);
	const ts = now();
	const trimmedName = name.trim();
	const trimmedQty = !checklist && typeof quantityInfo === 'string' ? quantityInfo.trim() : null;
	const categoryOverride = checklist ? null : requestedCategoryOverride ?? getCategoryPreference(user!.id, trimmedName);
	const create = (selectedSection: string | null) => persistItemCreate(db, {
		id,
		listId: event.params.id,
		name: trimmedName,
		quantityInfo: trimmedQty,
		categoryOverride,
		sectionId: selectedSection,
		checklistNote: note,
		kind: list.kind,
		createdBy: user!.id,
		createdAt: checklist ? Date.now() : ts,
		updatedAt: ts
	});
	const requestedSection = sectionId === undefined ? list.defaultSectionId : sectionId;
	const persisted = changesSections ? db.transaction(tx => {
		const current = tx.select().from(lists).where(eq(lists.id, list.id)).get()!;
		let sections = current.checklistSections ?? [];
		const requested = sectionId === undefined ? current.defaultSectionId : sectionId;
		const existing = tx.select().from(items).where(eq(items.id, id)).get();
		if (existing) return { item: existing, inserted: false };
		if (newSection !== undefined) {
			const known = sections.find(section => section.id === newSection.id);
			if (known && known.name !== newSection.name) return null;
			const valid = parseChecklistSections(known ? sections : [...sections, newSection]);
			if (!valid) return null;
			sections = valid;
		}
		const selectedSection = checklist && sections.some(section => section.id === requested) ? requested as string : null;
		if (setDefault === true && requested !== null && !selectedSection) return null;
		const result = create(selectedSection);
		tx.update(lists).set({
			checklistSections: sections, defaultSectionId: setDefault === true ? selectedSection : current.defaultSectionId
		}).where(eq(lists.id, list.id)).run();
		return result;
	}) : create(checklist && list.checklistSections?.some(section => section.id === requestedSection) ? requestedSection : null);
	if (!persisted) return Response.json({ error: 'Invalid checklist section' }, { status: 409 });

	if (!persisted.inserted) {
		if (persisted.item.listId !== event.params.id || persisted.item.createdBy !== user!.id) {
			return Response.json({ error: 'Item-ID bereits vergeben' }, { status: 409 });
		}
		const creator = db.select({ username: users.username }).from(users).where(eq(users.id, user!.id)).get();
		return Response.json(toAddedItemEventPayload(persisted.item, creator?.username ?? null));
	}

	const creator = db.select({ username: users.username }).from(users).where(eq(users.id, user!.id)).get();
	const newItem = toAddedItemEventPayload(persisted.item, creator?.username ?? null);

	emitToListMembers(event.params.id, { type: 'item_added', listId: event.params.id, item: newItem, listUpdatedAt: ts, byUserId: user!.id });

	if (changesSections) emitToListMembers(list.id, { type: 'checklist_refreshed', listId: list.id });

	schedulePushForItemAdded({
		listId: event.params.id,
		listName: list.name,
		itemName: trimmedName,
		adderUserId: user!.id,
		adderUsername: creator?.username ?? 'Jemand',
		url: `/listen/${event.params.id}`
	});

	return Response.json(newItem, { status: 201 });
};
