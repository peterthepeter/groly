import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meditationReminderSchedules } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

function validDays(value: unknown): value is number[] {
	return Array.isArray(value)
		&& value.length > 0
		&& value.every((day) => Number.isInteger(day) && day >= 0 && day <= 6);
}

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(meditationReminderSchedules).where(and(eq(meditationReminderSchedules.id, id), eq(meditationReminderSchedules.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { days, time, onlyIfNotMeditated, active } = body;

		if (time !== undefined && !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });
		if (days !== undefined && !validDays(days)) return json({ error: 'Tage erforderlich' }, { status: 400 });

		db.update(meditationReminderSchedules).set({
			...(days !== undefined && { days: JSON.stringify([...new Set(days)]) }),
			...(time !== undefined && { time }),
			...(onlyIfNotMeditated !== undefined && { onlyIfNotMeditated }),
			...(active !== undefined && { active })
		}).where(eq(meditationReminderSchedules.id, id)).run();

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(meditationReminderSchedules).where(and(eq(meditationReminderSchedules.id, id), eq(meditationReminderSchedules.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	db.delete(meditationReminderSchedules).where(eq(meditationReminderSchedules.id, id)).run();
	return json({ ok: true });
};
