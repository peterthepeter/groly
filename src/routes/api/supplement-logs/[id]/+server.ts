import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const existing = db
		.select()
		.from(supplementLogs)
		.where(and(eq(supplementLogs.id, id), eq(supplementLogs.userId, user!.id)))
		.get();

	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const newAmount = body.amount != null ? Number(body.amount) : existing.amount;
		const newLoggedAt = body.loggedAt != null ? Number(body.loggedAt) : existing.loggedAt;
		const newNote = 'note' in body
			? (typeof body.note === 'string' && body.note.trim() ? body.note.trim() : null)
			: existing.note;

		if (!isFinite(newAmount) || newAmount <= 0) {
			return json({ error: 'Menge muss > 0 sein' }, { status: 400 });
		}

		db.update(supplementLogs)
			.set({ amount: newAmount, loggedAt: newLoggedAt, note: newNote })
			.where(eq(supplementLogs.id, id))
			.run();

		// Vorrat anpassen: Differenz zum alten Wert ausgleichen
		if (newAmount !== existing.amount) {
			db.update(supplements)
				.set({ stockQuantity: sql`CASE WHEN ${supplements.stockQuantity} IS NOT NULL THEN ${supplements.stockQuantity} + ${existing.amount} - ${newAmount} ELSE NULL END` })
				.where(eq(supplements.id, existing.supplementId))
				.run();
		}

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const existing = db
		.select()
		.from(supplementLogs)
		.where(and(eq(supplementLogs.id, id), eq(supplementLogs.userId, user!.id)))
		.get();

	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	db.delete(supplementLogs).where(eq(supplementLogs.id, id)).run();

	// Vorrat zurückbuchen
	db.update(supplements)
		.set({ stockQuantity: sql`CASE WHEN ${supplements.stockQuantity} IS NOT NULL THEN ${supplements.stockQuantity} + ${existing.amount} ELSE NULL END` })
		.where(eq(supplements.id, existing.supplementId))
		.run();

	return json({ ok: true });
};
