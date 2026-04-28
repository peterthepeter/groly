import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { caffeineLogs } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(caffeineLogs).where(and(eq(caffeineLogs.id, id), eq(caffeineLogs.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { amountMl, caffeineMg, loggedAt } = body;

		if (amountMl !== undefined && (!Number.isInteger(amountMl) || amountMl <= 0))
			return json({ error: 'amountMl muss positive Ganzzahl sein' }, { status: 400 });
		if (caffeineMg !== undefined && (!Number.isInteger(caffeineMg) || caffeineMg < 0))
			return json({ error: 'caffeineMg muss nicht-negative Ganzzahl sein' }, { status: 400 });

		db.update(caffeineLogs).set({
			...(amountMl !== undefined && { amountMl }),
			...(caffeineMg !== undefined && { caffeineMg }),
			...(loggedAt !== undefined && { loggedAt })
		}).where(eq(caffeineLogs.id, id)).run();

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(caffeineLogs).where(and(eq(caffeineLogs.id, id), eq(caffeineLogs.userId, user!.id))).get();
	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	db.delete(caffeineLogs).where(eq(caffeineLogs.id, id)).run();
	return json({ ok: true });
};
