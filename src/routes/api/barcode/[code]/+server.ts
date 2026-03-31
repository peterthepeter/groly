import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!code || !/^\d{8,14}$/.test(code)) {
		return json({ name: null }, { status: 400 });
	}

	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_de`,
			{
				headers: { 'User-Agent': 'Groly/0.2.1 (self-hosted grocery list app)' },
				signal: AbortSignal.timeout(5000)
			}
		);

		if (!res.ok) return json({ name: null });

		const data = await res.json();

		if (data.status !== 1 || !data.product) return json({ name: null });

		const name: string | null =
			(data.product.product_name_de as string | undefined)?.trim() ||
			(data.product.product_name as string | undefined)?.trim() ||
			null;

		return json({ name: name || null });
	} catch {
		return json({ name: null });
	}
};
