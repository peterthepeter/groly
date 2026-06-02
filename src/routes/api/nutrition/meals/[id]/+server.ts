import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meals, mealComponents, caffeineLogs } from '$lib/db/schema';
import { and, eq, like } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { effectiveGrams, computeTotals, mealCaffeineLogPrefix } from '$lib/server/nutrition';

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

function ensureOwn(userId: string, mealId: string) {
	const m = db.select().from(meals).where(and(eq(meals.id, mealId), eq(meals.userId, userId))).get();
	return m ?? null;
}

export const PATCH: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const meal = ensureOwn(user.id, event.params.id);
	if (!meal) return json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const updates: Partial<typeof meals.$inferInsert> = { updatedAt: Date.now() };

		if (typeof body.name === 'string' && body.name.trim()) updates.name = body.name.trim().slice(0, 60);
		if (typeof body.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.date)) updates.date = body.date;
		if (typeof body.time === 'string' && /^\d{2}:\d{2}$/.test(body.time)) updates.time = body.time;
		if ('imageUrl' in body) updates.imageUrl = typeof body.imageUrl === 'string' ? body.imageUrl : null;
		if ('favoriteName' in body) updates.favoriteName = typeof body.favoriteName === 'string' && body.favoriteName.trim() ? body.favoriteName.trim().slice(0, 80) : null;

		db.update(meals).set(updates).where(eq(meals.id, meal.id)).run();

		// Wenn components dabei, ersetze alle
		if (Array.isArray(body.components)) {
			db.delete(mealComponents).where(eq(mealComponents.mealId, meal.id)).run();
			const comps = body.components as InputComponent[];
			for (let i = 0; i < comps.length; i++) {
				const c = comps[i];
				if (typeof c?.amount !== 'number' || !(c.amount > 0)) continue;
				if (!['g', 'ml', 'piece'].includes(c.unit)) continue;
				if (typeof c.displayName !== 'string' || !c.displayName.trim()) continue;
				const grams = effectiveGrams(c.amount, c.unit, c.gramsPerPiece);
				const totals = computeTotals({
					kcal: c.kcalPer100, protein: c.proteinPer100, fat: c.fatPer100, carbs: c.carbsPer100,
					sugar: c.sugarPer100, fiber: c.fiberPer100, salt: c.saltPer100
				}, grams);
				db.insert(mealComponents).values({
					id: randomUUID(),
					mealId: meal.id,
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
					saltPer100: c.saltPer100 ?? null,
					kcal: totals.kcal, protein: totals.protein, fat: totals.fat, carbs: totals.carbs,
					sugar: totals.sugar, fiber: totals.fiber, salt: totals.salt
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

	const meal = ensureOwn(user.id, event.params.id);
	if (!meal) return json({ error: 'Not found' }, { status: 404 });

	db.delete(meals).where(eq(meals.id, meal.id)).run();
	// Gespiegelte Koffein-Logs dieser Mahlzeit mitlöschen (eine Richtung: Nutrition → Koffein).
	db.delete(caffeineLogs)
		.where(and(eq(caffeineLogs.userId, user.id), like(caffeineLogs.clientLogId, `${mealCaffeineLogPrefix(meal.id)}%`)))
		.run();
	return json({ ok: true });
};
