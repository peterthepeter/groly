import { and, eq, inArray, isNull, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { generateId, now } from '#lib/auth';
import { db } from '#lib/db';
import { items, lists } from '#lib/db/schema';
import { orderChecklistRows } from '#lib/checklists';
import { clearRemovedChecklistSections, getListAccess, parseChecklistSections } from '#lib/server/checklists';
import { emit, emitToListMembers } from '#lib/server/userEvents';

export const POST: RequestHandler = async event => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const body = await event.request.json();
	const { list, permission } = getListAccess(event.params.id, user!.id);
	if (list?.kind !== 'checklist') return Response.json({ error: 'Checklist not found' }, { status: 404 });

	const ts = now();
	if (permission === 'read' || (!['orderEntries', 'deleteEntries'].includes(body.action) && permission !== 'owner')) {
		return Response.json({ error: 'Insufficient permission' }, { status: 403 });
	}
	if (body.action === 'setDefault') {
		if (body.sectionId !== null && !list.checklistSections?.some(section => section.id === body.sectionId)) {
			return Response.json({ error: 'Unknown checklist section' }, { status: 409 });
		}
		db.update(lists).set({ defaultSectionId: body.sectionId, updatedAt: ts }).where(eq(lists.id, list.id)).run();
		emitToListMembers(list.id, { type: 'checklist_refreshed', listId: list.id });
		return Response.json({ ok: true });
	}
	if (body.action === 'updateSections') {
		const sections = parseChecklistSections(body.checklistSections);
		const { defaultSectionId } = body;
		if (!sections || (defaultSectionId !== null && !sections.some(section => section.id === defaultSectionId))) {
			return Response.json({ error: 'Invalid checklist sections' }, { status: 400 });
		}
		db.transaction(tx => {
			tx.update(lists).set({ checklistSections: sections, defaultSectionId, updatedAt: ts }).where(eq(lists.id, list.id)).run();
			clearRemovedChecklistSections(tx, list.id, sections);
		});
		emitToListMembers(list.id, { type: 'checklist_refreshed', listId: list.id });
		return Response.json({ ok: true });
	}
	if (['orderEntries', 'orderSections', 'deleteEntries'].includes(body.action)) {
		const ids = body.ids;
		if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string') || new Set(ids).size !== ids.length ||
			(body.action === 'orderEntries' && body.sectionId !== null && typeof body.sectionId !== 'string')) {
			return Response.json({ error: 'Invalid order' }, { status: 400 });
		}
		db.transaction(tx => {
			if (body.action === 'deleteEntries') {
				// Bound the number of SQLite variables even for a large offline selection.
				for (let start = 0; start < ids.length; start += 500) {
					tx.delete(items).where(and(eq(items.listId, list.id), inArray(items.id, ids.slice(start, start + 500)))).run();
				}
				tx.update(lists).set({ updatedAt: ts }).where(eq(lists.id, list.id)).run();
			} else if (body.action === 'orderSections') {
				const current = tx.select().from(lists).where(eq(lists.id, list.id)).get()!;
				tx.update(lists).set({ checklistSections: orderChecklistRows(current.checklistSections ?? [], ids), updatedAt: ts })
					.where(eq(lists.id, list.id)).run();
			} else {
				const section = body.sectionId === null ? isNull(items.sectionId) : eq(items.sectionId, body.sectionId);
				for (const [index, id] of ids.entries()) {
					tx.update(items).set({ checklistPosition: index })
						.where(and(eq(items.id, id), eq(items.listId, list.id), section)).run();
				}
				tx.update(lists).set({ updatedAt: ts }).where(eq(lists.id, list.id)).run();
			}
		});
		emitToListMembers(list.id, { type: 'checklist_refreshed', listId: list.id });
		return Response.json({ ok: true });
	}
	if (body.action === 'reset') {
		const changed = db.transaction(tx => {
			const result = tx.update(items).set({
				isChecked: false, checkedAt: null, updatedAt: sql`max(${items.updatedAt} + 1, ${Date.now()})`
			}).where(and(eq(items.listId, list.id), eq(items.isChecked, true))).run();
			if (result.changes) tx.update(lists).set({ updatedAt: ts }).where(eq(lists.id, list.id)).run();
			return result.changes;
		});
		if (changed) emitToListMembers(list.id, { type: 'checklist_refreshed', listId: list.id });
		return Response.json({ ok: true });
	}

	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const id = body.id;
	if (body.action !== 'duplicate' || !name || typeof id !== 'string' || !/^[a-zA-Z0-9_-]{16,40}$/.test(id)) {
		return Response.json({ error: 'Invalid checklist action' }, { status: 400 });
	}
	const duplicate = db.transaction(tx => {
		const existing = tx.select().from(lists).where(eq(lists.id, id)).get();
		if (existing) return existing.ownerId === user!.id && existing.kind === 'checklist';
		tx.insert(lists).values({
			id, name, kind: 'checklist', ownerId: user!.id, iconId: list.iconId, description: list.description,
			checklistSections: list.checklistSections, defaultSectionId: list.defaultSectionId, createdAt: ts, updatedAt: ts
		}).run();
		const sourceItems = tx.select().from(items).where(eq(items.listId, list.id))
			.orderBy(items.createdAt, items.id).all();
		for (const [index, item] of sourceItems.entries()) {
			tx.insert(items).values({
				id: generateId(16), name: item.name, listId: id, sectionId: item.sectionId, checklistPosition: item.checklistPosition,
				checklistNote: item.checklistNote,
				createdAt: Date.now() + index, updatedAt: Date.now(), createdBy: user!.id
			}).run();
		}
		return true;
	});
	if (!duplicate) return Response.json({ error: 'List ID already in use' }, { status: 409 });
	emit(user!.id, { type: 'checklist_refreshed', listId: id });
	return Response.json({ id }, { status: 201 });
};
