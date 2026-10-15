
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { waterReminderSchedules } from '#lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(waterReminderSchedules).where(and(eq(waterReminderSchedules.id, id), eq(waterReminderSchedules.userId, user!.id))).get();
	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { days, startTime, endTime, intervalMinutes, active } = body;

		if (days !== undefined && (!Array.isArray(days) || days.length === 0)) return Response.json({ error: 'Mindestens ein Tag erforderlich' }, { status: 400 });
		if (startTime !== undefined && !/^\d{2}:\d{2}$/.test(startTime)) return Response.json({ error: 'Startzeit ungültig (HH:MM)' }, { status: 400 });
		if (endTime !== undefined && !/^\d{2}:\d{2}$/.test(endTime)) return Response.json({ error: 'Endzeit ungültig (HH:MM)' }, { status: 400 });
		if (intervalMinutes !== undefined && (typeof intervalMinutes !== 'number' || intervalMinutes < 1)) return Response.json({ error: 'Intervall ungültig' }, { status: 400 });

		db.update(waterReminderSchedules).set({
			...(days !== undefined && { days: JSON.stringify(days) }),
			...(startTime !== undefined && { startTime }),
			...(endTime !== undefined && { endTime }),
			...(intervalMinutes !== undefined && { intervalMinutes }),
			...(active !== undefined && { active })
		}).where(eq(waterReminderSchedules.id, id)).run();

		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(waterReminderSchedules).where(and(eq(waterReminderSchedules.id, id), eq(waterReminderSchedules.userId, user!.id))).get();
	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	db.delete(waterReminderSchedules).where(eq(waterReminderSchedules.id, id)).run();
	return Response.json({ ok: true });
};
