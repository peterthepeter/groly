import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { moodLogs } from '$lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	const conditions = [eq(moodLogs.userId, user!.id)];
	if (from) conditions.push(gte(moodLogs.date, from));
	if (to)   conditions.push(lte(moodLogs.date, to));

	const logs = db
		.select()
		.from(moodLogs)
		.where(and(...conditions))
		.orderBy(moodLogs.date)
		.all();

	return json({ logs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { date, mood, activities, note, gratitude } = body;

		if (!date || typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return json({ error: 'Ungültiges Datum' }, { status: 400 });
		}
		if (typeof mood !== 'number' || mood < 1 || mood > 5) {
			return json({ error: 'Stimmung muss 1–5 sein' }, { status: 400 });
		}

		const now = Date.now();
		const activitiesJson = Array.isArray(activities) ? JSON.stringify(activities) : null;

		const existing = db
			.select({ id: moodLogs.id })
			.from(moodLogs)
			.where(and(eq(moodLogs.userId, user!.id), eq(moodLogs.date, date)))
			.get();

		if (existing) {
			db.update(moodLogs)
				.set({ mood, activities: activitiesJson, note: note ?? null, gratitude: gratitude ?? null, updatedAt: now })
				.where(eq(moodLogs.id, existing.id))
				.run();
			return json({ id: existing.id });
		}

		const id = randomUUID();
		db.insert(moodLogs).values({
			id,
			userId: user!.id,
			date,
			mood,
			activities: activitiesJson,
			note: note ?? null,
			gratitude: gratitude ?? null,
			createdAt: now,
			updatedAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/mood-logs error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
