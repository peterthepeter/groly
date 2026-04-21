import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs } from '$lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const days = Number(event.url.searchParams.get('days') ?? '30');
	const since = Date.now() - days * 24 * 60 * 60 * 1000;

	const rows = db
		.select({
			supplementId: supplementLogs.supplementId,
			count: sql<number>`count(*)`.as('count')
		})
		.from(supplementLogs)
		.where(and(eq(supplementLogs.userId, user!.id), gte(supplementLogs.loggedAt, since)))
		.groupBy(supplementLogs.supplementId)
		.all();

	const counts: Record<string, number> = {};
	for (const row of rows) counts[row.supplementId] = row.count;

	return json({ counts });
};
