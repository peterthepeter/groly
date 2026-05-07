import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements } from '$lib/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	const conditions = [eq(supplementLogs.userId, user!.id)];
	if (from) conditions.push(gte(supplementLogs.loggedAt, Number(from)));
	if (to)   conditions.push(lte(supplementLogs.loggedAt, Number(to)));

	const logs = db
		.select()
		.from(supplementLogs)
		.where(and(...conditions))
		.orderBy(supplementLogs.loggedAt)
		.all();

	return json({ logs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { supplementId, amount, loggedAt, note } = body;

		if (!supplementId) return json({ error: 'supplementId erforderlich' }, { status: 400 });
		if (typeof amount !== 'number' || amount <= 0) return json({ error: 'Menge muss > 0 sein' }, { status: 400 });

		// Verify supplement belongs to current user
		const supplement = db
			.select({ id: supplements.id })
			.from(supplements)
			.where(and(eq(supplements.id, supplementId), eq(supplements.userId, user!.id)))
			.get();
		if (!supplement) return json({ error: 'Not found' }, { status: 404 });

		const now = Date.now();
		const id = randomUUID();

		db.transaction(() => {
			db.insert(supplementLogs).values({
				id,
				userId: user!.id,
				supplementId,
				amount,
				loggedAt: loggedAt ?? now,
				note: (typeof note === 'string' && note.trim()) ? note.trim() : null,
				createdAt: now
			}).run();

			// Vorrat abziehen (nur wenn stockQuantity gesetzt und Supplement dem User gehört)
			db.update(supplements)
				.set({ stockQuantity: sql`CASE WHEN ${supplements.stockQuantity} IS NOT NULL THEN ${supplements.stockQuantity} - ${amount} ELSE NULL END` })
				.where(and(eq(supplements.id, supplementId), eq(supplements.userId, user!.id)))
				.run();
		});

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/supplement-logs error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
