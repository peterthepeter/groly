import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { waterReminderSchedules } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db
		.select()
		.from(waterReminderSchedules)
		.where(eq(waterReminderSchedules.userId, user!.id))
		.orderBy(waterReminderSchedules.createdAt)
		.all();

	return json({ schedules: rows });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { days, startTime, endTime, intervalMinutes } = body;

		if (!Array.isArray(days) || days.length === 0) return json({ error: 'Mindestens ein Tag erforderlich' }, { status: 400 });
		if (!startTime || !/^\d{2}:\d{2}$/.test(startTime)) return json({ error: 'Startzeit ungültig (HH:MM)' }, { status: 400 });
		if (!endTime || !/^\d{2}:\d{2}$/.test(endTime)) return json({ error: 'Endzeit ungültig (HH:MM)' }, { status: 400 });
		if (!intervalMinutes || typeof intervalMinutes !== 'number' || intervalMinutes < 1) return json({ error: 'Intervall ungültig' }, { status: 400 });

		const id = randomUUID();
		db.insert(waterReminderSchedules).values({
			id,
			userId: user!.id,
			days: JSON.stringify(days),
			startTime,
			endTime,
			intervalMinutes,
			active: true,
			createdAt: Date.now()
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
