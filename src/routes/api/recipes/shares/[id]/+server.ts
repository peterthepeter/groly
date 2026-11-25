
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { recipeShares, recipes, recipeIngredients, recipeSteps, uploadedImageAccess } from '#lib/db/schema';
import { hasUploadedImageAccess } from '#lib/server/uploadedImages';
import { eq, and, asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

const RECIPE_LIMIT = 50;

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	let body: { action?: string };
	try {
		body = await event.request.json();
	} catch {
		return Response.json({ error: 'Ungültige Anfrage' }, { status: 400 });
	}
	const { action } = body;

	const share = db.select().from(recipeShares)
		.where(and(eq(recipeShares.id, event.params.id), eq(recipeShares.receiverId, user!.id), eq(recipeShares.status, 'pending')))
		.get();
	if (!share) return Response.json({ error: 'Nicht gefunden' }, { status: 404 });

	if (action === 'decline') {
		db.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
		return Response.json({ ok: true });
	}

	if (action === 'accept') {
		// Check recipient's recipe limit
		const count = db.select().from(recipes).where(eq(recipes.userId, user!.id)).all().length;
		if (count >= RECIPE_LIMIT) {
			return Response.json({ error: `Maximale Anzahl von ${RECIPE_LIMIT} Rezepten erreicht` }, { status: 400 });
		}

		const original = db.select().from(recipes)
			.where(and(eq(recipes.id, share.recipeId), eq(recipes.userId, share.senderId))).get();
		if (!original) {
			db.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
			return Response.json({ error: 'Originalrezept nicht mehr vorhanden' }, { status: 404 });
		}

		const now = Date.now();
		const newRecipeId = randomUUID();
		const imageUrl = original.imageUrl;
		const copyImageAccess = imageUrl?.startsWith('/uploads/') && hasUploadedImageAccess(imageUrl, original.userId);

		db.transaction(tx => {
			tx.insert(recipes).values({
				id: newRecipeId,
				userId: user!.id,
				title: original.title,
				description: original.description,
				imageUrl: imageUrl?.startsWith('/uploads/') && !copyImageAccess ? null : imageUrl,
				sourceUrl: original.sourceUrl,
				servings: original.servings,
				prepTime: original.prepTime,
				cookTime: original.cookTime,
				createdAt: now,
				updatedAt: now
			}).run();
			if (imageUrl && copyImageAccess) {
				tx.insert(uploadedImageAccess).values({ imageUrl, userId: user!.id }).onConflictDoNothing().run();
			}

			const origIngredients = tx.select().from(recipeIngredients)
				.where(eq(recipeIngredients.recipeId, original.id))
				.orderBy(asc(recipeIngredients.sortOrder))
				.all();
			for (const ing of origIngredients) {
				tx.insert(recipeIngredients).values({ ...ing, id: randomUUID(), recipeId: newRecipeId }).run();
			}

			const origSteps = tx.select().from(recipeSteps)
				.where(eq(recipeSteps.recipeId, original.id))
				.orderBy(asc(recipeSteps.stepNumber))
				.all();
			for (const step of origSteps) {
				tx.insert(recipeSteps).values({ ...step, id: randomUUID(), recipeId: newRecipeId }).run();
			}

			tx.delete(recipeShares).where(eq(recipeShares.id, event.params.id)).run();
		});
		return Response.json({ recipeId: newRecipeId });
	}

	return Response.json({ error: 'Ungültige Aktion' }, { status: 400 });
};
