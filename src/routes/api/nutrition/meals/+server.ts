import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { meals, mealComponents, caffeineDrinks, caffeineLogs } from '$lib/db/schema';
import { and, eq, asc, gte, lte } from 'drizzle-orm';
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

function isValidDate(d: unknown): d is string {
	return typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

function isValidTime(t: unknown): t is string {
	return typeof t === 'string' && /^\d{2}:\d{2}$/.test(t);
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const date = event.url.searchParams.get('date');
	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	let rows;
	if (isValidDate(date)) {
		rows = db.select().from(meals)
			.where(and(eq(meals.userId, user.id), eq(meals.date, date)))
			.orderBy(asc(meals.time))
			.all();
	} else if (isValidDate(from) && isValidDate(to)) {
		rows = db.select().from(meals)
			.where(and(
				eq(meals.userId, user.id),
				gte(meals.date, from),
				lte(meals.date, to)
			))
			.orderBy(asc(meals.date), asc(meals.time))
			.all();
	} else {
		return json({ error: 'date (YYYY-MM-DD) or from+to required' }, { status: 400 });
	}

	if (rows.length === 0) return json({ meals: [] });

	const mealIds = rows.map((m) => m.id);
	const allComponents = db.select().from(mealComponents).orderBy(asc(mealComponents.sortOrder)).all();
	const byMeal = new Map<string, typeof allComponents>();
	for (const c of allComponents) {
		if (!mealIds.includes(c.mealId)) continue;
		const arr = byMeal.get(c.mealId) ?? [];
		arr.push(c);
		byMeal.set(c.mealId, arr);
	}

	return json({
		meals: rows.map((m) => ({
			...m,
			components: byMeal.get(m.id) ?? []
		}))
	});
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { name, date, time, components, imageUrl, favoriteName, caffeineDrinkIds } = body as {
			name?: string;
			date?: string;
			time?: string;
			components?: InputComponent[];
			imageUrl?: string | null;
			favoriteName?: string | null;
			caffeineDrinkIds?: string[];
		};

		if (typeof name !== 'string' || !name.trim()) return json({ error: 'name required' }, { status: 400 });
		if (!isValidDate(date)) return json({ error: 'date YYYY-MM-DD required' }, { status: 400 });
		if (!isValidTime(time)) return json({ error: 'time HH:MM required' }, { status: 400 });
		const comps = Array.isArray(components) ? components : [];

		const now = Date.now();
		const mealId = randomUUID();

		db.insert(meals).values({
			id: mealId,
			userId: user.id,
			name: name.trim().slice(0, 60),
			date,
			time,
			imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
			favoriteName: typeof favoriteName === 'string' && favoriteName.trim() ? favoriteName.trim().slice(0, 80) : null,
			createdAt: now,
			updatedAt: now
		}).run();

		for (let i = 0; i < comps.length; i++) {
			const c = comps[i];
			if (typeof c?.amount !== 'number' || !(c.amount > 0)) continue;
			if (!['g', 'ml', 'piece'].includes(c.unit)) continue;
			if (typeof c.displayName !== 'string' || !c.displayName.trim()) continue;

			const grams = effectiveGrams(c.amount, c.unit, c.gramsPerPiece);
			const totals = computeTotals({
				kcal: c.kcalPer100,
				protein: c.proteinPer100,
				fat: c.fatPer100,
				carbs: c.carbsPer100,
				sugar: c.sugarPer100,
				fiber: c.fiberPer100,
				salt: c.saltPer100
			}, grams);

			db.insert(mealComponents).values({
				id: randomUUID(),
				mealId,
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
				kcal: totals.kcal,
				protein: totals.protein,
				fat: totals.fat,
				carbs: totals.carbs,
				sugar: totals.sugar,
				fiber: totals.fiber,
				salt: totals.salt
			}).run();
		}

		// Koffein-Spiegel: Für jede verknüpfte Koffein-Getränk-Vorlage zusätzlich einen
		// Koffein-Log anlegen (Nutrition → Koffein, eine Richtung). Menge + mg kommen
		// autoritativ aus dem Getränk; clientLogId bindet den Log an die Mahlzeit.
		const drinkIds = Array.isArray(caffeineDrinkIds)
			? [...new Set(caffeineDrinkIds.filter((d): d is string => typeof d === 'string' && !!d))]
			: [];
		if (drinkIds.length > 0) {
			const loggedAt = new Date(`${date}T${time}`).getTime() || now;
			for (const drinkId of drinkIds) {
				const drink = db.select().from(caffeineDrinks).where(eq(caffeineDrinks.id, drinkId)).get();
				if (!drink) continue;
				db.insert(caffeineLogs).values({
					id: randomUUID(),
					userId: user.id,
					drinkName: drink.name,
					amountMl: drink.defaultMl,
					caffeineMg: drink.caffeineMg,
					loggedAt,
					clientLogId: `${mealCaffeineLogPrefix(mealId)}${drinkId}`,
					createdAt: now
				}).run();
			}
		}

		return json({ id: mealId }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
