import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { barcodeCache } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async ({ params }) => {
	const { code } = params;

	if (!code || !/^\d{8,14}$/.test(code)) {
		return json({ name: null }, { status: 400 });
	}

	// Cache-Hit prüfen
	const cached = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, code)).get();
	if (cached) {
		db.update(barcodeCache)
			.set({ lastSeenAt: Date.now() })
			.where(eq(barcodeCache.barcode, code))
			.run();
		return json({ name: cached.name });
	}

	// Open Food Facts abfragen
	try {
		const res = await fetch(
			`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_de,brands`,
			{
				headers: { 'User-Agent': 'Groly/0.2.1 (self-hosted grocery list app)' },
				signal: AbortSignal.timeout(5000)
			}
		);

		if (!res.ok) return json({ name: null });

		const data = await res.json();

		if (data.status !== 1 || !data.product) return json({ name: null });

		const productName: string =
			(data.product.product_name_de as string | undefined)?.trim() ||
			(data.product.product_name as string | undefined)?.trim() ||
			'';

		if (!productName) return json({ name: null });

		// Ersten Hersteller voranstellen, falls nicht schon im Produktnamen enthalten
		const brand = (data.product.brands as string | undefined)?.split(',')[0]?.trim() || '';
		const name = brand && !productName.toLowerCase().includes(brand.toLowerCase())
			? `${brand} ${productName}`
			: productName;

		// In Cache schreiben
		db.insert(barcodeCache)
			.values({ barcode: code, name, lastSeenAt: Date.now() })
			.onConflictDoUpdate({ target: barcodeCache.barcode, set: { name, lastSeenAt: Date.now() } })
			.run();

		return json({ name });
	} catch {
		return json({ name: null });
	}
};
