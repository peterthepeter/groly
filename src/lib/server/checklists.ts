import { and, eq, isNotNull, notInArray } from 'drizzle-orm';
import { CHECKLIST_SECTION_LIMIT, CHECKLIST_SECTION_NAME_LIMIT, type ChecklistSection } from '#lib/checklists';
import { db } from '#lib/db';
import { items, listMembers, lists } from '#lib/db/schema';

export function getListAccess(listId: string, userId: string) {
	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return { list: null, permission: null };
	if (list.ownerId === userId) return { list, permission: 'owner' } as const;
	const member = db.select().from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId), eq(listMembers.status, 'accepted'))).get();
	return member ? { list, permission: member.permission } : { list: null, permission: null };
}

export function parseChecklistSections(value: unknown): ChecklistSection[] | null {
	if (!Array.isArray(value) || value.length > CHECKLIST_SECTION_LIMIT) return null;
	const ids = new Set<string>();
	const names = new Set<string>();
	const sections: ChecklistSection[] = [];
	for (const entry of value) {
		if (typeof entry?.id !== 'string' || !/^[\w-]{1,64}$/.test(entry.id) || ids.has(entry.id)) return null;
		if (typeof entry.name !== 'string') return null;
		const name = entry.name.trim();
		const key = name.toLowerCase();
		if (!name || name.length > CHECKLIST_SECTION_NAME_LIMIT || names.has(key)) return null;
		ids.add(entry.id);
		names.add(key);
		sections.push({ id: entry.id, name });
	}
	return sections;
}

export function clearRemovedChecklistSections(tx: Pick<typeof db, 'update'>, listId: string, sections: ChecklistSection[]) {
	tx.update(items).set({ sectionId: null, checklistPosition: null }).where(and(
		eq(items.listId, listId), isNotNull(items.sectionId), notInArray(items.sectionId, sections.map(section => section.id))
	)).run();
}
