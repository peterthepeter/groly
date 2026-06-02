import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { nutritionMealFavorites, nutritionMealFavoriteComponents } from '$lib/db/schema';
import { eq, desc, asc } from 'drizzle-orm';
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

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const favs = db.select().from(nutritionMealFavorites)
		.where(eq(nutritionMealFavorites.userId, user.id))
		.orderBy(desc(nutritionMealFavorites.useCount), desc(nutritionMealFavorites.lastUsedAt))
		.all();
	if (favs.length === 0) return json({ mealFavorites: [] });

	const favIds = favs.map((f) => f.id);
	const allComps = db.select().from(nutritionMealFavoriteComponents).orderBy(asc(nutritionMealFavoriteComponents.sortOrder)).all();
	const byFav = new Map<string, typeof allComps>();
	for (const c of allComps) {
		if (!favIds.includes(c.mealFavoriteId)) continue;
		const arr = byFav.get(c.mealFavoriteId) ?? [];
		arr.push(c);
		byFav.set(c.mealFavoriteId, arr);
	}
	return json({
		mealFavorites: favs.map((f) => ({ ...f, components: byFav.get(f.id) ?? [] }))
	});
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { displayName, defaultMealName, components, imageUrl, caffeineDrinkId } = body as {
			displayName?: string; defaultMealName?: string | null; components?: InputComponent[]; imageUrl?: string | null; caffeineDrinkId?: string | null;
		};
		if (typeof displayName !== 'string' || !displayName.trim()) return json({ error: 'displayName required' }, { status: 400 });
		const comps = Array.isArray(components) ? components : [];

		const id = randomUUID();
		db.insert(nutritionMealFavorites).values({
			id,
			userId: user.id,
			displayName: displayName.trim().slice(0, 80),
			defaultMealName: defaultMealName?.trim().slice(0, 60) ?? null,
			imageUrl: typeof imageUrl === 'string' ? imageUrl : null,
			caffeineDrinkId: typeof caffeineDrinkId === 'string' && caffeineDrinkId ? caffeineDrinkId : null,
			useCount: 0,
			lastUsedAt: null,
			createdAt: Date.now()
		}).run();

		for (let i = 0; i < comps.length; i++) {
			const c = comps[i];
			if (typeof c?.amount !== 'number' || !(c.amount > 0)) continue;
			if (!['g', 'ml', 'piece'].includes(c.unit)) continue;
			if (typeof c.displayName !== 'string' || !c.displayName.trim()) continue;
			db.insert(nutritionMealFavoriteComponents).values({
				id: randomUUID(),
				mealFavoriteId: id,
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

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
