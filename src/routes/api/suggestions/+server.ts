import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { itemHistory } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const suggestions = db
		.select({ name: itemHistory.name })
		.from(itemHistory)
		.where(eq(itemHistory.userId, user!.id))
		.orderBy(sql`${itemHistory.useCount} DESC`)
		.limit(30)
		.all();

	return json(suggestions.map(s => s.name));
};
