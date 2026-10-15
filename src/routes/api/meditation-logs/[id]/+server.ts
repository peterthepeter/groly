
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { meditationLogs } from '#lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(meditationLogs).where(and(eq(meditationLogs.id, id), eq(meditationLogs.userId, user!.id))).get();
	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { durationSeconds, loggedAt } = body;
		if (durationSeconds !== undefined && (!Number.isInteger(durationSeconds) || durationSeconds <= 0))
			return Response.json({ error: 'durationSeconds muss positive Ganzzahl sein' }, { status: 400 });

		db.update(meditationLogs).set({
			...(durationSeconds !== undefined && { durationSeconds }),
			...(loggedAt !== undefined && { loggedAt })
		}).where(eq(meditationLogs.id, id)).run();

		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const existing = db
		.select()
		.from(meditationLogs)
		.where(and(eq(meditationLogs.id, id), eq(meditationLogs.userId, user!.id)))
		.get();

	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	db.delete(meditationLogs).where(eq(meditationLogs.id, id)).run();

	return Response.json({ ok: true });
};
