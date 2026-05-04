import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meditationReminderSchedules } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db
		.select()
		.from(meditationReminderSchedules)
		.where(eq(meditationReminderSchedules.userId, user!.id))
		.orderBy(meditationReminderSchedules.createdAt)
		.all();

	return json({ schedules: rows });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { time, onlyIfNotMeditated } = body;

		if (!time || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });

		const id = randomUUID();
		db.insert(meditationReminderSchedules).values({
			id,
			userId: user!.id,
			time,
			onlyIfNotMeditated: onlyIfNotMeditated ?? true,
			active: true,
			createdAt: Date.now()
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
