import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { nutritionMealFavorites, nutritionMealFavoriteComponents } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

type InputComponent = {
	productBarcode?: string | null;
	genericFoodId?: string | null;
	customName?: string | null;
	displayName: string;
	imageUrl?: string | null;
	amount: number;
	unit: 'g' | 'ml' | 'piece';
	gramsPerPiece?: number | null;
	kcalPer100?: number | null;
	proteinPer100?: number | null;
	fatPer100?: number | null;
	carbsPer100?: number | null;
	sugarPer100?: number | null;
	fiberPer100?: number | null;
	saltPer100?: number | null;
};

function ensureOwn(userId: string, id: string) {
	return db.select().from(nutritionMealFavorites)
		.where(and(eq(nutritionMealFavorites.id, id), eq(nutritionMealFavorites.userId, userId)))
		.get() ?? null;
}

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const fav = ensureOwn(user.id, event.params.id);
	if (!fav) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const updates: Partial<typeof nutritionMealFavorites.$inferInsert> = {};
		if (typeof body.displayName === 'string' && body.displayName.trim()) updates.displayName = body.displayName.trim().slice(0, 80);
		if (typeof body.defaultMealName === 'string') updates.defaultMealName = body.defaultMealName.trim().slice(0, 60) || null;
		if ('imageUrl' in body) updates.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : null;
		if ('caffeineDrinkId' in body) updates.caffeineDrinkId = typeof body.caffeineDrinkId === 'string' && body.caffeineDrinkId ? body.caffeineDrinkId : null;
		if (typeof body.useCount === 'number') {
			updates.useCount = body.useCount;
			updates.lastUsedAt = Date.now();
		}
		if (Object.keys(updates).length > 0) {
			db.update(nutritionMealFavorites).set(updates).where(eq(nutritionMealFavorites.id, fav.id)).run();
		}

		// Komponenten ersetzen, falls mitgeschickt (komplette Liste = neuer Stand)
		if (Array.isArray(body.components)) {
			const comps = body.components as InputComponent[];
			db.delete(nutritionMealFavoriteComponents).where(eq(nutritionMealFavoriteComponents.mealFavoriteId, fav.id)).run();
			for (let i = 0; i < comps.length; i++) {
				const c = comps[i];
				if (typeof c?.amount !== 'number' || !(c.amount > 0)) continue;
				if (!['g', 'ml', 'piece'].includes(c.unit)) continue;
				if (typeof c.displayName !== 'string' || !c.displayName.trim()) continue;
				db.insert(nutritionMealFavoriteComponents).values({
					id: randomUUID(),
					mealFavoriteId: fav.id,
					sortOrder: i,
					productBarcode: c.productBarcode ?? null,
					genericFoodId: c.genericFoodId ?? null,
					customName: c.customName ?? null,
					displayName: c.displayName.trim().slice(0, 120),
					imageUrl: c.imageUrl ?? null,
					amount: c.amount,
					unit: c.unit,
					gramsPerPiece: c.gramsPerPiece ?? null,
					kcalPer100: c.kcalPer100 ?? null,
					proteinPer100: c.proteinPer100 ?? null,
					fatPer100: c.fatPer100 ?? null,
					carbsPer100: c.carbsPer100 ?? null,
					sugarPer100: c.sugarPer100 ?? null,
					fiberPer100: c.fiberPer100 ?? null,
					saltPer100: c.saltPer100 ?? null
				}).run();
			}
		}

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const fav = ensureOwn(user.id, event.params.id);
	if (!fav) return json({ error: 'Not found' }, { status: 404 });

	db.delete(nutritionMealFavorites).where(eq(nutritionMealFavorites.id, fav.id)).run();
	return json({ ok: true });
};
