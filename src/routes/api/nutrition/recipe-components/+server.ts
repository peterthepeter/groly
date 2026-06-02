import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes, recipeIngredients, recipeNutritionComponents } from '$lib/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { recipeIngredientsSnapshot } from '$lib/server/nutrition';

type InputComponent = {
	ingredientId?: string | null;
	skipped?: boolean;
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

function loadRecipeForUser(recipeId: string, userId: string) {
	return db.select().from(recipes)
		.where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
		.get();
}

function currentSnapshot(recipeId: string): string {
	const ings = db.select({ name: recipeIngredients.name }).from(recipeIngredients)
		.where(eq(recipeIngredients.recipeId, recipeId))
		.orderBy(asc(recipeIngredients.sortOrder))
		.all();
	return recipeIngredientsSnapshot(ings.map((i) => i.name));
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const recipeId = event.url.searchParams.get('recipeId');
	if (!recipeId) return json({ error: 'recipeId required' }, { status: 400 });

	const recipe = loadRecipeForUser(recipeId, user.id);
	if (!recipe) return json({ error: 'Not found' }, { status: 404 });

	const components = db.select().from(recipeNutritionComponents)
		.where(eq(recipeNutritionComponents.recipeId, recipeId))
		.orderBy(asc(recipeNutritionComponents.sortOrder))
		.all();

	const mapped = recipe.nutritionIngredientsSnapshot != null;
	const stale = mapped && recipe.nutritionIngredientsSnapshot !== currentSnapshot(recipeId);

	return json({
		components,
		mapped,
		stale,
		mappedServings: recipe.nutritionMappedServings ?? recipe.servings
	});
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { recipeId, components, mappedServings } = body as {
			recipeId?: string;
			components?: InputComponent[];
			mappedServings?: number;
		};
		if (!recipeId) return json({ error: 'recipeId required' }, { status: 400 });

		const recipe = loadRecipeForUser(recipeId, user.id);
		if (!recipe) return json({ error: 'Not found' }, { status: 404 });

		const comps = Array.isArray(components) ? components : [];
		const servings = typeof mappedServings === 'number' && mappedServings > 0
			? Math.round(mappedServings)
			: recipe.servings;

		// Komplettersatz: alte Zuordnung löschen, neue einfügen.
		db.delete(recipeNutritionComponents).where(eq(recipeNutritionComponents.recipeId, recipeId)).run();

		for (let i = 0; i < comps.length; i++) {
			const c = comps[i];
			if (typeof c?.displayName !== 'string' || !c.displayName.trim()) continue;
			if (!['g', 'ml', 'piece'].includes(c.unit)) continue;
			db.insert(recipeNutritionComponents).values({
				id: randomUUID(),
				recipeId,
				ingredientId: c.ingredientId ?? null,
				sortOrder: i,
				skipped: !!c.skipped,
				productBarcode: c.productBarcode ?? null,
				genericFoodId: c.genericFoodId ?? null,
				customName: c.customName ?? null,
				displayName: c.displayName.trim().slice(0, 120),
				imageUrl: c.imageUrl ?? null,
				amount: typeof c.amount === 'number' && c.amount > 0 ? c.amount : 0,
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

		db.update(recipes).set({
			nutritionMappedServings: servings,
			nutritionIngredientsSnapshot: currentSnapshot(recipeId),
			updatedAt: Date.now()
		}).where(eq(recipes.id, recipeId)).run();

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
