export type QuickLogSortOrder = 'az' | 'za' | 'freq';

export type QuickLogSortable = {
	id: string;
	name: string;
};

function countFor(id: string, counts: Readonly<Record<string, number>>): number {
	const count = counts[id];
	return Number.isFinite(count) && count > 0 ? count : 0;
}

/**
 * Returns the logical reading order. The first item is always the first tile in
 * the bottom row; layoutBottomUp() is responsible for its visual placement.
 */
export function sortQuickLogItems<T extends QuickLogSortable>(
	items: readonly T[],
	order: QuickLogSortOrder,
	counts: Readonly<Record<string, number>> = {},
	locale?: string
): T[] {
	const collator = new Intl.Collator(locale, { sensitivity: 'base', numeric: true });
	const compareByName = (a: T, b: T) => collator.compare(a.name, b.name) || a.id.localeCompare(b.id);

	return [...items].sort((a, b) => {
		if (order === 'freq') {
			const countDifference = countFor(b.id, counts) - countFor(a.id, counts);
			return countDifference || compareByName(a, b);
		}

		const nameDifference = compareByName(a, b);
		return order === 'za' ? -nameDifference : nameDifference;
	});
}

/**
 * Converts logical order into CSS-grid order while preserving complete rows.
 * Rows grow from bottom to top; every row reads from left to right. A partial
 * top row is padded on the right so its first item remains in the left column.
 */
export function layoutBottomUp<T>(items: readonly T[], columns = 3): Array<T | null> {
	return layoutBottomUpRows(items, columns).flat();
}

/**
 * Row-preserving variant for grids that insert expandable full-width content
 * between tile rows.
 */
export function layoutBottomUpRows<T>(items: readonly T[], columns = 3): Array<Array<T | null>> {
	if (!Number.isInteger(columns) || columns < 1) {
		throw new RangeError('columns must be a positive integer');
	}

	const rows: Array<Array<T | null>> = [];
	for (let index = 0; index < items.length; index += columns) {
		const row: Array<T | null> = items.slice(index, index + columns);
		while (row.length < columns) row.push(null);
		rows.push(row);
	}

	return rows.reverse();
}

/** Splits quick-log actions into stable, swipeable pages without mutating them. */
export function paginateQuickLogItems<T>(items: readonly T[], pageSize: number): T[][] {
	if (!Number.isInteger(pageSize) || pageSize < 1) {
		throw new RangeError('pageSize must be a positive integer');
	}

	const pages: T[][] = [];
	for (let index = 0; index < items.length; index += pageSize) {
		pages.push(items.slice(index, index + pageSize));
	}
	return pages;
}
