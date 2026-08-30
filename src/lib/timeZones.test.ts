import { describe, expect, it } from 'vitest';
import {
	getZonedDateTimeParts,
	resolveTimeZone,
	zonedDateTimeToTimestamp
} from './timeZones';

describe('time zone helpers', () => {
	it('uses the device zone for local weekday and time', () => {
		const parts = getZonedDateTimeParts(new Date('2026-08-30T09:29:00Z'), 'Europe/Berlin');
		expect(parts).toMatchObject({
			dateKey: '2026-08-30',
			time: '11:29',
			weekday: 0
		});
	});

	it('converts summer and winter wall-clock times to UTC', () => {
		expect(zonedDateTimeToTimestamp('2026-08-30', '09:00', 'Europe/Berlin'))
			.toBe(Date.parse('2026-08-30T07:00:00Z'));
		expect(zonedDateTimeToTimestamp('2026-01-30', '09:00', 'Europe/Berlin'))
			.toBe(Date.parse('2026-01-30T08:00:00Z'));
	});

	it('rejects invalid time zones', () => {
		expect(resolveTimeZone('not/a-zone', 'UTC')).toBe('UTC');
	});
});
