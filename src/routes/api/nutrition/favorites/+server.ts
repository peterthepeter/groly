import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { nutritionFavorites, genericFoods } from '$lib/db/schema';
import { and, eq, desc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	// Kategorie des verknüpften generischen Lebensmittels mitliefern (für das Listen-Icon).
	const rows = db.select({
		fav: nutritionFavorites,
		category: genericFoods.category,
		genericKcal: genericFoods.kcalPer100,
		genericProtein: genericFoods.proteinPer100,
		genericFat: genericFoods.fatPer100,
		genericCarbs: genericFoods.carbsPer100,
		genericSugar: genericFoods.sugarPer100,
		genericFiber: genericFoods.fiberPer100,
		genericSalt: genericFoods.saltPer100
	})
		.from(nutritionFavorites)
		.leftJoin(genericFoods, eq(nutritionFavorites.genericFoodId, genericFoods.id))
		.where(eq(nutritionFavorites.userId, user.id))
		.orderBy(desc(nutritionFavorites.useCount), desc(nutritionFavorites.lastUsedAt))
		.all();
	const favs = rows.map((r) => ({
		...r.fav,
		category: r.category,
		customKcalPer100: r.fav.customKcalPer100 ?? r.genericKcal,
		customProteinPer100: r.fav.customProteinPer100 ?? r.genericProtein,
		customFatPer100: r.fav.customFatPer100 ?? r.genericFat,
		customCarbsPer100: r.fav.customCarbsPer100 ?? r.genericCarbs,
		customSugarPer100: r.fav.customSugarPer100 ?? r.genericSugar,
		customFiberPer100: r.fav.customFiberPer100 ?? r.genericFiber,
		customSaltPer100: r.fav.customSaltPer100 ?? r.genericSalt
	}));
	return json({ favorites: favs });
};

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { displayName, productBarcode, genericFoodId, imageUrl,
			customKcalPer100, customProteinPer100, customFatPer100, customCarbsPer100,
			customSugarPer100, customFiberPer100, customSaltPer100,
			defaultAmount, defaultUnit, defaultGramsPerPiece } = body;

		if (typeof displayName !== 'string' || !displayName.trim()) return json({ error: 'displayName required' }, { status: 400 });
		if (!['g', 'ml', 'piece'].includes(defaultUnit)) return json({ error: 'invalid unit' }, { status: 400 });
		if (typeof defaultAmount !== 'number' || !(defaultAmount > 0)) return json({ error: 'invalid amount' }, { status: 400 });

		// Dedupe: existiert bereits ein Favorit mit gleichem Barcode, gleichem Generic-Food,
		// oder (für custom-Einträge) gleichem displayName? Dann nur useCount erhöhen.
		const existing = (() => {
			const trimmed = displayName.trim().slice(0, 80);
			if (productBarcode) {
				return db.select().from(nutritionFavorites)
					.where(and(eq(nutritionFavorites.userId, user.id), eq(nutritionFavorites.productBarcode, productBarcode)))
					.get() ?? null;
			}
			if (genericFoodId) {
				return db.select().from(nutritionFavorites)
					.where(and(eq(nutritionFavorites.userId, user.id), eq(nutritionFavorites.genericFoodId, genericFoodId)))
					.get() ?? null;
			}
			return db.select().from(nutritionFavorites)
				.where(and(eq(nutritionFavorites.userId, user.id), eq(nutritionFavorites.displayName, trimmed)))
				.get() ?? null;
		})();

		if (existing) {
			const patch: Partial<typeof nutritionFavorites.$inferInsert> = {
				useCount: (existing.useCount ?? 0) + 1,
				lastUsedAt: Date.now()
			};
			if (!existing.imageUrl && imageUrl) patch.imageUrl = imageUrl;
			db.update(nutritionFavorites)
				.set(patch)
				.where(eq(nutritionFavorites.id, existing.id))
				.run();
			return json({ id: existing.id, deduplicated: true }, { status: 200 });
		}

		const id = randomUUID();
		db.insert(nutritionFavorites).values({
			id,
			userId: user.id,
			displayName: displayName.trim().slice(0, 80),
			imageUrl: imageUrl ?? null,
			productBarcode: productBarcode ?? null,
			genericFoodId: genericFoodId ?? null,
			customKcalPer100: customKcalPer100 ?? null,
			customProteinPer100: customProteinPer100 ?? null,
			customFatPer100: customFatPer100 ?? null,
			customCarbsPer100: customCarbsPer100 ?? null,
			customSugarPer100: customSugarPer100 ?? null,
			customFiberPer100: customFiberPer100 ?? null,
			customSaltPer100: customSaltPer100 ?? null,
			defaultAmount,
			defaultUnit,
			defaultGramsPerPiece: defaultGramsPerPiece ?? null,
			useCount: 0,
			lastUsedAt: null,
			createdAt: Date.now()
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
