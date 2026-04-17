import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { mealPlanEntries, recipes, recipeIngredients, recipeIngredientExclusions, items, lists, listMembers, itemHistory, users } from '$lib/db/schema';
import { eq, and, gte, lte, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { scaleAmount } from '$lib/recipeUtils';
import { now as dbNow, generateId } from '$lib/auth';
import { emitToListMembers } from '$lib/server/userEvents';
import { schedulePushForItemAdded } from '$lib/server/pushDebounce';

// GET /api/meal-plan?from=2026-04-14&to=2026-04-20
export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const from = event.url.searchParams.get('from');
	const to = event.url.searchParams.get('to');

	if (!from || !to) return json({ error: 'from and to required' }, { status: 400 });

	const entries = db
		.select({
			id: mealPlanEntries.id,
			date: mealPlanEntries.date,
			recipeId: mealPlanEntries.recipeId,
			note: mealPlanEntries.note,
			servings: mealPlanEntries.servings,
			recipeTitle: recipes.title,
			recipeImageUrl: recipes.imageUrl,
			recipeServings: recipes.servings
		})
		.from(mealPlanEntries)
		.leftJoin(recipes, eq(mealPlanEntries.recipeId, recipes.id))
		.where(
			and(
				eq(mealPlanEntries.userId, user!.id),
				gte(mealPlanEntries.date, from),
				lte(mealPlanEntries.date, to)
			)
		)
		.all();

	return json(entries);
};

// PUT /api/meal-plan — create a new entry for a date
// Body: { date, recipeId?, note?, servings? }
export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { date, recipeId, note, servings } = body;

		if (!date || typeof date !== 'string') return json({ error: 'date required' }, { status: 400 });

		const hasContent = recipeId || (note && note.trim());
		if (!hasContent) return json({ error: 'content required' }, { status: 400 });

		const ts = dbNow();
		const id = randomUUID();
		db.insert(mealPlanEntries).values({
			id,
			userId: user!.id,
			date,
			recipeId: recipeId ?? null,
			note: note?.trim() ?? null,
			servings: servings ?? null,
			createdAt: ts,
			updatedAt: ts
		}).run();
		return json({ id });
	} catch (e) {
		console.error('PUT /api/meal-plan error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

// POST /api/meal-plan — Zutaten für ausgewählte Tage in eine Einkaufsliste schreiben
// Body: { dates: string[], listId: string }
export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { dates, listId } = body as { dates: string[]; listId: string };

		if (!Array.isArray(dates) || !listId) {
			return json({ error: 'dates and listId required' }, { status: 400 });
		}

		// Prüfen ob der User Schreibzugriff auf die Liste hat
		const list = db.select().from(lists).where(eq(lists.id, listId)).get();
		if (!list) return json({ error: 'Liste nicht gefunden' }, { status: 404 });
		const isOwner = list.ownerId === user!.id;
		const isMember = isOwner ? false : db
			.select()
			.from(listMembers)
			.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id), eq(listMembers.status, 'accepted'), eq(listMembers.permission, 'write')))
			.get();
		if (!isOwner && !isMember) return json({ error: 'Keine Schreibberechtigung' }, { status: 403 });

		// Einträge für die angeforderten Tage laden
		const entries = db
			.select()
			.from(mealPlanEntries)
			.where(and(eq(mealPlanEntries.userId, user!.id), inArray(mealPlanEntries.date, dates)))
			.all();

		// Rezept-Portionen summieren
		const recipeServingsMap = new Map<string, number>(); // recipeId → totalServings
		const freeTextItems: string[] = [];

		for (const entry of entries) {
			if (entry.recipeId && entry.servings) {
				recipeServingsMap.set(entry.recipeId, (recipeServingsMap.get(entry.recipeId) ?? 0) + entry.servings);
			} else if (entry.note?.trim()) {
				freeTextItems.push(entry.note.trim());
			}
		}

		const recipeIds = [...recipeServingsMap.keys()];

		// Rezept-Standardportionen laden
		const recipeDefaultServings = new Map<string, number>();
		if (recipeIds.length > 0) {
			const recipeRows = db
				.select({ id: recipes.id, servings: recipes.servings })
				.from(recipes)
				.where(inArray(recipes.id, recipeIds))
				.all();
			for (const r of recipeRows) recipeDefaultServings.set(r.id, r.servings);
		}

		// Ausgeschlossene Zutaten des Users laden
		const excludedSet = new Set<string>();
		if (recipeIds.length > 0) {
			const exclusions = db
				.select({ ingredientId: recipeIngredientExclusions.ingredientId })
				.from(recipeIngredientExclusions)
				.where(eq(recipeIngredientExclusions.userId, user!.id))
				.all();
			for (const e of exclusions) excludedSet.add(e.ingredientId);
		}

		// Zutaten laden
		const ingredients = recipeIds.length > 0
			? db.select().from(recipeIngredients).where(inArray(recipeIngredients.recipeId, recipeIds)).all()
			: [];

		// Items zusammenstellen
		const itemsToAdd: { name: string; quantityInfo: string | null }[] = [];

		for (const note of freeTextItems) {
			itemsToAdd.push({ name: note, quantityInfo: null });
		}

		for (const ing of ingredients) {
			if (excludedSet.has(ing.id)) continue;
			const totalServings = recipeServingsMap.get(ing.recipeId) ?? 0;
			const defaultServings = recipeDefaultServings.get(ing.recipeId) ?? 1;
			const scaledAmount = scaleAmount(ing.amount, totalServings, defaultServings);
			const quantityInfo = scaledAmount || ing.unit
				? `${scaledAmount ?? ''}${ing.unit ? ' ' + ing.unit : ''}`.trim() || null
				: null;
			itemsToAdd.push({ name: ing.name, quantityInfo });
		}

		if (itemsToAdd.length === 0) return json({ added: 0 });

		// Items direkt in die DB schreiben
		const creator = db.select({ username: users.username }).from(users).where(eq(users.id, user!.id)).get();
		const ts = dbNow();
		let added = 0;

		for (const item of itemsToAdd) {
			const id = generateId(16);
			db.insert(items).values({
				id,
				listId,
				name: item.name,
				quantityInfo: item.quantityInfo,
				isChecked: false,
				createdBy: user!.id,
				createdAt: ts,
				updatedAt: ts
			}).run();

			db.insert(itemHistory)
				.values({ userId: user!.id, name: item.name, useCount: 1, lastUsedAt: ts })
				.onConflictDoUpdate({
					target: [itemHistory.userId, itemHistory.name],
					set: { useCount: sql`${itemHistory.useCount} + 1`, lastUsedAt: ts }
				})
				.run();

			const newItem = { id, listId, name: item.name, quantityInfo: item.quantityInfo, isChecked: false, checkedAt: null, categoryOverride: null, createdBy: user!.id, createdByUsername: creator?.username ?? null, createdAt: ts, updatedAt: ts };
			emitToListMembers(listId, { type: 'item_added', listId, item: newItem, byUserId: user!.id });
			added++;
		}

		db.update(lists).set({ updatedAt: ts }).where(eq(lists.id, listId)).run();

		schedulePushForItemAdded({
			listId,
			listName: list.name,
			itemName: itemsToAdd[0].name + (itemsToAdd.length > 1 ? ` + ${itemsToAdd.length - 1}` : ''),
			adderUserId: user!.id,
			adderUsername: creator?.username ?? 'Jemand',
			url: `/listen/${listId}`
		});

		return json({ added, listId });
	} catch (e) {
		console.error('POST /api/meal-plan error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
