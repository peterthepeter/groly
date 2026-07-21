import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import {
	deleteCategoryPreference,
	getCategoryPreferences,
	setCategoryPreference
} from '$lib/server/categoryPreferences';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;
	return json(getCategoryPreferences(user!.id));
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const body = await event.request.json();
	const result = setCategoryPreference(user!.id, body.name ?? '', body.categoryOverride);
	if ('error' in result) return json({ error: result.error }, { status: 400 });
	return json(result);
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const body = await event.request.json();
	const result = deleteCategoryPreference(user!.id, body.name ?? '');
	if ('error' in result) return json({ error: result.error }, { status: 400 });
	return json(result);
};
