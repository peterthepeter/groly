export type ListSortOrder = 'az' | 'za' | 'updated' | 'manual';
export const LIST_SORT_KEY = 'groly_list_sort';
export const LIST_ORDER_KEY = 'groly_list_order';

export function parseListOrder(raw: string | null): string[] {
	try {
		const value: unknown = JSON.parse(raw ?? 'null');
		return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string'))] : [];
	} catch { return []; }
}

export function parseListSort(raw: string | null, manualOrder: string[]): ListSortOrder {
	return raw === 'az' || raw === 'za' || raw === 'updated' || raw === 'manual'
		? raw : manualOrder.length ? 'manual' : 'updated';
}

export function sortLists<T extends { id: string; name: string; updatedAt: number }>(
	lists: T[], mode: ListSortOrder, manualOrder: string[], lang: string
): T[] {
	if (mode === 'manual') {
		const byId = new Map(lists.map(list => [list.id, list]));
		const ordered = [...new Set(manualOrder)].flatMap(id => byId.has(id) ? [byId.get(id)!] : []);
		const known = new Set(manualOrder);
		return [...ordered, ...lists.filter(list => !known.has(list.id))];
	}
	const collator = new Intl.Collator(lang, { numeric: true, sensitivity: 'base' });
	const alphabetical = (a: T, b: T) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id);
	return [...lists].sort(mode === 'updated'
		? (a, b) => a.updatedAt - b.updatedAt || alphabetical(a, b)
		: (a, b) => (mode === 'za' ? -1 : 1) * alphabetical(a, b));
}
