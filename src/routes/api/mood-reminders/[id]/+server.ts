import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { moodReminderSchedules } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(moodReminderSchedules).where(and(eq(moodReminderSchedules.id, id), eq(moodReminderSchedules.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { days, time, onlyIfNotRated, active } = body;

		if (time !== undefined && !/^\d{2}:\d{2}$/.test(time)) return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });
		if (days !== undefined && (!Array.isArray(days) || days.length === 0)) return json({ error: 'Tage erforderlich' }, { status: 400 });

		db.update(moodReminderSchedules).set({
			...(days !== undefined && { days: JSON.stringify(days) }),
			...(time !== undefined && { time }),
			...(onlyIfNotRated !== undefined && { onlyIfNotRated }),
			...(active !== undefined && { active })
		}).where(eq(moodReminderSchedules.id, id)).run();

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(moodReminderSchedules).where(and(eq(moodReminderSchedules.id, id), eq(moodReminderSchedules.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	db.delete(moodReminderSchedules).where(eq(moodReminderSchedules.id, id)).run();
	return json({ ok: true });
};
