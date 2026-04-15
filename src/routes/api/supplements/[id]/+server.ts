import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplements, supplementNutrients, supplementReminderSchedules } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const existing = db
		.select()
		.from(supplements)
		.where(and(eq(supplements.id, id), eq(supplements.userId, user!.id)))
		.get();

	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { name, unit, brand, info, notes, active, nutrients: nutrientRows, stockQuantity, defaultAmount } = body;

		db.transaction(() => {
			db.update(supplements)
				.set({
					name: name?.trim() ?? existing.name,
					unit: unit?.trim() ?? existing.unit,
					brand: brand !== undefined ? (brand?.trim() || null) : existing.brand,
					info: info !== undefined ? (info?.trim() || null) : existing.info,
					notes: notes?.trim() || null,
					active: active !== undefined ? active : existing.active,
					stockQuantity: stockQuantity !== undefined ? (stockQuantity != null ? Number(stockQuantity) : null) : existing.stockQuantity,
					defaultAmount: defaultAmount != null ? Number(defaultAmount) : existing.defaultAmount,
					updatedAt: Date.now()
				})
				.where(eq(supplements.id, id))
				.run();

			if (Array.isArray(nutrientRows)) {
				// Replace all nutrients
				db.delete(supplementNutrients)
					.where(eq(supplementNutrients.supplementId, id))
					.run();

				for (let i = 0; i < nutrientRows.length; i++) {
					const n = nutrientRows[i];
					if (!n.name?.trim()) continue;
					db.insert(supplementNutrients).values({
						id: randomUUID(),
						supplementId: id,
						name: n.name.trim(),
						amountPerUnit: Number(n.amountPerUnit) || 0,
						unit: n.unit?.trim() || '',
						sortOrder: i
					}).run();
				}
			}
		});

		// Sync reminder schedules with supplement active state
		let deactivatedReminders = 0;
		if (active === false && existing.active === true) {
			// Deactivating supplement → deactivate all active reminder schedules
			const activeReminders = db
				.select({ id: supplementReminderSchedules.id })
				.from(supplementReminderSchedules)
				.where(and(
					eq(supplementReminderSchedules.supplementId, id),
					eq(supplementReminderSchedules.active, true)
				))
				.all();
			deactivatedReminders = activeReminders.length;
			if (deactivatedReminders > 0) {
				db.update(supplementReminderSchedules)
					.set({ active: false })
					.where(eq(supplementReminderSchedules.supplementId, id))
					.run();
			}
		} else if (active === true && existing.active === false) {
			// Reactivating supplement → reactivate all reminder schedules
			db.update(supplementReminderSchedules)
				.set({ active: true })
				.where(eq(supplementReminderSchedules.supplementId, id))
				.run();
		}

		return json({ ok: true, deactivatedReminders });
	} catch (e) {
		console.error('PUT /api/supplements/[id] error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { id } = event.params;

	const existing = db
		.select()
		.from(supplements)
		.where(and(eq(supplements.id, id), eq(supplements.userId, user!.id)))
		.get();

	if (!existing) return json({ error: 'Not found' }, { status: 404 });

	db.delete(supplements).where(eq(supplements.id, id)).run();

	return json({ ok: true });
};
