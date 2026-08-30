import { db } from '$lib/db';
import {
	supplements,
	supplementLogs,
	supplementReminderSchedules,
	users,
	waterReminderSchedules,
	waterLogs,
	meditationReminderSchedules,
	meditationLogs,
	moodReminderSchedules,
	moodLogs
} from '$lib/db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { sendPushToUser } from './pushNotifications';
import { toLocalDateKey } from '$lib/dates';
import { matchSupplementReminderLogs } from '$lib/supplementReminderMatching';
import { getZonedDateTimeParts, timeZoneFromSettings, zonedDateTimeToTimestamp } from '$lib/timeZones';

async function checkSupplementReminders() {
	const now = new Date();

	// Load all active schedules with supplement name, userId and user language
	const activeSchedules = db
		.select({
			id: supplementReminderSchedules.id,
			supplementId: supplements.id,
			days: supplementReminderSchedules.days,
			time: supplementReminderSchedules.time,
			supplementName: supplements.name,
			userId: supplements.userId,
			userSettings: users.settings
		})
		.from(supplementReminderSchedules)
		.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
		.innerJoin(users, eq(supplements.userId, users.id))
		.where(and(
			eq(supplementReminderSchedules.active, true),
			eq(supplements.active, true)
		))
		.all();

	const schedulesByUser = new Map<string, typeof activeSchedules>();
	for (const schedule of activeSchedules) {
		const list = schedulesByUser.get(schedule.userId) ?? [];
		list.push(schedule);
		schedulesByUser.set(schedule.userId, list);
	}

	await Promise.allSettled(Array.from(schedulesByUser.entries()).map(async ([userId, schedules]) => {
		const timeZone = timeZoneFromSettings(schedules[0]?.userSettings);
		const localNow = getZonedDateTimeParts(now, timeZone);
		const todaySchedules = schedules.filter(schedule => {
			try {
				const days: number[] = JSON.parse(schedule.days);
				return days.includes(localNow.weekday);
			} catch {
				return false;
			}
		});
		const dueSchedules = todaySchedules.filter(schedule => schedule.time === localNow.time);
		if (dueSchedules.length === 0) return;

		const todayStart = zonedDateTimeToTimestamp(localNow.dateKey, '00:00', timeZone);
		const logs = db
			.select({ supplementId: supplementLogs.supplementId, loggedAt: supplementLogs.loggedAt })
			.from(supplementLogs)
			.where(and(
				eq(supplementLogs.userId, userId),
				gte(supplementLogs.loggedAt, todayStart),
				lte(supplementLogs.loggedAt, now.getTime())
			))
			.all();
		const matched = matchSupplementReminderLogs(
			todaySchedules.map(schedule => ({
				id: schedule.id,
				supplementId: schedule.supplementId,
				scheduledAt: zonedDateTimeToTimestamp(localNow.dateKey, schedule.time, timeZone)
			})),
			logs,
			now.getTime()
		);
		const names = new Set(
			dueSchedules
				.filter(schedule => !matched.has(schedule.id))
				.map(schedule => schedule.supplementName)
		);
		if (names.size === 0) return;

		let lang = 'de';
		try { if (schedules[0]?.userSettings && JSON.parse(schedules[0].userSettings)?.lang === 'en') lang = 'en'; } catch { /* use default */ }
		const list = Array.from(names);
		const nameList = list.length === 1
			? list[0]
			: `${list.slice(0, -1).join(', ')} & ${list[list.length - 1]}`;
		const title = lang === 'en' ? 'Supplement Reminder' : 'Supplement-Erinnerung';
		const body = lang === 'en' ? `Time to take: ${nameList}` : `Zeit für die Einnahme von: ${nameList}`;
		return sendPushToUser(userId, { title, body, url: '/tracker?action=log-supplement', tag: 'supplement-reminder' });
	}));
}

async function checkWaterReminders() {
	const now = new Date();
	const currentDay = now.getDay();
	const currentTotalMinutes = now.getHours() * 60 + now.getMinutes();

	const activeSchedules = db
		.select({
			days: waterReminderSchedules.days,
			startTime: waterReminderSchedules.startTime,
			endTime: waterReminderSchedules.endTime,
			intervalMinutes: waterReminderSchedules.intervalMinutes,
			userId: waterReminderSchedules.userId,
			userSettings: users.settings
		})
		.from(waterReminderSchedules)
		.innerJoin(users, eq(waterReminderSchedules.userId, users.id))
		.where(eq(waterReminderSchedules.active, true))
		.all();

	// Collect users whose schedule fires right now
	const usersToNotify = new Map<string, { intervalMinutes: number; settings: Record<string, unknown> }>();

	for (const s of activeSchedules) {
		try {
			const days: number[] = JSON.parse(s.days);
			if (!days.includes(currentDay)) continue;

			const settings = s.userSettings ? JSON.parse(s.userSettings) : {};
			if (!settings?.waterTrackerEnabled) continue;

			const [startH, startM] = s.startTime.split(':').map(Number);
			const [endH, endM] = s.endTime.split(':').map(Number);
			const startTotal = startH * 60 + startM;
			const endTotal = endH * 60 + endM;

			if (currentTotalMinutes < startTotal || currentTotalMinutes > endTotal) continue;

			// Only fire at exact interval slots (elapsed since window start)
			const elapsed = currentTotalMinutes - startTotal;
			if (elapsed % s.intervalMinutes !== 0) continue;

			// Keep the shortest interval if a user has multiple matching schedules
			const existing = usersToNotify.get(s.userId);
			if (!existing || s.intervalMinutes < existing.intervalMinutes) {
				usersToNotify.set(s.userId, { intervalMinutes: s.intervalMinutes, settings });
			}
		} catch { /* skip invalid schedule */ }
	}

	if (usersToNotify.size === 0) return;

	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	await Promise.allSettled(
		Array.from(usersToNotify.entries()).map(async ([userId, { intervalMinutes, settings }]) => {
			const goalMl: number = (settings?.waterGoalMl as number) ?? 2000;

			// Skip if daily goal already reached
			const totalRow = db
				.select({ total: sql<number>`COALESCE(SUM(amount_ml), 0)` })
				.from(waterLogs)
				.where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, todayStart)))
				.get();
			if ((totalRow?.total ?? 0) >= goalMl) return;

			// Skip if logged within the last interval
			const intervalMs = intervalMinutes * 60 * 1000;
			const recentLog = db
				.select({ id: waterLogs.id })
				.from(waterLogs)
				.where(and(eq(waterLogs.userId, userId), gte(waterLogs.loggedAt, Date.now() - intervalMs)))
				.get();
			if (recentLog) return;

			const lang = settings?.lang === 'en' ? 'en' : 'de';
			const title = lang === 'en' ? 'Hydration Tracker' : 'Wassertracker';
			const body = lang === 'en' ? 'Time for a glass of water (250 ml)' : 'Zeit für ein Glas Wasser (250 ml)';
			return sendPushToUser(userId, { title, body, url: '/tracker?action=log-water', tag: 'water-reminder' });
		})
	);
}

async function checkMeditationReminders() {
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	const todayDow = now.getDay(); // 0=So,1=Mo,...,6=Sa

	const activeSchedules = db
		.select({
			time: meditationReminderSchedules.time,
			days: meditationReminderSchedules.days,
			onlyIfNotMeditated: meditationReminderSchedules.onlyIfNotMeditated,
			userId: meditationReminderSchedules.userId,
			userSettings: users.settings
		})
		.from(meditationReminderSchedules)
		.innerJoin(users, eq(meditationReminderSchedules.userId, users.id))
		.where(eq(meditationReminderSchedules.active, true))
		.all();

	const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

	await Promise.allSettled(
		activeSchedules.map(async (s) => {
			try {
				if (s.time !== currentTime) return;
				const days: number[] = JSON.parse(s.days);
				if (!days.includes(todayDow)) return;
				const settings = s.userSettings ? JSON.parse(s.userSettings) : {};
				if (!settings?.meditationTrackerEnabled) return;

				if (s.onlyIfNotMeditated) {
					const existing = db
						.select({ id: meditationLogs.id })
						.from(meditationLogs)
						.where(and(eq(meditationLogs.userId, s.userId), gte(meditationLogs.loggedAt, todayStart)))
						.get();
					if (existing) return;
				}

				const lang = settings?.lang === 'en' ? 'en' : 'de';
				const title = lang === 'en' ? 'Meditation' : 'Meditation';
				const body = lang === 'en' ? 'Time for your daily meditation' : 'Zeit für deine tägliche Meditation';
				return sendPushToUser(s.userId, { title, body, url: '/tracker?action=log-meditation', tag: 'meditation-reminder' });
			} catch { /* skip invalid */ }
		})
	);
}

async function checkMoodReminders() {
	const now = new Date();
	const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	const todayDow = now.getDay(); // 0=So,1=Mo,...,6=Sa

	const activeSchedules = db
		.select({
			id: moodReminderSchedules.id,
			time: moodReminderSchedules.time,
			days: moodReminderSchedules.days,
			onlyIfNotRated: moodReminderSchedules.onlyIfNotRated,
			userId: moodReminderSchedules.userId,
			userSettings: users.settings
		})
		.from(moodReminderSchedules)
		.innerJoin(users, eq(moodReminderSchedules.userId, users.id))
		.where(eq(moodReminderSchedules.active, true))
		.all();

	const todayStr = toLocalDateKey(now);

	await Promise.allSettled(
		activeSchedules.map(async (s) => {
			try {
				if (s.time !== currentTime) return;
				const days: number[] = JSON.parse(s.days);
				if (!days.includes(todayDow)) return;
				const settings = s.userSettings ? JSON.parse(s.userSettings) : {};
				if (!settings?.moodTrackerEnabled) return;

				if (s.onlyIfNotRated) {
					const existing = db
						.select({ id: moodLogs.id })
						.from(moodLogs)
						.where(and(eq(moodLogs.userId, s.userId), eq(moodLogs.date, todayStr)))
						.get();
					if (existing) return;
				}

				const lang = settings?.lang === 'en' ? 'en' : 'de';
				const title = lang === 'en' ? 'How was your day?' : 'Wie war dein Tag?';
				const body = lang === 'en' ? 'Rate your day in Groly' : 'Bewerte deinen Tag in Groly';
				return sendPushToUser(s.userId, { title, body, url: '/tracker?action=log-mood', tag: 'mood-reminder' });
			} catch { /* skip invalid */ }
		})
	);
}

export function scheduleNextReminderCheck() {
	const msUntilNextMinute = 60_000 - (Date.now() % 60_000);
	setTimeout(async () => {
		await Promise.allSettled([
			checkSupplementReminders().catch(console.error),
			checkWaterReminders().catch(console.error),
			checkMeditationReminders().catch(console.error),
			checkMoodReminders().catch(console.error)
		]);
		scheduleNextReminderCheck();
	}, msUntilNextMinute);
}
