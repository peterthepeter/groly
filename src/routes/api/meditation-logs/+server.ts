import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meditationLogs } from '$lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	const conditions = [eq(meditationLogs.userId, user!.id)];
	if (from) conditions.push(gte(meditationLogs.loggedAt, Number(from)));
	if (to)   conditions.push(lte(meditationLogs.loggedAt, Number(to)));

	const logs = db
		.select()
		.from(meditationLogs)
		.where(and(...conditions))
		.orderBy(meditationLogs.loggedAt)
		.all();

	return json({ logs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { durationSeconds, loggedAt } = body;

		if (typeof durationSeconds !== 'number' || durationSeconds <= 0 || !Number.isInteger(durationSeconds)) {
			return json({ error: 'durationSeconds muss eine positive ganze Zahl sein' }, { status: 400 });
		}

		const now = Date.now();
		const id = randomUUID();

		db.insert(meditationLogs).values({
			id,
			userId: user!.id,
			durationSeconds,
			loggedAt: loggedAt ?? now,
			createdAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/meditation-logs error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
