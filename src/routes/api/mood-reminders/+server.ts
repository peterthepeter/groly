import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { moodReminderSchedules } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db
		.select()
		.from(moodReminderSchedules)
		.where(eq(moodReminderSchedules.userId, user!.id))
		.orderBy(moodReminderSchedules.createdAt)
		.all();

	return json({ schedules: rows });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { days, time, onlyIfNotRated } = body;

		if (!time || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });
		if (!Array.isArray(days) || days.length === 0) return json({ error: 'Tage erforderlich' }, { status: 400 });

		const id = randomUUID();
		db.insert(moodReminderSchedules).values({
			id,
			userId: user!.id,
			days: JSON.stringify(days),
			time,
			onlyIfNotRated: onlyIfNotRated ?? true,
			active: true,
			createdAt: Date.now()
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
