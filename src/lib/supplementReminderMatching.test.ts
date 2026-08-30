import { describe, expect, it } from 'vitest';
import { matchSupplementReminderLogs } from './supplementReminderMatching';

const minute = 60_000;
const at = (minutes: number) => minutes * minute;

describe('matchSupplementReminderLogs', () => {
	it('accepts a log 45 minutes early but not 46 minutes early', () => {
		const reminders = [{ id: 'noon', supplementId: 'q10', scheduledAt: at(12 * 60) }];

		expect(matchSupplementReminderLogs(reminders, [
			{ supplementId: 'q10', loggedAt: at(11 * 60 + 15) }
		])).toEqual(new Set(['noon']));
		expect(matchSupplementReminderLogs(reminders, [
			{ supplementId: 'q10', loggedAt: at(11 * 60 + 14) }
		])).toEqual(new Set());
	});

	it('assigns one log only to the closest eligible reminder', () => {
		const reminders = [
			{ id: 'morning', supplementId: 'same-supplement', scheduledAt: at(9 * 60) },
			{ id: 'noon', supplementId: 'same-supplement', scheduledAt: at(12 * 60) }
		];

		expect(matchSupplementReminderLogs(reminders, [
			{ supplementId: 'same-supplement', loggedAt: at(11 * 60 + 14) }
		])).toEqual(new Set(['morning']));
		expect(matchSupplementReminderLogs(reminders, [
			{ supplementId: 'same-supplement', loggedAt: at(11 * 60 + 20) }
		])).toEqual(new Set(['noon']));
	});

	it('keeps different supplement IDs independent', () => {
		const reminders = [
			{ id: 'first', supplementId: 'supplement-a', scheduledAt: at(9 * 60) },
			{ id: 'second', supplementId: 'supplement-b', scheduledAt: at(9 * 60) }
		];

		expect(matchSupplementReminderLogs(reminders, [
			{ supplementId: 'supplement-b', loggedAt: at(9 * 60) }
		])).toEqual(new Set(['second']));
	});

	it('uses separate logs for separate reminders and ignores future logs', () => {
		const reminders = [
			{ id: 'morning', supplementId: 'supplement', scheduledAt: at(9 * 60) },
			{ id: 'evening', supplementId: 'supplement', scheduledAt: at(21 * 60 + 30) }
		];
		const logs = [
			{ supplementId: 'supplement', loggedAt: at(10 * 60) },
			{ supplementId: 'supplement', loggedAt: at(21 * 60) }
		];

		expect(matchSupplementReminderLogs(reminders, logs, at(20 * 60))).toEqual(new Set(['morning']));
		expect(matchSupplementReminderLogs(reminders, logs, at(22 * 60))).toEqual(new Set(['morning', 'evening']));
	});
});
