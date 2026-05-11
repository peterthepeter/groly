import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { moodLogs } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const date = event.params.date;
	if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
		return json({ error: 'Ungültiges Datum' }, { status: 400 });
	}

	db.delete(moodLogs)
		.where(and(eq(moodLogs.userId, user!.id), eq(moodLogs.date, date)))
		.run();

	return json({ ok: true });
};
