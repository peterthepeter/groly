import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementReminderSchedules, supplements } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const supplementId = event.url.searchParams.get('supplementId');

	// Verify supplement belongs to user
	if (supplementId) {
		const supplement = db
			.select()
			.from(supplements)
			.where(and(eq(supplements.id, supplementId), eq(supplements.userId, user!.id)))
			.get();
		if (!supplement) return json({ error: 'Not found' }, { status: 404 });
	}

	if (supplementId) {
		const rows = db
			.select()
			.from(supplementReminderSchedules)
			.where(eq(supplementReminderSchedules.supplementId, supplementId))
			.orderBy(supplementReminderSchedules.createdAt)
			.all();
		return json({ schedules: rows });
	}

	// ?today=1 → return today's active reminders grouped by time
	if (event.url.searchParams.get('today') === '1') {
		const todayDay = new Date().getDay(); // 0=Sun … 6=Sat
		const allActive = db
			.select({
				time: supplementReminderSchedules.time,
				days: supplementReminderSchedules.days,
				supplementName: supplements.name
			})
			.from(supplementReminderSchedules)
			.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
			.where(and(
				eq(supplements.userId, user!.id),
				eq(supplementReminderSchedules.active, true)
			))
			.all();

		// Filter by today's weekday and group by time
		const byTime = new Map<string, string[]>();
		for (const row of allActive) {
			try {
				const days: number[] = JSON.parse(row.days);
				if (!days.includes(todayDay)) continue;
			} catch { continue; }
			if (!byTime.has(row.time)) byTime.set(row.time, []);
			byTime.get(row.time)!.push(row.supplementName);
		}

		const todayReminders = Array.from(byTime.entries())
			.sort(([a], [b]) => a.localeCompare(b))
			.map(([time, names]) => ({ time, names }));

		return json({ todayReminders });
	}

	// No supplementId → return all supplement IDs that have at least one reminder (for this user)
	const allRows = db
		.select({ supplementId: supplementReminderSchedules.supplementId })
		.from(supplementReminderSchedules)
		.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
		.where(eq(supplements.userId, user!.id))
		.all();
	const supplementIdsWithReminders = [...new Set(allRows.map(r => r.supplementId))];
	return json({ supplementIdsWithReminders });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { supplementId, days, time } = body;

		if (!supplementId) return json({ error: 'supplementId erforderlich' }, { status: 400 });
		if (!Array.isArray(days) || days.length === 0) return json({ error: 'Mindestens ein Tag erforderlich' }, { status: 400 });
		if (!time || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });

		// Verify supplement belongs to user
		const supplement = db
			.select()
			.from(supplements)
			.where(and(eq(supplements.id, supplementId), eq(supplements.userId, user!.id)))
			.get();
		if (!supplement) return json({ error: 'Supplement nicht gefunden' }, { status: 404 });

		const id = randomUUID();
		const now = Date.now();

		db.insert(supplementReminderSchedules).values({
			id,
			supplementId,
			days: JSON.stringify(days),
			time,
			active: true,
			createdAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/supplement-reminders error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
