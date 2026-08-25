import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs } from '$lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const rows = db
		.select({
			supplementId: supplementLogs.supplementId,
			count: sql<number>`count(*)`.as('count')
		})
		.from(supplementLogs)
		.where(eq(supplementLogs.userId, user!.id))
		.groupBy(supplementLogs.supplementId)
		.all();

	const counts: Record<string, number> = {};
	for (const row of rows) counts[row.supplementId] = row.count;

	return json({ counts });
};
