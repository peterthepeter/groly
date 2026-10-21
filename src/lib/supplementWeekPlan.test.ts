import { describe, expect, it } from 'vitest';
import { buildSupplementWeekPlan, supplementWeekDates, type WeekSchedule } from './supplementWeekPlan';

const schedules: WeekSchedule[] = [
	{ id: 'morning', supplementId: 'a', supplementName: 'A', days: '[0,1,2,3,4,5,6]', time: '09:00' },
	{ id: 'afternoon', supplementId: 'a', supplementName: 'A', days: '[0,1,2,3,4,5,6]', time: '14:00' }
];
const timestamp = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime();
const today = '2026-10-21';
const now = timestamp(today, '15:00');

describe('supplement week plan', () => {
	it('keeps Monday through Sunday across year and DST boundaries', () => {
		expect(supplementWeekDates('2027-01-03')).toEqual(['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03']);
		expect(supplementWeekDates('2026-10-25')).toEqual(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24', '2026-10-25']);
	});
	it('matches logs only within their own calendar date and closest time', () => {
		const rows = buildSupplementWeekPlan(schedules, today, { logs: [
			{ supplementId: 'a', loggedAt: timestamp('2026-10-19', '09:00') },
			{ supplementId: 'a', loggedAt: timestamp(today, '13:20') }
		], overrides: [] }, now);
		expect(rows[0].entries.map(entry => entry.done)).toEqual([true, false]);
		expect(rows[1].entries.map(entry => entry.done)).toEqual([false, false]);
		expect(rows[2].entries.map(entry => entry.done)).toEqual([false, true]);
	});
	it('uses date-specific true and false overrides, leaving future dates untaken', () => {
		const rows = buildSupplementWeekPlan(schedules, today, { logs: [
			{ supplementId: 'a', loggedAt: timestamp('2026-10-19', '09:00') }
		], overrides: [
			{ date: '2026-10-19', reminderTime: '09:00', done: false },
			{ date: '2026-10-20', reminderTime: '09:00', done: true },
			{ date: '2026-10-22', reminderTime: '09:00', done: true }
		] }, now);
		expect(rows[0].entries[0].done).toBe(false);
		expect(rows[1].entries[0].done).toBe(true);
		expect(rows[2].entries[0].done).toBe(false);
		expect(rows[3].entries[0].done).toBe(false);
	});
	it('keeps partial completion visible when supplements share a time', () => {
		const rows = buildSupplementWeekPlan([...schedules, { id: 'b', supplementId: 'b', supplementName: 'B', days: '[3]', time: '09:00' }], today, {
			logs: [{ supplementId: 'a', loggedAt: timestamp(today, '09:00') }], overrides: []
		}, now);
		expect(rows[2].entries.filter(entry => entry.time === '09:00').map(entry => entry.done)).toEqual([true, false]);
	});
	it('ignores invalid schedules and future log timestamps', () => {
		const rows = buildSupplementWeekPlan([...schedules,
			{ id: 'bad', supplementId: 'a', supplementName: 'A', days: '{}', time: '09:00' },
			{ id: 'bad-json', supplementId: 'a', supplementName: 'A', days: 'invalid', time: '09:00' }
		], today, { logs: [{ supplementId: 'a', loggedAt: timestamp(today, '16:00') }], overrides: [] }, now);
		expect(rows[2].entries).toHaveLength(2);
		expect(rows[2].entries.every(entry => !entry.done)).toBe(true);
	});
});
