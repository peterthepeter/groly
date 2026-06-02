import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { searchOff, searchLocalCache, type ProductData } from '$lib/server/nutrition';
import { db } from '$lib/db';
import { genericFoods } from '$lib/db/schema';
import { sql, or, like } from 'drizzle-orm';

type GenericResult = {
	type: 'generic';
	id: string;
	name: string;
	kcalPer100: number;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
	defaultPieceWeight: number | null;
	defaultUnit: 'g' | 'ml' | 'piece';
};

type ProductResult = {
	type: 'product';
	barcode: string;
	name: string;
	brand: string | null;
	imageUrl: string | null;
	nutriscoreGrade: string | null;
	servingQuantity: number | null;
	kcalPer100: number | null;
	proteinPer100: number | null;
	fatPer100: number | null;
	carbsPer100: number | null;
	sugarPer100: number | null;
	fiberPer100: number | null;
	saltPer100: number | null;
};

function searchGenerics(query: string, lang: 'de' | 'en'): GenericResult[] {
	const q = query.trim().toLowerCase();
	if (!q) return [];
	const pattern = `%${q}%`;
	const nameCol = lang === 'de' ? genericFoods.nameDe : genericFoods.nameEn;
	const altNameCol = lang === 'de' ? genericFoods.nameEn : genericFoods.nameDe;
	const kwCol = lang === 'de' ? genericFoods.keywordsDe : genericFoods.keywordsEn;
	const altKwCol = lang === 'de' ? genericFoods.keywordsEn : genericFoods.keywordsDe;

	// Großzügig matchen (limit 60), danach in JS nach Relevanz sortieren und auf 15 kürzen.
	const rows = db.select().from(genericFoods).where(
		or(
			like(sql`lower(${nameCol})`, pattern),
			like(sql`lower(${altNameCol})`, pattern),
			like(sql`lower(coalesce(${kwCol}, ''))`, pattern),
			like(sql`lower(coalesce(${altKwCol}, ''))`, pattern)
		)
	).limit(60).all();

	// Relevanz-Score: exakter Name (0) > Name-Prefix (1) > Keyword-Wortanfang (2)
	// > Name-Substring (3) > Keyword-Substring (4). Kleiner = besser.
	function score(r: typeof rows[number]): number {
		const name = (lang === 'de' ? r.nameDe : r.nameEn).toLowerCase();
		const altName = (lang === 'de' ? r.nameEn : r.nameDe).toLowerCase();
		const kw = ((lang === 'de' ? r.keywordsDe : r.keywordsEn) ?? '').toLowerCase();
		const altKw = ((lang === 'de' ? r.keywordsEn : r.keywordsDe) ?? '').toLowerCase();
		if (name === q || altName === q) return 0;
		if (name.startsWith(q) || altName.startsWith(q)) return 1;
		const kwWords = `${kw},${altKw}`.split(/[,\s]+/).filter(Boolean);
		if (kwWords.some((w) => w.startsWith(q))) return 2;
		if (name.includes(q) || altName.includes(q)) return 3;
		return 4;
	}

	return rows
		.map((r) => ({ r, s: score(r) }))
		.sort((a, b) => a.s - b.s || a.r.nameDe.length - b.r.nameDe.length)
		.slice(0, 15)
		.map(({ r }) => ({
			type: 'generic' as const,
			id: r.id,
			name: lang === 'de' ? r.nameDe : r.nameEn,
			kcalPer100: r.kcalPer100,
			proteinPer100: r.proteinPer100,
			fatPer100: r.fatPer100,
			carbsPer100: r.carbsPer100,
			sugarPer100: r.sugarPer100,
			fiberPer100: r.fiberPer100,
			saltPer100: r.saltPer100,
			defaultPieceWeight: r.defaultPieceWeight,
			defaultUnit: r.defaultUnit as 'g' | 'ml' | 'piece'
		}));
}

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const q = event.url.searchParams.get('q')?.trim() ?? '';
	const lang = (event.url.searchParams.get('lang') === 'en' ? 'en' : 'de') as 'de' | 'en';
	// source: 'local' = nur Generics + Cache (schnell), 'off' = nur Online-Produkte (langsam),
	// fehlt = beides kombiniert (Rückwärtskompatibilität, z.B. Generic-Lookup per id).
	const source = event.url.searchParams.get('source');
	if (!q) return json({ generic: [], products: [] });

	const looksLikeBarcode = /^\d{8,14}$/.test(q);

	const mapProduct = (p: ProductData): ProductResult => ({
		type: 'product' as const,
		barcode: p.barcode,
		name: p.name,
		brand: p.brand,
		imageUrl: p.imageUrl,
		nutriscoreGrade: p.nutriscoreGrade,
		servingQuantity: p.servingQuantity,
		kcalPer100: p.kcalPer100,
		proteinPer100: p.proteinPer100,
		fatPer100: p.fatPer100,
		carbsPer100: p.carbsPer100,
		sugarPer100: p.sugarPer100,
		fiberPer100: p.fiberPer100,
		saltPer100: p.saltPer100
	});

	// Stufe „off" — nur die langsame Online-Suche.
	if (source === 'off') {
		if (looksLikeBarcode) return json({ products: [] });
		const off = await searchOff(q, 15, event.request.signal);
		return json({ products: off.map(mapProduct) });
	}

	// Stufe „local" — Generics + lokaler Cache, ohne Netzwerk.
	const generic = searchGenerics(q, lang);
	if (source === 'local') {
		const local = looksLikeBarcode ? [] : searchLocalCache(q, 15);
		return json({ generic, products: local.map(mapProduct), looksLikeBarcode });
	}

	// Default: beides kombiniert (lokal hat Vorrang, OFF füllt auf).
	let products: ProductResult[] = [];
	if (!looksLikeBarcode) {
		const local = searchLocalCache(q, 15);
		const off = await searchOff(q, 12, event.request.signal);
		const seen = new Set<string>();
		const combined: ProductData[] = [];
		for (const p of [...local, ...off]) {
			if (seen.has(p.barcode)) continue;
			seen.add(p.barcode);
			combined.push(p);
		}
		products = combined.slice(0, 20).map(mapProduct);
	}

	return json({ generic, products, looksLikeBarcode });
};
