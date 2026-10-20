import type { db as appDb } from '#lib/db';
import { itemHistory } from '#lib/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

type AppDatabase = typeof appDb;

export function queryItemSuggestions(database: AppDatabase, userId: string, rawQuery: string, limit: number): string[] {
	const query = rawQuery.trim().toLowerCase();
	const where = query
		? and(
			eq(itemHistory.userId, userId),
			sql`instr(lower(${itemHistory.name}), ${query}) > 0`
		)
		: eq(itemHistory.userId, userId);

	// Frequency matters most; a 30-day decay lets changing habits catch up.
	const now = Math.floor(Date.now() / 1000);
	const relevance = sql`${itemHistory.useCount} * 1.0 / (1 + max(0, ${now} - ${itemHistory.lastUsedAt}) / 2592000.0)`;

	const rows = database
		.select({ name: itemHistory.name })
		.from(itemHistory)
		.where(where)
		.orderBy(
			...(query
				? [
					sql`CASE WHEN lower(${itemHistory.name}) = ${query} THEN 0 WHEN instr(lower(${itemHistory.name}), ${query}) = 1 THEN 1 ELSE 2 END`,
					desc(relevance),
					desc(itemHistory.lastUsedAt),
					asc(itemHistory.name)
				]
				: [desc(relevance), desc(itemHistory.lastUsedAt), asc(itemHistory.name)])
		)
		.limit(limit)
		.all();

	return rows.map((row) => row.name);
}
