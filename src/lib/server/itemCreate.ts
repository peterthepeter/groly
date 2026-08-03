import type { db as appDb } from '$lib/db';
import { itemHistory, items, lists } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

type AppDatabase = typeof appDb;

export type ItemCreateInput = {
	id: string;
	listId: string;
	name: string;
	quantityInfo: string | null;
	categoryOverride: string | null;
	createdBy: string;
	createdAt: number;
	updatedAt: number;
};

/**
 * Persists a client-ID based item creation exactly once.
 * A retry after a lost HTTP response returns the existing item without
 * incrementing history, touching the list timestamp, or emitting side effects.
 */
export function persistItemCreate(database: AppDatabase, input: ItemCreateInput) {
	const inserted = database.transaction((tx) => {
		const result = tx.insert(items).values({
			id: input.id,
			listId: input.listId,
			name: input.name,
			quantityInfo: input.quantityInfo,
			isChecked: false,
			categoryOverride: input.categoryOverride,
			createdBy: input.createdBy,
			createdAt: input.createdAt,
			updatedAt: input.updatedAt
		}).onConflictDoNothing().run();

		if (result.changes === 0) return false;

		tx.insert(itemHistory)
			.values({ userId: input.createdBy, name: input.name, useCount: 1, lastUsedAt: input.createdAt })
			.onConflictDoUpdate({
				target: [itemHistory.userId, itemHistory.name],
				set: { useCount: sql`${itemHistory.useCount} + 1`, lastUsedAt: input.createdAt }
			})
			.run();

		tx.update(lists).set({ updatedAt: input.updatedAt }).where(eq(lists.id, input.listId)).run();
		return true;
	});

	const item = database.select().from(items).where(eq(items.id, input.id)).get();
	if (!item) throw new Error('Item create did not produce a readable item');
	return { inserted, item };
}
