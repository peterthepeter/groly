import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementReminderSchedules, supplements } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	// Load schedule and verify ownership via supplement
	const schedule = db
		.select({ schedule: supplementReminderSchedules, userId: supplements.userId })
		.from(supplementReminderSchedules)
		.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
		.where(eq(supplementReminderSchedules.id, id))
		.get();

	if (!schedule || schedule.userId !== user!.id) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { days, time, active } = body;

		if (days !== undefined && (!Array.isArray(days) || days.length === 0)) {
			return json({ error: 'Mindestens ein Tag erforderlich' }, { status: 400 });
		}
		if (time !== undefined && !/^\d{2}:\d{2}$/.test(time)) {
			return json({ error: 'Zeit ungültig (HH:MM)' }, { status: 400 });
		}

		db.update(supplementReminderSchedules)
			.set({
				...(days !== undefined && { days: JSON.stringify(days) }),
				...(time !== undefined && { time }),
				...(active !== undefined && { active })
			})
			.where(eq(supplementReminderSchedules.id, id))
			.run();

		return json({ ok: true });
	} catch (e) {
		console.error('PUT /api/supplement-reminders/[id] error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const schedule = db
		.select({ schedule: supplementReminderSchedules, userId: supplements.userId })
		.from(supplementReminderSchedules)
		.innerJoin(supplements, eq(supplementReminderSchedules.supplementId, supplements.id))
		.where(eq(supplementReminderSchedules.id, id))
		.get();

	if (!schedule || schedule.userId !== user!.id) return json({ error: 'Not found' }, { status: 404 });

	db.delete(supplementReminderSchedules)
		.where(eq(supplementReminderSchedules.id, id))
		.run();

	return json({ ok: true });
};
