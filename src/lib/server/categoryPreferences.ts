import { and, eq } from 'drizzle-orm';
import { db } from '$lib/db';
import { categoryPreferences } from '$lib/db/schema';
import { isValidCategoryKey } from '$lib/categories';
import { normalizeCategoryPreferenceName } from '$lib/categoryPreferences';
import { now } from '$lib/auth';

export function getCategoryPreferences(userId: string) {
	return db.select({
		normalizedName: categoryPreferences.normalizedName,
		categoryOverride: categoryPreferences.categoryOverride,
		updatedAt: categoryPreferences.updatedAt
	}).from(categoryPreferences).where(eq(categoryPreferences.userId, userId)).all();
}

export function getCategoryPreferenceMap(userId: string): Map<string, string> {
	return new Map(getCategoryPreferences(userId).map(row => [row.normalizedName, row.categoryOverride]));
}

export function getCategoryPreference(userId: string, name: string): string | null {
	const normalizedName = normalizeCategoryPreferenceName(name);
	if (!normalizedName) return null;
	return db.select({ categoryOverride: categoryPreferences.categoryOverride })
		.from(categoryPreferences)
		.where(and(
			eq(categoryPreferences.userId, userId),
			eq(categoryPreferences.normalizedName, normalizedName)
		))
		.get()?.categoryOverride ?? null;
}

export function setCategoryPreference(userId: string, name: string, categoryOverride: unknown) {
	const normalizedName = normalizeCategoryPreferenceName(name);
	if (!normalizedName) return { error: 'Name required' as const };
	if (!isValidCategoryKey(categoryOverride)) return { error: 'Invalid category' as const };
	const updatedAt = now();

	db.insert(categoryPreferences).values({ userId, normalizedName, categoryOverride, updatedAt })
		.onConflictDoUpdate({
			target: [categoryPreferences.userId, categoryPreferences.normalizedName],
			set: { categoryOverride, updatedAt }
		})
		.run();

	return { normalizedName, categoryOverride, updatedAt };
}

export function deleteCategoryPreference(userId: string, name: string) {
	const normalizedName = normalizeCategoryPreferenceName(name);
	if (!normalizedName) return { error: 'Name required' as const };

	db.delete(categoryPreferences).where(and(
		eq(categoryPreferences.userId, userId),
		eq(categoryPreferences.normalizedName, normalizedName)
	)).run();

	return { normalizedName };
}
