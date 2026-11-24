import { afterEach, describe, expect, it } from 'vitest';
import { detectRegionalFormats, formatCalendarDate, formatClockTime, formatDateKey, toLocalDateKey, tsToDateKey, todayKey } from './dates';

const originalZone = process.env.TZ;
afterEach(() => { if (originalZone === undefined) delete process.env.TZ; else process.env.TZ = originalZone; });

it.each([
	['en-US', 'mdy-slash', '12h'],
	['en-GB', 'dmy-slash', '24h'],
	['de-DE', 'dmy-dot', '24h'],
	['it-IT', 'dmy-slash', '24h'],
	['en-GB-u-hc-h12', 'dmy-slash', '12h'],
	['en-US-u-hc-h23', 'mdy-slash', '24h'],
	['sv-SE', 'ymd-dash', '24h']
])('detects supported date and time formats for %s', (locale, dateFormat, timeFormat) => {
	expect(detectRegionalFormats(locale)).toEqual({ dateFormat, timeFormat });
});

it('keeps the selected date order across app languages and preserves compact date labels', () => {
	const date = new Date(2026, 10, 23, 18, 7);
	const full = { day: 'numeric', month: 'long', year: 'numeric' } as const;
	expect(formatCalendarDate(date, 'dmy-dot', full, 'en-US')).toBe('23.11.2026');
	expect(formatCalendarDate(date, 'mdy-slash', full, 'de-DE')).toBe('11/23/2026');
	expect(formatCalendarDate(date, 'ymd-dash', { day: 'numeric', month: 'short' }, 'it-IT')).toBe('11-23');
	expect(formatCalendarDate(date, 'mdy-slash', { month: 'long', year: 'numeric' }, 'de-DE')).toBe('November 2026');
});

it('formats time of day and full dates without changing keys', () => {
	expect(formatDateKey('2026-11-23', 'dmy-slash')).toBe('23/11/2026');
	expect(formatDateKey('2026-11-23', 'ymd-dash')).toBe('2026-11-23');
	expect(formatClockTime('18:07', '24h')).toBe('18:07');
	expect(formatClockTime('00:07', '12h')).toBe('12:07 AM');
	expect(formatClockTime('12:07', '12h')).toBe('12:07 PM');
	expect(formatClockTime('18:07', '12h')).toBe('6:07 PM');
});

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
