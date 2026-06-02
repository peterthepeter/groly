import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { lookupProduct } from '$lib/server/nutrition';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const code = event.params.barcode;
	const product = await lookupProduct(code);
	if (!product) return json({ product: null });
	return json({ product });
};
