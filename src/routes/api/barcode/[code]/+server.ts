import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { barcodeCache } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

const USER_AGENT = 'Groly/0.2.6 (self-hosted grocery list app)';

// Produktname aus einer Open*Facts API-Antwort extrahieren
function extractName(data: Record<string, unknown>): string | null {
	if (data.status !== 1 || !data.product) return null;
	const product = data.product as Record<string, unknown>;
	const productName =
		(product.product_name_de as string | undefined)?.trim() ||
		(product.product_name as string | undefined)?.trim() ||
		'';
	if (!productName) return null;
	const brand = (product.brands as string | undefined)?.split(',')[0]?.trim() || '';
	return brand && !productName.toLowerCase().includes(brand.toLowerCase())
		? `${brand} ${productName}`
		: productName;
}

async function queryApi(url: string, signal: AbortSignal): Promise<string | null> {
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
	if (!res.ok) return null;
	const data = await res.json();
	return extractName(data);
}

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

	const abort = new AbortController();
	const { signal } = abort;

	// Open Food Facts sofort abfragen (95% aller Scans sind Lebensmittel)
	const foodPromise = queryApi(
		`https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_de,brands`,
		signal
	).catch(() => null);

	// Nach 1 Sekunde Open Products Facts + Open Beauty Facts parallel nachschießen
	const fallbackPromise = new Promise<string | null>((resolve) => {
		const timer = setTimeout(async () => {
			const result = await Promise.any([
				queryApi(
					`https://world.openproductsfacts.org/api/v2/product/${code}?fields=product_name,product_name_de,brands`,
					signal
				),
				queryApi(
					`https://world.openbeautyfacts.org/api/v2/product/${code}?fields=product_name,product_name_de,brands`,
					signal
				),
			]).catch(() => null);
			resolve(result);
		}, 1000);

		// Timer aufräumen wenn Signal abgebrochen wird
		signal.addEventListener('abort', () => clearTimeout(timer));
	});

	let name: string | null = null;
	try {
		name = await Promise.any([
			foodPromise.then(r => { if (r) { abort.abort(); return r; } return Promise.reject(); }),
			fallbackPromise.then(r => { if (r) { abort.abort(); return r; } return Promise.reject(); }),
		]);
	} catch {
		name = null;
	}

	if (!name) return json({ name: null });

	// In Cache schreiben
	db.insert(barcodeCache)
		.values({ barcode: code, name, lastSeenAt: Date.now() })
		.onConflictDoUpdate({ target: barcodeCache.barcode, set: { name, lastSeenAt: Date.now() } })
		.run();

	return json({ name });
};
