import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplements, supplementNutrients } from '$lib/db/schema';
import { eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db
		.select()
		.from(supplements)
		.where(eq(supplements.userId, user!.id))
		.orderBy(asc(supplements.active), asc(supplements.name))
		.all();

	const nutrients = db
		.select()
		.from(supplementNutrients)
		.all();

	const result = rows.map(s => ({
		...s,
		nutrients: nutrients
			.filter(n => n.supplementId === s.id)
			.sort((a, b) => a.sortOrder - b.sortOrder)
	}));

	return json({ supplements: result });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { name, unit, brand, info, notes, active, nutrients: nutrientRows, stockQuantity, defaultAmount } = body;

		if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });
		if (!unit?.trim()) return json({ error: 'Einheit erforderlich' }, { status: 400 });

		const now = Date.now();
		const id = randomUUID();

		db.insert(supplements).values({
			id,
			userId: user!.id,
			name: name.trim(),
			unit: unit.trim(),
			brand: brand?.trim() || null,
			info: info?.trim() || null,
			notes: notes?.trim() || null,
			active: active !== false,
			stockQuantity: stockQuantity != null ? Number(stockQuantity) : null,
			defaultAmount: defaultAmount != null ? Number(defaultAmount) : 1,
			sortOrder: 0,
			createdAt: now,
			updatedAt: now
		}).run();

		if (Array.isArray(nutrientRows)) {
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

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/supplements error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
