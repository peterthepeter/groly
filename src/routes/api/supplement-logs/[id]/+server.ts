import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { recalculateSupplementStock, restoreSupplementStock } from '$lib/supplementStock';

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

		db.transaction(() => {
			const supplement = db
				.select({ stockQuantity: supplements.stockQuantity })
				.from(supplements)
				.where(eq(supplements.id, existing.supplementId))
				.get();
			const stock = recalculateSupplementStock(
				supplement?.stockQuantity ?? null,
				existing.amount,
				existing.stockDeducted,
				newAmount
			);
			db.update(supplementLogs)
				.set({ amount: newAmount, loggedAt: newLoggedAt, note: newNote, stockDeducted: stock.stockDeducted })
				.where(eq(supplementLogs.id, id))
				.run();

			// Alten Abzug zurücknehmen und die neue Menge anwenden.
			if (newAmount !== existing.amount) {
				db.update(supplements)
					.set({ stockQuantity: stock.stockQuantity })
					.where(eq(supplements.id, existing.supplementId))
					.run();
			}
		});

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

	db.transaction(() => {
		db.delete(supplementLogs).where(eq(supplementLogs.id, id)).run();

		// Vorrat zurückbuchen
		const supplement = db
			.select({ stockQuantity: supplements.stockQuantity })
			.from(supplements)
			.where(eq(supplements.id, existing.supplementId))
			.get();
		db.update(supplements)
			.set({ stockQuantity: restoreSupplementStock(
				supplement?.stockQuantity ?? null,
				existing.amount,
				existing.stockDeducted
			) })
			.where(eq(supplements.id, existing.supplementId))
			.run();
	});

	return json({ ok: true });
};
