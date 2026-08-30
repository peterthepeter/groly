import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meditationReminderSchedules } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];

function validDays(value: unknown): value is number[] {
	return Array.isArray(value)
		&& value.length > 0
		&& value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

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
		const { days, time, onlyIfNotMeditated } = body;
		const normalizedDays = days === undefined ? ALL_DAYS : days;

		if (!time || !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });
		if (!validDays(normalizedDays)) return json({ error: 'Tage erforderlich' }, { status: 400 });

		const id = randomUUID();
		db.insert(meditationReminderSchedules).values({
			id,
			userId: user!.id,
			days: JSON.stringify([...new Set(normalizedDays)]),
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
