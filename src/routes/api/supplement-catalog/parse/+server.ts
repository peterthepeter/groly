import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';

function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n)))
		.replace(/&[a-z]+;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

const UNIT_MAP: Record<string, string> = {
	kapseln: 'Kapsel', kapsel: 'Kapsel', capsules: 'Kapsel', capsule: 'Kapsel',
	softgels: 'Kapsel', softgel: 'Kapsel',
	tabletten: 'Tablette', tablette: 'Tablette', tablets: 'Tablette', tablet: 'Tablette', tbl: 'Tablette',
	stück: 'Stück', stueck: 'Stück', stk: 'Stück',
};

function normalizeUnit(u: string): string {
	return UNIT_MAP[u.toLowerCase().trim()] ?? u;
}

interface Nutrient { name: string; amount: number; unit: string }

interface ParseResult {
	name: string;
	brand: string | null;
	unit: string | null;
	packageSize: number | null;
	nutrientsText: string;
	servingNote: string | null;
}

function extractTableRows(tableHtml: string): string[][] {
	const rows: string[][] = [];
	const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
	let rowMatch;
	while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
		const cellRegex = /<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi;
		const cells: string[] = [];
		let cellMatch;
		while ((cellMatch = cellRegex.exec(rowMatch[1])) !== null) {
			cells.push(stripHtml(cellMatch[1]).trim());
		}
		if (cells.length > 0) rows.push(cells);
	}
	return rows;
}

// Parse German/international numbers: "2.000" → 2000, "6,8" → 6.8, "200" → 200
function parseAmount(s: string): number {
	const cleaned = s.trim();
	if (/^\d{1,3}(\.\d{3})+$/.test(cleaned)) return parseFloat(cleaned.replace(/\./g, ''));
	return parseFloat(cleaned.replace(',', '.'));
}

function extractNutrientFromValue(valueStr: string): { amount: number; unit: string } | null {
	const m = valueStr.match(/([\d.,]+)\s*(mg|mcg|µg|ug|g|IU|IE|%|ml)/i);
	if (!m) return null;
	const amount = parseAmount(m[1]);
	if (isNaN(amount) || amount <= 0) return null;
	const unit = m[2].replace(/IE/i, 'IU').replace(/µg|ug/i, 'mcg');
	return { amount, unit };
}

function detectServing(text: string): { divisor: number; label: string } | null {
	const m = text.match(/(?:pro|je|per)\s+(\d+)\s+(kapsel(?:n)?|tablette(?:n)?|softgel(?:s)?|capsule(?:s)?|tablet(?:s)?|stück)/i);
	if (!m) return null;
	const n = parseInt(m[1]);
	if (n <= 1 || n > 20) return null;
	return { divisor: n, label: `${m[1]} ${m[2]}` };
}

const SKIP_NAMES = /nährstoff|inhaltsstoff|nutrient|bezeichnung|thereof|gesamt|total|reference|referenz|zusammensetzung/i;

function parseNutrientsFromHtml(html: string): { nutrients: Nutrient[]; servingNote: string | null } {

	// ── Strategy 1: HTML <table> ─────────────────────────────────────────────────
	const tables = html.match(/<table[\s\S]*?<\/table>/gi) ?? [];
	for (const table of tables) {
		const rows = extractTableRows(table);
		if (rows.length < 2) continue;

		const serving = detectServing(rows[0].join(' '));
		const divisor = serving?.divisor ?? 1;
		const nutrients: Nutrient[] = [];

		for (let i = 1; i < rows.length; i++) {
			const row = rows[i];
			const name = (row[0] ?? '').trim();
			if (!name || name.length > 80 || SKIP_NAMES.test(name)) continue;

			let parsed: { amount: number; unit: string } | null = null;
			for (let c = 1; c < row.length && !parsed; c++) {
				parsed = extractNutrientFromValue(row[c]);
				// Also try amount-only + next-cell unit
				if (!parsed) {
					const m2 = row[c].match(/^([\d.,]+)$/);
					if (m2 && row[c + 1]) {
						const m3 = row[c + 1].trim().match(/^(mg|mcg|µg|ug|g|IU|IE|%|ml)$/i);
						if (m3) {
							const amount = parseAmount(m2[1]);
							if (!isNaN(amount) && amount > 0)
								parsed = { amount, unit: m3[1].replace(/IE/i, 'IU').replace(/µg|ug/i, 'mcg') };
						}
					}
				}
			}
			if (!parsed) continue;
			nutrients.push({ name, amount: Math.round((parsed.amount / divisor) * 10000) / 10000, unit: parsed.unit });
		}

		if (nutrients.length >= 1) {
			return { nutrients, servingNote: serving ? `Werte durch ${serving.divisor} geteilt (Angabe pro ${serving.label})` : null };
		}
	}

	// ── Strategy 2: accordion__table-item div pairs ───────────────────────────────
	const accordionItems = [...html.matchAll(/class="accordion__table-item[^"]*"[^>]*>([\s\S]*?)<\/div>/g)]
		.map(m => m[1].replace(/<[^>]+>/g, '').trim())
		.filter(Boolean);

	if (accordionItems.length >= 2) {
		// Detect serving from surrounding text
		const accordionCtx = html.match(/accordion[\s\S]{0,2000}/i)?.[0] ?? '';
		const serving = detectServing(accordionCtx);
		const divisor = serving?.divisor ?? 1;
		const nutrients: Nutrient[] = [];

		for (let i = 0; i + 1 < accordionItems.length; i += 2) {
			const name = accordionItems[i].replace(/^\s*davon\s+/i, '').trim();
			const valueStr = accordionItems[i + 1];
			if (!name || name.length > 80 || SKIP_NAMES.test(name)) continue;
			const parsed = extractNutrientFromValue(valueStr);
			if (!parsed) continue;
			nutrients.push({ name, amount: Math.round((parsed.amount / divisor) * 10000) / 10000, unit: parsed.unit });
		}

		if (nutrients.length >= 1) {
			return { nutrients, servingNote: serving ? `Werte durch ${serving.divisor} geteilt (Angabe pro ${serving.label})` : null };
		}
	}

	return { nutrients: [], servingNote: null };
}

function extractPackageSize(text: string): { packageSize: number; unit: string } | null {
	// Prefer numbers ≥ 30 (avoids matching "1 Kapsel" serving size)
	const regex = /(\d{2,4})\s*(kapsel(?:n)?|tablette(?:n)?|stück|softgel(?:s)?|capsule(?:s)?|tablet(?:s)?)/gi;
	let match;
	const candidates: { packageSize: number; unit: string }[] = [];
	while ((match = regex.exec(text)) !== null) {
		candidates.push({ packageSize: parseInt(match[1]), unit: normalizeUnit(match[2]) });
	}
	return candidates.find(c => c.packageSize >= 30)
		?? candidates.find(c => c.packageSize >= 10)
		?? null;
}

async function fetchWithTimeout(url: string, accept = 'text/html'): Promise<Response> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), 12000);
	try {
		return await fetch(url, {
			signal: controller.signal,
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; Groly/1.0)',
				'Accept': accept,
			}
		});
	} finally {
		clearTimeout(timer);
	}
}

export const GET: RequestHandler = async (event) => {
	const { error: authError } = adminGuard(event);
	if (authError) return authError;

	const rawUrl = event.url.searchParams.get('url');
	if (!rawUrl) return json({ error: 'URL required' }, { status: 400 });

	let targetUrl: URL;
	try {
		targetUrl = new URL(rawUrl);
		if (!['http:', 'https:'].includes(targetUrl.protocol)) throw new Error();
	} catch {
		return json({ error: 'Ungültige URL' }, { status: 400 });
	}

	// Block SSRF: reject private/internal hostnames and IP ranges
	const host = targetUrl.hostname.toLowerCase();
	const isPrivate =
		host === 'localhost' ||
		host.endsWith('.local') ||
		host.endsWith('.internal') ||
		/^127\./.test(host) ||
		/^10\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
		host === '169.254.169.254'; // cloud metadata
	if (isPrivate) return json({ error: 'URL nicht erlaubt' }, { status: 400 });

	try {
		let name = '';
		let brand: string | null = null;

		// ── Step 1: Try Shopify JSON for clean name + brand ───────────────────────
		if (targetUrl.pathname.includes('/products/')) {
			const handle = targetUrl.pathname.split('/products/')[1]?.split('?')[0].split('/')[0];
			if (handle) {
				try {
					const shopRes = await fetchWithTimeout(
						`${targetUrl.origin}/products/${handle}.json`,
						'application/json'
					);
					const ct = shopRes.headers.get('content-type') ?? '';
					if (shopRes.ok && ct.includes('json')) {
						const data = await shopRes.json();
						const product = data?.product;
						if (product) {
							name = product.title ?? '';
							brand = product.vendor || null;
						}
					}
				} catch { /* ignore, fall through */ }
			}
		}

		// ── Step 2: Fetch HTML page for package size + nutrients ──────────────────
		const htmlRes = await fetchWithTimeout(rawUrl);
		if (!htmlRes.ok) return json({ error: `HTTP ${htmlRes.status}` }, { status: 502 });

		const html = await htmlRes.text();

		// Fallback name from HTML if Shopify JSON didn't provide it
		if (!name) {
			const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
			const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
			name = stripHtml(h1Match?.[1] ?? titleMatch?.[1] ?? targetUrl.hostname)
				.split('|')[0].split('–')[0].split(' - ')[0].trim();
		}

		// Package size from HTML plain text
		const plainText = stripHtml(html);
		const pkg = extractPackageSize(plainText);

		// Nutrients from HTML tables
		const { nutrients, servingNote } = parseNutrientsFromHtml(html);

		return json({
			name,
			brand,
			unit: pkg?.unit ?? null,
			packageSize: pkg?.packageSize ?? null,
			nutrientsText: nutrients.map(n => `${n.name}, ${n.amount}, ${n.unit}`).join('\n'),
			servingNote,
		} satisfies ParseResult);

	} catch (e) {
		const msg = e instanceof Error ? e.message : 'Fehler';
		return json({ error: msg }, { status: 500 });
	}
};
