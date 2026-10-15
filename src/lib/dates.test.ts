import { afterEach, describe, expect, it } from 'vitest';
import { toLocalDateKey, tsToDateKey, todayKey } from './dates';

const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });

describe.each(['UTC', 'Europe/Berlin', 'Europe/Moscow', 'America/New_York', 'Pacific/Kiritimati'])('local calendar dates in %s', zone => {
	it.each([[2026, 9, 18], [2026, 2, 29], [2026, 9, 25], [2026, 11, 31], [2027, 0, 1], [2028, 1, 29]])('preserves local midnight for %i/%i/%i', (year, month, day) => {
		process.env.TZ = zone;
		const date = new Date(year, month, day, 0, 0, 0);
		const expected = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
		expect(toLocalDateKey(date)).toBe(expected);
		expect(tsToDateKey(date.getTime())).toBe(expected);
	});
	it('uses the current local calendar day for date input bounds', () => {
		process.env.TZ = zone;
		expect(todayKey()).toBe(toLocalDateKey(new Date()));
	});
});
