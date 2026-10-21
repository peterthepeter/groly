import { toLocalDateKey, tsToDateKey } from './dates';
import { matchSupplementReminderLogs, type SupplementReminderLog } from './supplementReminderMatching';

export type WeekSchedule = { id?: string; supplementId: string; supplementName: string; days: string; time: string };
export type WeekOverride = { date: string; reminderTime: string; done: boolean };
export type WeekCompletion = { logs: SupplementReminderLog[]; overrides: WeekOverride[] };

/** Calendar arithmetic uses UTC noon so a DST change cannot skip or repeat a day. */
export function supplementWeekDates(today: string): string[] {
	const monday = new Date(`${today}T12:00:00Z`);
	monday.setUTCDate(monday.getUTCDate() - (monday.getUTCDay() + 6) % 7);
	return Array.from({ length: 7 }, (_, i) => {
		const date = new Date(monday);
		date.setUTCDate(date.getUTCDate() + i);
		return date.toISOString().slice(0, 10);
	});
}

export function buildSupplementWeekPlan(schedules: WeekSchedule[], today: string, completion?: WeekCompletion | null, now = Date.now()) {
	const logsByDate = new Map<string, SupplementReminderLog[]>();
	for (const log of completion?.logs ?? []) {
		if (!Number.isFinite(log.loggedAt) || log.loggedAt > now) continue;
		const date = tsToDateKey(log.loggedAt);
		const logs = logsByDate.get(date) ?? [];
		logs.push(log);
		logsByDate.set(date, logs);
	}
	const overrides = new Map((completion?.overrides ?? []).map(override => [`${override.date}:${override.reminderTime}`, override.done]));
	const parsed = schedules.flatMap((schedule, index) => {
		try {
			const days: unknown = JSON.parse(schedule.days);
			return Array.isArray(days) ? [{ ...schedule, days, key: schedule.id ?? `${schedule.supplementId}:${schedule.time}:${index}` }] : [];
		} catch { return []; }
	});
	return supplementWeekDates(today).map(date => {
		const day = new Date(`${date}T12:00:00Z`).getUTCDay();
		const planned = parsed.filter(schedule => schedule.days.includes(day));
		// Match separately per date: a later day's log must never complete an earlier day.
		const matched = matchSupplementReminderLogs(planned.map(schedule => ({
			id: schedule.key,
			supplementId: schedule.supplementId,
			scheduledAt: new Date(`${date}T${schedule.time}:00`).getTime()
		})), logsByDate.get(date) ?? [], now);
		const entries = planned.map(schedule => ({
			id: schedule.key,
			supplementId: schedule.supplementId,
			name: schedule.supplementName,
			time: schedule.time,
			done: date <= toLocalDateKey(new Date(now)) && (overrides.get(`${date}:${schedule.time}`) ?? matched.has(schedule.key))
		})).sort((a, b) => a.time.localeCompare(b.time) || a.name.localeCompare(b.name));
		return { date, day, entries };
	});
}
