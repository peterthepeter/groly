import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipeShares, recipes, users } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const pending = db
		.select({
			id: recipeShares.id,
			recipeId: recipeShares.recipeId,
			recipeTitle: recipes.title,
			recipeImageUrl: recipes.imageUrl,
			senderUsername: users.username,
			createdAt: recipeShares.createdAt
		})
		.from(recipeShares)
		.innerJoin(recipes, eq(recipeShares.recipeId, recipes.id))
		.innerJoin(users, eq(recipeShares.senderId, users.id))
		.where(and(eq(recipeShares.receiverId, user!.id), eq(recipeShares.status, 'pending')))
		.all();

	return json(pending);
};
