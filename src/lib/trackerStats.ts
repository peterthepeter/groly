// Shared computations for History views (Week/Month) and PDF export.
// Single source of truth: in-app cards and exported reports must always match.

import { toLocalDateKey, tsToDateKey } from './dates';

export type DateRange = { from: number; to: number };

export type SupplementMeta = { id: string; name: string; unit: string };
export type SupplementLogLite = { supplementId: string; amount: number; loggedAt: number };
export type ScheduleLite = { supplementId: string; days: string; time: string; active: boolean };

export type DailyFill = 'full' | 'partial' | 'none' | 'unscheduled';

export type SupplementAdherence = {
	supplementId: string;
	name: string;
	unit: string;
	taken: number;        // number of days with ≥1 log within range
	planned: number;      // number of days with ≥1 scheduled reminder within range (0 if no schedule)
	totalDoses: number;   // sum of log.amount (legacy "total")
	percent: number;      // 0..100; if planned==0, equals taken/totalDays*100
	totalDays: number;    // number of days in range
	daily: DailyFill[];   // length === totalDays, ordered earliest → latest
};

export type TrackerStats = {
	avgPerDay: number;
	min: number;
	max: number;
	activeDays: number;
	totalDays: number;
	total: number;
	daily: number[];      // length === totalDays
};

export type MoodStats = {
	avg: number;
	count: number;
	totalDays: number;
	trend: 'up' | 'down' | 'flat';
	daily: (number | null)[]; // length === totalDays
};

export function eachDayInRange(range: DateRange): string[] {
	const start = new Date(range.from);
	start.setHours(0, 0, 0, 0);
	const end = new Date(range.to);
	end.setHours(0, 0, 0, 0);
	const days: string[] = [];
	const cur = new Date(start);
	while (cur.getTime() <= end.getTime()) {
		days.push(toLocalDateKey(cur));
		cur.setDate(cur.getDate() + 1);
	}
	return days;
}

export function parseDaysMask(json: string): number[] {
	try {
		const arr = JSON.parse(json);
		return Array.isArray(arr) ? arr.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6) : [];
	} catch {
		return [];
	}
}

export function computeAdherence(
	supps: SupplementMeta[],
	schedules: ScheduleLite[],
	logs: SupplementLogLite[],
	range: DateRange
): SupplementAdherence[] {
	const days = eachDayInRange(range);
	const totalDays = days.length;
	if (totalDays === 0) return [];

	const dayIndex = new Map<string, number>();
	days.forEach((d, i) => dayIndex.set(d, i));

	const schedulesBySupp = new Map<string, ScheduleLite[]>();
	for (const s of schedules) {
		if (!s.active) continue;
		const list = schedulesBySupp.get(s.supplementId) ?? [];
		list.push(s);
		schedulesBySupp.set(s.supplementId, list);
	}

	const plannedPerDayBySupp = new Map<string, number[]>();
	for (const supp of supps) {
		const supSchedules = schedulesBySupp.get(supp.id) ?? [];
		const perDay = new Array(totalDays).fill(0) as number[];
		if (supSchedules.length > 0) {
			for (let i = 0; i < totalDays; i++) {
				const dateObj = new Date(days[i] + 'T12:00:00');
				const weekday = dateObj.getDay(); // 0=Sun..6=Sat
				for (const sch of supSchedules) {
					const mask = parseDaysMask(sch.days);
					if (mask.includes(weekday)) perDay[i] += 1;
				}
			}
		}
		plannedPerDayBySupp.set(supp.id, perDay);
	}

	const takenPerDayBySupp = new Map<string, number[]>();
	const totalDosesBySupp = new Map<string, number>();
	for (const log of logs) {
		const key = tsToDateKey(log.loggedAt);
		const idx = dayIndex.get(key);
		if (idx === undefined) continue;
		const arr = takenPerDayBySupp.get(log.supplementId) ?? new Array(totalDays).fill(0);
		arr[idx] += 1;
		takenPerDayBySupp.set(log.supplementId, arr);
		totalDosesBySupp.set(log.supplementId, (totalDosesBySupp.get(log.supplementId) ?? 0) + log.amount);
	}

	const result: SupplementAdherence[] = [];
	for (const supp of supps) {
		const planned = plannedPerDayBySupp.get(supp.id) ?? new Array(totalDays).fill(0);
		const taken = takenPerDayBySupp.get(supp.id) ?? new Array(totalDays).fill(0);
		const hasSchedule = planned.some(p => p > 0);
		const hasAnyLog = taken.some(t => t > 0);
		if (!hasSchedule && !hasAnyLog) continue; // skip irrelevant supplements

		const daily: DailyFill[] = [];
		let takenDaysAll = 0;       // any-day takes (including extra outside schedule)
		let scheduledTaken = 0;     // capped: days planned AND taken at least 1×
		let plannedDays = 0;
		for (let i = 0; i < totalDays; i++) {
			const p = planned[i];
			const t = taken[i];
			if (t > 0) takenDaysAll += 1;
			if (p > 0) plannedDays += 1;
			if (p > 0 && t > 0) scheduledTaken += 1;
			if (p === 0) {
				// unscheduled day: green dot if taken anyway, faint dot otherwise
				daily.push(t > 0 ? 'full' : 'unscheduled');
			} else {
				if (t === 0) daily.push('none');
				else if (t >= p) daily.push('full');
				else daily.push('partial');
			}
		}

		// Adherence semantics:
		//   • with schedule: scheduledTaken / plannedDays (capped to 100% by construction)
		//   • without schedule: takenDaysAll / totalDays (just "on how many days")
		const takenForDisplay = hasSchedule ? scheduledTaken : takenDaysAll;
		const denomForDisplay = hasSchedule ? plannedDays : totalDays;
		const percent = denomForDisplay > 0
			? Math.min(100, Math.round((takenForDisplay / denomForDisplay) * 100))
			: 0;

		result.push({
			supplementId: supp.id,
			name: supp.name,
			unit: supp.unit,
			taken: takenForDisplay,
			planned: hasSchedule ? plannedDays : 0,
			totalDoses: totalDosesBySupp.get(supp.id) ?? 0,
			percent,
			totalDays,
			daily
		});
	}

	result.sort((a, b) => a.name.localeCompare(b.name));
	return result;
}

export function computeTrackerStats(
	logs: { value: number; loggedAt: number }[],
	range: DateRange
): TrackerStats {
	const days = eachDayInRange(range);
	const totalDays = days.length;
	const dayIndex = new Map<string, number>();
	days.forEach((d, i) => dayIndex.set(d, i));

	const daily = new Array(totalDays).fill(0) as number[];
	for (const log of logs) {
		const key = tsToDateKey(log.loggedAt);
		const idx = dayIndex.get(key);
		if (idx === undefined) continue;
		daily[idx] += log.value;
	}

	const nonZero = daily.filter(v => v > 0);
	const total = daily.reduce((s, v) => s + v, 0);
	const activeDays = nonZero.length;
	const avgPerDay = totalDays > 0 ? total / totalDays : 0;
	const min = nonZero.length > 0 ? Math.min(...nonZero) : 0;
	const max = nonZero.length > 0 ? Math.max(...nonZero) : 0;

	return { avgPerDay, min, max, activeDays, totalDays, total, daily };
}

export function computeMoodStats(
	logs: { date: string; mood: number }[],
	range: DateRange
): MoodStats {
	const days = eachDayInRange(range);
	const totalDays = days.length;
	const dayIndex = new Map<string, number>();
	days.forEach((d, i) => dayIndex.set(d, i));

	const daily: (number | null)[] = new Array(totalDays).fill(null);
	for (const l of logs) {
		const idx = dayIndex.get(l.date);
		if (idx === undefined) continue;
		daily[idx] = l.mood;
	}

	const moods = daily.filter((v): v is number => v !== null);
	const count = moods.length;
	const avg = count > 0 ? moods.reduce((s, v) => s + v, 0) / count : 0;

	let trend: MoodStats['trend'] = 'flat';
	if (count >= 2) {
		const mid = Math.floor(totalDays / 2);
		const firstHalf = daily.slice(0, mid).filter((v): v is number => v !== null);
		const secondHalf = daily.slice(mid).filter((v): v is number => v !== null);
		if (firstHalf.length > 0 && secondHalf.length > 0) {
			const a = firstHalf.reduce((s, v) => s + v, 0) / firstHalf.length;
			const b = secondHalf.reduce((s, v) => s + v, 0) / secondHalf.length;
			const delta = b - a;
			if (delta > 0.3) trend = 'up';
			else if (delta < -0.3) trend = 'down';
		}
	}

	return { avg, count, totalDays, trend, daily };
}
