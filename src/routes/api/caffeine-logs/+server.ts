import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { caffeineLogs } from '$lib/db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	const conditions = [eq(caffeineLogs.userId, user!.id)];
	if (from) conditions.push(gte(caffeineLogs.loggedAt, Number(from)));
	if (to)   conditions.push(lte(caffeineLogs.loggedAt, Number(to)));

	const logs = db
		.select()
		.from(caffeineLogs)
		.where(and(...conditions))
		.orderBy(caffeineLogs.loggedAt)
		.all();

	return json({ logs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { drinkName, amountMl, caffeineMg, loggedAt } = body;

		if (typeof drinkName !== 'string' || !drinkName.trim())
			return json({ error: 'drinkName required' }, { status: 400 });
		if (typeof amountMl !== 'number' || amountMl <= 0 || !Number.isInteger(amountMl))
			return json({ error: 'amountMl muss eine positive ganze Zahl sein' }, { status: 400 });
		if (typeof caffeineMg !== 'number' || caffeineMg < 0 || !Number.isInteger(caffeineMg))
			return json({ error: 'caffeineMg muss eine nicht-negative ganze Zahl sein' }, { status: 400 });

		const now = Date.now();
		const id = randomUUID();

		db.insert(caffeineLogs).values({
			id,
			userId: user!.id,
			drinkName: drinkName.trim(),
			amountMl,
			caffeineMg,
			loggedAt: loggedAt ?? now,
			createdAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/caffeine-logs error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
