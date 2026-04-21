import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { waterLogs } from '$lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	const conditions = [eq(waterLogs.userId, user!.id)];
	if (from) conditions.push(gte(waterLogs.loggedAt, Number(from)));
	if (to)   conditions.push(lte(waterLogs.loggedAt, Number(to)));

	const logs = db
		.select()
		.from(waterLogs)
		.where(and(...conditions))
		.orderBy(waterLogs.loggedAt)
		.all();

	return json({ logs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { amountMl, loggedAt } = body;

		if (typeof amountMl !== 'number' || amountMl <= 0 || !Number.isInteger(amountMl)) {
			return json({ error: 'amountMl muss eine positive ganze Zahl sein' }, { status: 400 });
		}

		const now = Date.now();
		const id = randomUUID();

		db.insert(waterLogs).values({
			id,
			userId: user!.id,
			amountMl,
			loggedAt: loggedAt ?? now,
			createdAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/water-logs error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
