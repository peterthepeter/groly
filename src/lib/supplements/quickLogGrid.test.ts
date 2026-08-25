import { describe, expect, it } from 'vitest';
import { layoutBottomUp, paginateQuickLogItems, sortQuickLogItems } from './quickLogGrid';

type Item = { id: string; name: string };

const items = (names: string[]): Item[] => names.map((name) => ({ id: name.toLowerCase(), name }));
const names = (values: Array<Item | null>): Array<string | null> => values.map((item) => item?.name ?? null);

describe('quick-log sorting', () => {
	it('sorts A to Z without mutating the source list', () => {
		const source = items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
		const sorted = sortQuickLogItems(source, 'az', {}, 'en');

		expect(sorted.map((item) => item.name)).toEqual(['All Night Long', 'Gut Pro', 'Multi Core', 'NAC']);
		expect(source.map((item) => item.name)).toEqual(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
	});

	it('sorts Z to A', () => {
		const sorted = sortQuickLogItems(items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']), 'za', {}, 'en');
		expect(sorted.map((item) => item.name)).toEqual(['NAC', 'Multi Core', 'Gut Pro', 'All Night Long']);
	});

	it('sorts by all-time log count descending and resolves ties A to Z', () => {
		const source = items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
		const sorted = sortQuickLogItems(source, 'freq', {
			'multi core': 48,
			'all night long': 39,
			nac: 22,
			'gut pro': 22
		}, 'en');

		expect(sorted.map((item) => item.name)).toEqual(['Multi Core', 'All Night Long', 'Gut Pro', 'NAC']);
	});

	it('sorts a complete count tie alphabetically', () => {
		const source = items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
		const sorted = sortQuickLogItems(source, 'freq', Object.fromEntries(source.map((item) => [item.id, 1])), 'en');
		expect(sorted.map((item) => item.name)).toEqual(['All Night Long', 'Gut Pro', 'Multi Core', 'NAC']);
	});
});

describe('bottom-up quick-log grid', () => {
	it('produces the exact A-to-Z grid for the four development supplements', () => {
		const source = items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
		const sorted = sortQuickLogItems(source, 'az', {}, 'en');

		expect(names(layoutBottomUp(sorted, 3))).toEqual([
			'NAC', null, null,
			'All Night Long', 'Gut Pro', 'Multi Core'
		]);
	});

	it('produces the exact frequency grid for the four development supplements', () => {
		const source = items(['NAC', 'All Night Long', 'Multi Core', 'Gut Pro']);
		const sorted = sortQuickLogItems(source, 'freq', {
			'multi core': 48,
			'all night long': 39,
			'gut pro': 22,
			nac: 22
		}, 'en');

		expect(names(layoutBottomUp(sorted, 3))).toEqual([
			'NAC', null, null,
			'Multi Core', 'All Night Long', 'Gut Pro'
		]);
	});

	it('places A B C in the bottom row and starts the partial row above on the left', () => {
		const grid = layoutBottomUp(items(['A', 'B', 'C', 'D']), 3);
		expect(names(grid)).toEqual(['D', null, null, 'A', 'B', 'C']);
	});

	it('preserves left-to-right order in every complete row', () => {
		const grid = layoutBottomUp(items(['A', 'B', 'C', 'D', 'E', 'F', 'G']), 3);
		expect(names(grid)).toEqual(['G', null, null, 'D', 'E', 'F', 'A', 'B', 'C']);
	});

	it('pads two-item top rows on the right', () => {
		const grid = layoutBottomUp(items(['A', 'B', 'C', 'D', 'E']), 3);
		expect(names(grid)).toEqual(['D', 'E', null, 'A', 'B', 'C']);
	});

	it('handles empty and complete grids without phantom rows', () => {
		expect(layoutBottomUp([], 3)).toEqual([]);
		expect(names(layoutBottomUp(items(['A', 'B', 'C']), 3))).toEqual(['A', 'B', 'C']);
	});

	it('lays out the five tracker tiles in two bottom-up columns', () => {
		expect(layoutBottomUp(['caffeine', 'water', 'nutrition', 'meditation', 'mood'], 2)).toEqual([
			'mood', null,
			'nutrition', 'meditation',
			'caffeine', 'water'
		]);
	});

	it('keeps a 20-item grid bottom-up with the partial top row aligned left', () => {
		const source = items(Array.from({ length: 20 }, (_, index) => String(index + 1).padStart(2, '0')));
		const grid = names(layoutBottomUp(source, 3));

		expect(grid.slice(0, 3)).toEqual(['19', '20', null]);
		expect(grid.slice(-3)).toEqual(['01', '02', '03']);
		expect(grid).toHaveLength(21);
	});

	it('rejects invalid column counts', () => {
		expect(() => layoutBottomUp(items(['A']), 0)).toThrow(RangeError);
	});
});

describe('quick-log pagination', () => {
	it('shows at most four caffeine drinks per page', () => {
		const source = items(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
		const pages = paginateQuickLogItems(source, 4);

		expect(pages.map(page => page.map(item => item.name))).toEqual([
			['1', '2', '3', '4'],
			['5', '6', '7', '8'],
			['9', '10']
		]);
		expect(source.map(item => item.name)).toEqual(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
	});

	it('rejects invalid page sizes', () => {
		expect(() => paginateQuickLogItems(['Espresso'], 0)).toThrow(RangeError);
	});
});
