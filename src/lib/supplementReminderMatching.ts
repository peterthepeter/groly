export const SUPPLEMENT_REMINDER_EARLY_WINDOW_MS = 45 * 60 * 1000;

export type SupplementReminderOccurrence = {
	id: string;
	supplementId: string;
	scheduledAt: number;
};

export type SupplementReminderLog = {
	supplementId: string;
	loggedAt: number;
};

/**
 * Assigns each log to at most one reminder of the same supplement. A log may be
 * up to 45 minutes early; late logs remain eligible and are assigned to the
 * closest still-open reminder.
 */
export function matchSupplementReminderLogs(
	reminders: SupplementReminderOccurrence[],
	logs: SupplementReminderLog[],
	notAfter = Number.POSITIVE_INFINITY
): Set<string> {
	const remindersBySupplement = new Map<string, SupplementReminderOccurrence[]>();
	for (const reminder of reminders) {
		const list = remindersBySupplement.get(reminder.supplementId) ?? [];
		list.push(reminder);
		remindersBySupplement.set(reminder.supplementId, list);
	}

	const logsBySupplement = new Map<string, SupplementReminderLog[]>();
	for (const log of logs) {
		if (!Number.isFinite(log.loggedAt) || log.loggedAt > notAfter) continue;
		const list = logsBySupplement.get(log.supplementId) ?? [];
		list.push(log);
		logsBySupplement.set(log.supplementId, list);
	}

	const matched = new Set<string>();
	for (const [supplementId, supplementLogs] of logsBySupplement) {
		const supplementReminders = remindersBySupplement.get(supplementId);
		if (!supplementReminders) continue;

		supplementLogs.sort((a, b) => a.loggedAt - b.loggedAt);
		for (const log of supplementLogs) {
			let best: SupplementReminderOccurrence | null = null;
			let bestDistance = Number.POSITIVE_INFINITY;

			for (const reminder of supplementReminders) {
				if (matched.has(reminder.id)) continue;
				if (log.loggedAt < reminder.scheduledAt - SUPPLEMENT_REMINDER_EARLY_WINDOW_MS) continue;

				const distance = Math.abs(log.loggedAt - reminder.scheduledAt);
				if (
					distance < bestDistance ||
					(distance === bestDistance && best !== null && reminder.scheduledAt < best.scheduledAt)
				) {
					best = reminder;
					bestDistance = distance;
				}
			}

			if (best) matched.add(best.id);
		}
	}

	return matched;
}
