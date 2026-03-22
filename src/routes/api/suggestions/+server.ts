import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { items, lists } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	// Top 30 meistverwendete Item-Namen des Users (aus allen seinen Listen)
	const suggestions = db
		.select({
			name: items.name,
			count: sql<number>`COUNT(*) as count`
		})
		.from(items)
		.innerJoin(lists, eq(items.listId, lists.id))
		.where(eq(lists.ownerId, user!.id))
		.groupBy(items.name)
		.orderBy(sql`count DESC`)
		.limit(30)
		.all();

	return json(suggestions.map(s => s.name));
};
