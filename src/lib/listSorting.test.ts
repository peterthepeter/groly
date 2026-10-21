import { describe, expect, it } from 'vitest';
import { parseListOrder, parseListSort, sortLists } from './listSorting';

const lists = [
	{ id: 'b', name: 'Brot 10', updatedAt: 30 },
	{ id: 'a', name: 'Äpfel', updatedAt: 20 },
	{ id: 'c', name: 'Brot 2', updatedAt: 10 }
];
const ids = (value: typeof lists) => value.map(list => list.id);

describe('list sorting', () => {
	it('preserves legacy manual order and recovers from invalid stored values', () => {
		expect(parseListOrder('["c","b","c",3,null]')).toEqual(['c', 'b']);
		for (const raw of ['{', '{}', 'null', '42']) expect(parseListOrder(raw)).toEqual([]);
		expect(parseListSort(null, ['b'])).toBe('manual');
		expect(parseListSort('broken', [])).toBe('updated');
		expect(parseListSort('za', ['b'])).toBe('za');
	});
	it('sorts names using language and natural numbers without changing input', () => {
		expect(ids(sortLists(lists, 'az', [], 'de'))).toEqual(['a', 'c', 'b']);
		expect(ids(sortLists(lists, 'za', [], 'en'))).toEqual(['b', 'c', 'a']);
		expect(ids(lists)).toEqual(['b', 'a', 'c']);
	});
	it('puts the latest change at the bottom and uses deterministic ties', () => {
		expect(ids(sortLists(lists, 'updated', ['b', 'a', 'c'], 'de'))).toEqual(['c', 'a', 'b']);
		expect(ids(sortLists(lists.map(list => ({ ...list, updatedAt: 1 })), 'updated', [], 'de'))).toEqual(['a', 'c', 'b']);
	});
	it('restores manual order across automatic sorting and appends new lists', () => {
		const manual = ['c', 'removed', 'b', 'c'];
		expect(ids(sortLists(lists, 'manual', manual, 'de'))).toEqual(['c', 'b', 'a']);
		sortLists(lists, 'za', manual, 'de');
		expect(ids(sortLists(lists.map(list => ({ ...list, updatedAt: 999 })), 'manual', manual, 'de'))).toEqual(['c', 'b', 'a']);
		expect(manual).toEqual(['c', 'removed', 'b', 'c']);
	});
});
