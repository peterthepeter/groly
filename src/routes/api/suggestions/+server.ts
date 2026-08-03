import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { queryItemSuggestions } from '$lib/server/itemSuggestions';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const query = event.url.searchParams.get('q')?.slice(0, 120) ?? '';
	return json(queryItemSuggestions(db, user!.id, query, query.trim() ? 5 : 30));
};
