import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/db';
import { barcodeCache } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { authGuard } from '$lib/auth/middleware';

const USER_AGENT = 'Groly/0.2.6 (self-hosted grocery list app)';

const OFF_HOSTS = [
	'world.openfoodfacts.org',      // Lebensmittel (95% aller Scans)
	'world.openproductsfacts.org',  // sonstige Produkte
	'world.openbeautyfacts.org'     // Kosmetik
];
const OFF_TIMEOUT_MS = 4000;
const OFF_MAX_ATTEMPTS = 3;

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

// Wirft bei vorübergehenden Fehlern (→ wiederholen), gibt null zurück, wenn das
// Produkt in dieser DB definitiv nicht existiert (→ nicht wiederholen).
async function queryApi(host: string, code: string, signal: AbortSignal): Promise<string | null> {
	const url = `https://${host}/api/v2/product/${code}?fields=product_name,product_name_de,brands`;
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
	if (res.status === 404) return null; // definitiv nicht in dieser DB
	if (!res.ok) throw new Error(`OFF ${res.status}`); // vorübergehend → wiederholen
	const data = await res.json();
	return extractName(data);
}

// Name über alle Open*Facts-Hosts suchen. Eine einzelne fehlgeschlagene Anfrage
// (Rate-Limit/5xx/Timeout) führt NICHT mehr zu „nicht gefunden", sondern zu einem
// erneuten Versuch – das war die Ursache fürs „zweimal scannen".
async function lookupName(code: string): Promise<string | null> {
	for (let attempt = 1; attempt <= OFF_MAX_ATTEMPTS; attempt++) {
		const abort = new AbortController();
		const timer = setTimeout(() => abort.abort(), OFF_TIMEOUT_MS);
		let transient = false;
		try {
			for (const host of OFF_HOSTS) {
				try {
					const name = await queryApi(host, code, abort.signal);
					if (name) return name;
					// null = in diesem Host nicht vorhanden → nächster Host
				} catch {
					transient = true; // Netzwerkfehler/Timeout/5xx → vorübergehend
				}
			}
		} finally {
			clearTimeout(timer);
		}
		if (!transient) return null; // sauber durchgelaufen → wirklich nicht gefunden
		if (attempt < OFF_MAX_ATTEMPTS) {
			await new Promise((r) => setTimeout(r, 250 * attempt));
		}
	}
	return null;
}

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const { code } = event.params;

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

	const name = await lookupName(code);

	if (!name) return json({ name: null });

	// In Cache schreiben
	db.insert(barcodeCache)
		.values({ barcode: code, name, lastSeenAt: Date.now() })
		.onConflictDoUpdate({ target: barcodeCache.barcode, set: { name, lastSeenAt: Date.now() } })
		.run();

	return json({ name });
};
