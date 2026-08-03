import type { db as appDb } from '$lib/db';
import { itemHistory } from '$lib/db/schema';
import { and, asc, desc, eq, sql } from 'drizzle-orm';

type AppDatabase = typeof appDb;

export function queryItemSuggestions(database: AppDatabase, userId: string, rawQuery: string, limit: number): string[] {
	const query = rawQuery.trim().toLowerCase();
	const where = query
		? and(
			eq(itemHistory.userId, userId),
			sql`instr(lower(${itemHistory.name}), ${query}) > 0`,
			sql`lower(${itemHistory.name}) <> ${query}`
		)
		: eq(itemHistory.userId, userId);

	const rows = database
		.select({ name: itemHistory.name })
		.from(itemHistory)
		.where(where)
		.orderBy(
			...(query
				? [
					sql`CASE WHEN instr(lower(${itemHistory.name}), ${query}) = 1 THEN 0 ELSE 1 END`,
					desc(itemHistory.lastUsedAt),
					desc(itemHistory.useCount),
					asc(itemHistory.name)
				]
				: [desc(itemHistory.lastUsedAt), desc(itemHistory.useCount), asc(itemHistory.name)])
		)
		.limit(limit)
		.all();

	return rows.map((row) => row.name);
}
