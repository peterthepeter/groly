import { dirname, resolve } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '#lib/db';
import { recipes, recipeShares, uploadedImageAccess } from '#lib/db/schema';

export const uploadsDirectory = resolve(dirname(process.env.DATABASE_URL ?? './data/groly.db'), 'uploads');

export function hasUploadedImageAccess(imageUrl: string, userId: string): boolean {
	return !!db.select({ userId: uploadedImageAccess.userId }).from(uploadedImageAccess)
		.where(and(eq(uploadedImageAccess.imageUrl, imageUrl), eq(uploadedImageAccess.userId, userId)))
		.get();
}

export function getUploadedImageAccess(imageUrl: string, userId: string): 'account' | 'preview' | null {
	if (hasUploadedImageAccess(imageUrl, userId)) return 'account';

	// Only a sender with a durable grant can share a preview. A URL stored in
	// another recipe or meal is never enough to confer access on its own.
	const share = db.select({ id: recipeShares.id }).from(recipeShares)
		.innerJoin(recipes, and(eq(recipes.id, recipeShares.recipeId), eq(recipes.userId, recipeShares.senderId)))
		.innerJoin(uploadedImageAccess, and(eq(uploadedImageAccess.imageUrl, recipes.imageUrl), eq(uploadedImageAccess.userId, recipes.userId)))
		.where(and(eq(recipeShares.receiverId, userId), eq(recipeShares.status, 'pending'), eq(recipes.imageUrl, imageUrl)))
		.get();
	return share ? 'preview' : null;
}
