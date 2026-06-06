// Shared Nutrition-Helpers für Server-Endpoints.

import { db, sqlite } from '$lib/db';
import { barcodeCache } from '$lib/db/schema';
import { eq, or, like, sql, desc } from 'drizzle-orm';

const USER_AGENT = 'Groly/0.7 (self-hosted grocery list app)';

const OFF_FIELDS = [
	'code',
	'product_name',
	'product_name_de',
	'brands',
	'quantity',
	'serving_size',
	'serving_quantity',
	'image_front_small_url',
	'image_url',
	'nutriscore_grade',
	'nova_group',
	'nutriments'
].join(',');

const OFF_HOSTS = [
	'world.openfoodfacts.org',
	'world.openproductsfacts.org',
	'world.openbeautyfacts.org'
];

type OffProduct = {
	code?: string;
	product_name?: string;
	product_name_de?: string;
	brands?: string;
	quantity?: string;
	serving_size?: string;
	serving_quantity?: number | string;
	image_front_small_url?: string;
	image_url?: string;
	nutriscore_grade?: string;
	nova_group?: number;
	nutriments?: Record<string, number | string | undefined>;
};

export type ProductData = {
	barcode: string;
	name: string;
	brand: string | null;
	imageUrl: string | null;
	servingSize: string | null;
	servingQuantity: number | null;
	nutriscoreGrade: string | null;
	novaGroup: number | null;
	kcalPer100: number | null;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
};

function num(v: unknown): number | null {
	if (typeof v === 'number' && Number.isFinite(v)) return v;
	if (typeof v === 'string') {
		const n = parseFloat(v);
		return Number.isFinite(n) ? n : null;
	}
	return null;
}

function extractName(product: OffProduct): string | null {
	const name =
		(product.product_name_de?.trim()) ||
		(product.product_name?.trim()) ||
		'';
	if (!name) return null;
	const brand = product.brands?.split(',')[0]?.trim() || '';
	return brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${brand} ${name}` : name;
}

function toProductData(barcode: string, product: OffProduct): ProductData | null {
	const name = extractName(product);
	if (!name) return null;
	const n = product.nutriments ?? {};
	return {
		barcode,
		name,
		brand: product.brands?.split(',')[0]?.trim() || null,
		imageUrl: product.image_front_small_url || product.image_url || null,
		servingSize: product.serving_size ?? null,
		servingQuantity: num(product.serving_quantity),
		nutriscoreGrade: product.nutriscore_grade ?? null,
		novaGroup: typeof product.nova_group === 'number' ? product.nova_group : null,
		kcalPer100: num(n['energy-kcal_100g']),
		proteinPer100: num(n['proteins_100g']),
		fatPer100: num(n['fat_100g']),
		carbsPer100: num(n['carbohydrates_100g']),
		sugarPer100: num(n['sugars_100g']),
		fiberPer100: num(n['fiber_100g']),
		saltPer100: num(n['salt_100g'])
	};
}

// Pro Versuch: bis Abbruch warten, dann neuer Versuch. Verhindert „nicht gefunden"
// durch eine einzelne fehlgeschlagene OFF-Anfrage (Rate-Limit/5xx/Timeout).
const OFF_TIMEOUT_MS = 4000;
const OFF_MAX_ATTEMPTS = 3;

// Wirft bei vorübergehenden Fehlern (→ wiederholen), gibt null zurück, wenn das
// Produkt in dieser DB definitiv nicht existiert (→ nicht wiederholen).
async function queryOff(host: string, code: string, signal: AbortSignal): Promise<OffProduct | null> {
	const url = `https://${host}/api/v2/product/${code}?fields=${OFF_FIELDS}`;
	const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
	if (res.status === 404) return null; // definitiv nicht in dieser DB
	if (!res.ok) throw new Error(`OFF ${res.status}`); // vorübergehend → wiederholen
	const data = await res.json();
	if (data.status !== 1 || !data.product) return null;
	return data.product as OffProduct;
}

/**
 * Lookup eines Produkts per Barcode. Cache-First, dann OFF.
 * Cache wird mit allen verfügbaren Nährwerten gefüllt.
 */
export async function lookupProduct(code: string): Promise<ProductData | null> {
	if (!/^\d{8,14}$/.test(code)) return null;

	const cached = db.select().from(barcodeCache).where(eq(barcodeCache.barcode, code)).get();
	if (cached) {
		// lastSeenAt updaten
		db.update(barcodeCache)
			.set({ lastSeenAt: Date.now() })
			.where(eq(barcodeCache.barcode, code))
			.run();

		// Wenn keine Nährwerte gecached → bei nächster Gelegenheit neu von OFF holen
		if (cached.kcalPer100 == null && (Date.now() - (cached.fetchedAt ?? 0)) > 24 * 60 * 60 * 1000) {
			// async aktualisieren, aber sofort zurückgeben was wir haben
			void refreshFromOff(code);
		}

		return {
			barcode: cached.barcode,
			name: cached.name,
			brand: cached.brand,
			imageUrl: cached.imageUrl,
			servingSize: cached.servingSize,
			servingQuantity: cached.servingQuantity,
			nutriscoreGrade: cached.nutriscoreGrade,
			novaGroup: cached.novaGroup,
			kcalPer100: cached.kcalPer100,
			proteinPer100: cached.proteinPer100,
			fatPer100: cached.fatPer100,
			carbsPer100: cached.carbsPer100,
			sugarPer100: cached.sugarPer100,
			fiberPer100: cached.fiberPer100,
			saltPer100: cached.saltPer100
		};
	}

	const fresh = await refreshFromOff(code);
	return fresh;
}

async function refreshFromOff(code: string): Promise<ProductData | null> {
	for (let attempt = 1; attempt <= OFF_MAX_ATTEMPTS; attempt++) {
		const abort = new AbortController();
		const timer = setTimeout(() => abort.abort(), OFF_TIMEOUT_MS);
		let transient = false;
		try {
			for (const host of OFF_HOSTS) {
				try {
					const product = await queryOff(host, code, abort.signal);
					if (product) {
						const data = toProductData(code, product);
						if (data) {
							persistCache(data, product);
							return data;
						}
					}
					// null = in diesem Host nicht vorhanden → nächster Host
				} catch {
					// Netzwerkfehler/Timeout/5xx bei diesem Host → vorübergehend
					transient = true;
				}
			}
		} finally {
			clearTimeout(timer);
		}
		// Alle Hosts sauber durchlaufen, kein vorübergehender Fehler → wirklich nicht gefunden
		if (!transient) return null;
		// Sonst kurz warten und erneut versuchen
		if (attempt < OFF_MAX_ATTEMPTS) {
			await new Promise((r) => setTimeout(r, 250 * attempt));
		}
	}
	return null;
}

function persistCache(data: ProductData, raw: OffProduct) {
	const now = Date.now();
	sqlite.prepare(`
		INSERT INTO barcode_cache (
			barcode, name, brand, image_url, serving_size, serving_quantity,
			nutriscore_grade, nova_group,
			kcal_per_100, protein_per_100, fat_per_100, carbs_per_100,
			sugar_per_100, fiber_per_100, salt_per_100,
			nutriments_json, fetched_at, last_seen_at
		) VALUES (
			@barcode, @name, @brand, @imageUrl, @servingSize, @servingQuantity,
			@nutriscoreGrade, @novaGroup,
			@kcalPer100, @proteinPer100, @fatPer100, @carbsPer100,
			@sugarPer100, @fiberPer100, @saltPer100,
			@nutrimentsJson, @fetchedAt, @lastSeenAt
		)
		ON CONFLICT(barcode) DO UPDATE SET
			name = excluded.name,
			brand = excluded.brand,
			image_url = excluded.image_url,
			serving_size = excluded.serving_size,
			serving_quantity = excluded.serving_quantity,
			nutriscore_grade = excluded.nutriscore_grade,
			nova_group = excluded.nova_group,
			kcal_per_100 = excluded.kcal_per_100,
			protein_per_100 = excluded.protein_per_100,
			fat_per_100 = excluded.fat_per_100,
			carbs_per_100 = excluded.carbs_per_100,
			sugar_per_100 = excluded.sugar_per_100,
			fiber_per_100 = excluded.fiber_per_100,
			salt_per_100 = excluded.salt_per_100,
			nutriments_json = excluded.nutriments_json,
			fetched_at = excluded.fetched_at,
			last_seen_at = excluded.last_seen_at
	`).run({
		barcode: data.barcode,
		name: data.name,
		brand: data.brand,
		imageUrl: data.imageUrl,
		servingSize: data.servingSize,
		servingQuantity: data.servingQuantity,
		nutriscoreGrade: data.nutriscoreGrade,
		novaGroup: data.novaGroup,
		kcalPer100: data.kcalPer100,
		proteinPer100: data.proteinPer100,
		fatPer100: data.fatPer100,
		carbsPer100: data.carbsPer100,
		sugarPer100: data.sugarPer100,
		fiberPer100: data.fiberPer100,
		saltPer100: data.saltPer100,
		nutrimentsJson: raw.nutriments ? JSON.stringify(raw.nutriments) : null,
		fetchedAt: now,
		lastSeenAt: now
	});
}

/**
 * Lokale Produkt-Suche im `barcode_cache` per LIKE auf name + brand.
 * Treffer wurden alle schon mal von OFF abgefragt (von irgendeinem User auf diesem Server).
 */
export function searchLocalCache(query: string, limit = 15): ProductData[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const prefix = `${q}%`;
	const pattern = `%${q}%`;
	const nameL = sql`lower(${barcodeCache.name})`;
	const brandL = sql`lower(coalesce(${barcodeCache.brand}, ''))`;
	const rows = db.select().from(barcodeCache)
		.where(or(like(nameL, pattern), like(brandL, pattern)))
		// Relevanz vor Aktualität: exakter Name → Name-Prefix → Marken-Prefix → Substring,
		// erst danach nach zuletzt gesehen.
		.orderBy(
			sql`CASE
				WHEN ${nameL} = ${q} THEN 0
				WHEN ${nameL} LIKE ${prefix} THEN 1
				WHEN ${brandL} LIKE ${prefix} THEN 2
				ELSE 3 END`,
			desc(barcodeCache.lastSeenAt)
		)
		.limit(limit)
		.all();

	return rows.map((r) => ({
		barcode: r.barcode,
		name: r.name,
		brand: r.brand,
		imageUrl: r.imageUrl,
		servingSize: r.servingSize,
		servingQuantity: r.servingQuantity,
		nutriscoreGrade: r.nutriscoreGrade,
		novaGroup: r.novaGroup,
		kcalPer100: r.kcalPer100,
		proteinPer100: r.proteinPer100,
		fatPer100: r.fatPer100,
		carbsPer100: r.carbsPer100,
		sugarPer100: r.sugarPer100,
		fiberPer100: r.fiberPer100,
		saltPer100: r.saltPer100
	}));
}

/**
 * Textsuche in Open Food Facts. Liefert max. `limit` Produkte (max 20).
 * Jeder Treffer wird in den `barcode_cache` geschrieben, damit künftige Scans
 * oder Suchen mit dem gleichen Produkt cache-hit haben.
 */
export async function searchOff(query: string, limit = 15, signal?: AbortSignal): Promise<ProductData[]> {
	const q = query.trim();
	if (!q) return [];
	// search-a-licious (Elasticsearch): ~0,2s statt mehrerer Sekunden beim alten cgi/search.pl,
	// echtes Relevanz-Ranking + Popularitäts-Sort (unique_scans_n). Das v2/search-Endpoint
	// ignoriert search_terms komplett und ist daher ungeeignet.
	// Optionaler Länderfilter via OFF_COUNTRY (leer = weltweit) als Lucene-Filter im q.
	const country = process.env.OFF_COUNTRY?.trim();
	const qExpr = country ? `${q} countries_tags:"en:${country.toLowerCase()}"` : q;
	const params = new URLSearchParams({
		q: qExpr,
		sort_by: '-unique_scans_n',
		page_size: String(Math.min(limit, 20)),
		fields: OFF_FIELDS
	});
	const url = `https://search.openfoodfacts.org/search?${params.toString()}`;
	try {
		const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal });
		if (!res.ok) return [];
		const data = await res.json();
		const hits = Array.isArray(data.hits) ? (data.hits as OffProduct[]) : [];
		const results: ProductData[] = [];
		for (const h of hits) {
			if (!h.code) continue;
			// SaL liefert brands als Array → auf Komma-String normalisieren (toProductData erwartet String).
			const normalized: OffProduct = {
				...h,
				brands: Array.isArray(h.brands) ? (h.brands as string[]).join(', ') : h.brands
			};
			const d = toProductData(String(h.code), normalized);
			// kcal-Pflicht: Produkte ohne Energiewert sind für den Tracker nutzlos.
			if (d && d.kcalPer100 != null) {
				results.push(d);
				try { persistCache(d, normalized); } catch { /* cache best-effort */ }
			}
		}
		return results;
	} catch {
		return [];
	}
}

/**
 * Berechnet die effektive Grammzahl aus amount + unit.
 * piece → benötigt gramsPerPiece, ml → wird wie Gramm behandelt (Wasser-Dichte).
 */
export function effectiveGrams(amount: number, unit: 'g' | 'ml' | 'piece', gramsPerPiece: number | null | undefined): number {
	if (unit === 'piece') return amount * (gramsPerPiece ?? 0);
	return amount; // g und ml behandeln wir näherungsweise gleich
}

export type Per100 = {
	kcal?: number | null;
	protein?: number | null;
	fat?: number | null;
	carbs?: number | null;
	sugar?: number | null;
	fiber?: number | null;
	salt?: number | null;
};

// clientLogId-Präfix für Koffein-Logs, die aus einer Nutrition-Mahlzeit gespiegelt wurden.
// Ermöglicht das Mit-Löschen beim Löschen der Mahlzeit (Nutrition → Koffein, eine Richtung).
export function mealCaffeineLogPrefix(mealId: string): string {
	return `meal:${mealId}:`;
}

// Snapshot der Zutaten eines Rezepts (nur Namen, normalisiert) für die „veraltet"-Erkennung
// der Nährwert-Zuordnung. Bewusst OHNE Mengen: das Hoch-/Runterskalieren der Portionen ändert
// die Mengen, aber nicht die Zutaten selbst → soll die Zuordnung NICHT als veraltet markieren.
export function recipeIngredientsSnapshot(names: (string | null | undefined)[]): string {
	return names
		.map((n) => (n ?? '').trim().toLowerCase())
		.filter((n) => n.length > 0)
		.join('|');
}

export function computeTotals(per100: Per100, grams: number) {
	const scale = grams / 100;
	return {
		kcal: (per100.kcal ?? 0) * scale,
		protein: (per100.protein ?? 0) * scale,
		fat: (per100.fat ?? 0) * scale,
		carbs: (per100.carbs ?? 0) * scale,
		sugar: (per100.sugar ?? 0) * scale,
		fiber: (per100.fiber ?? 0) * scale,
		salt: (per100.salt ?? 0) * scale
	};
}
