export type ListKind = 'shopping' | 'checklist';
export type ChecklistSection = { id: string; name: string };

export const CHECKLIST_SECTION_LIMIT = 50;
export const CHECKLIST_SECTION_NAME_LIMIT = 80;
export const CHECKLIST_NOTE_LIMIT = 2000;

export type ChecklistSettings = {
	checklistSections: ChecklistSection[];
	defaultSectionId: string | null;
};

export type ChecklistEntryFields = {
	id: string;
	name: string;
	isChecked: boolean;
	checklistNote?: string | null;
	sectionId?: string | null;
	checklistPosition?: number | null;
	createdAt?: number;
	remindAt?: number | null;
	reminderStatus?: 'syncing' | 'pending' | 'sent' | 'missed' | null;
};

export type ChecklistEntryEdit = {
	name: string;
	sectionId: string | null;
	checklistNote?: string | null;
	remindAt?: number | null;
};

export type ChecklistSectionChoice = { newSection?: ChecklistSection; setDefault?: boolean };

export function validChecklistSections(sections: ChecklistSection[]): boolean {
	return sections.every(section => section.name.trim()) &&
		new Set(sections.map(section => section.name.trim().toLowerCase())).size === sections.length;
}

export function clearMissingChecklistSection<T extends ChecklistEntryFields>(entry: T, sectionIds: Set<string>): T {
	return entry.sectionId && !sectionIds.has(entry.sectionId) ? { ...entry, sectionId: null, checklistPosition: null } : entry;
}

export function parseChecklistNote(value: unknown): string | null | undefined {
	if (value === null) return null;
	if (typeof value !== 'string' || value.length > CHECKLIST_NOTE_LIMIT) return undefined;
	return value.trim() || null;
}

export function orderChecklistRows<T extends { id: string }>(rows: T[], ids: string[]): T[] {
	const rank = new Map(ids.map((id, index) => [id, index]));
	return [...rows].sort((a, b) => (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export function compareChecklistEntries(a: ChecklistEntryFields, b: ChecklistEntryFields): number {
	return (a.checklistPosition ?? Infinity) - (b.checklistPosition ?? Infinity)
		|| (a.createdAt ?? 0) - (b.createdAt ?? 0) || a.id.localeCompare(b.id);
}
