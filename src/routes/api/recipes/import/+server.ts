import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';

interface SchemaRecipe {
	'@type': string;
	name?: string;
	description?: string;
	image?: string | { url?: string } | Array<string | { url?: string }>;
	recipeYield?: string | number;
	prepTime?: string;
	cookTime?: string;
	recipeIngredient?: string[];
	recipeInstructions?: string | string[] | Array<{ '@type'?: string; text?: string }>;
}

function parseIso8601Duration(duration: string): number | null {
	const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
	if (!match) return null;
	const hours = parseInt(match[1] ?? '0');
	const minutes = parseInt(match[2] ?? '0');
	return hours * 60 + minutes;
}

function extractImageUrl(image: SchemaRecipe['image']): string | null {
	if (!image) return null;
	if (typeof image === 'string') return image;
	if (Array.isArray(image)) {
		const first = image[0];
		if (typeof first === 'string') return first;
		if (first && typeof first === 'object') return first.url ?? null;
		return null;
	}
	if (typeof image === 'object') return image.url ?? null;
	return null;
}

// Cleans German recipe plural markers: "Zehe/n" → "Zehe", "Paprikaschote(n)" → "Paprikaschote"
function cleanGermanPlural(str: string): string {
	return str
		// "Word/n", "Word/en", "Word/e", "Word/s" → "Word"
		.replace(/\/(?:nen|nen|en|n|e|s)\b/g, '')
		// "Word(n)", "Word(en)", "Word(e)", "Word(s)" → "Word"
		.replace(/\((?:nen|en|n|e|s)\)/g, '')
		.trim();
}

// Strips trailing parenthetical qualifiers that are editorial notes, not part of the name
// e.g. "(oder halb und halb)" → removed, but keeps "(frisch)" if it's short and useful
function stripEditorialParens(str: string): string {
	// Remove long parenthetical notes (>12 chars) that start with "oder", "ca.", "z.B.", "nach"
	return str.replace(/\s*\((?:oder|ca\.|z\.B\.|nach\s|wahlweise|alternativ)[^)]*\)/gi, '').trim();
}

function cleanText(str: string): string {
	return stripEditorialParens(cleanGermanPlural(str)).trim();
}

function parseIngredient(raw: string): { amount: string | null; unit: string | null; name: string } {
	const str = raw.trim();
	// Match: optional number/fraction at start, optional unit, rest is name
	const match = str.match(/^(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+)?(?:\s*-\s*\d+(?:[.,]\d+)?)?)\s*([a-zA-ZäöüÄÖÜ]+(?:\.|))?\s+(.+)$/);
	if (match) {
		return {
			amount: match[1]?.trim() || null,
			unit: cleanText(match[2]?.replace('.', '').trim() ?? '') || null,
			name: cleanText(match[3]?.trim() ?? str) || str.trim()
		};
	}
	return { amount: null, unit: null, name: cleanText(str) || str.trim() };
}

function parseInstructions(instructions: SchemaRecipe['recipeInstructions']): string[] {
	if (!instructions) return [];
	if (typeof instructions === 'string') {
		return instructions.split(/\n+/).map(s => s.trim()).filter(Boolean);
	}
	if (Array.isArray(instructions)) {
		const steps: string[] = [];
		for (const item of instructions) {
			if (typeof item === 'string') {
				steps.push(item.trim());
			} else if (item && typeof item === 'object') {
				const obj = item as Record<string, unknown>;
				if (obj.text) {
					steps.push(String(obj.text).trim());
				} else if (Array.isArray(obj['itemListElement'])) {
					// HowToSection with nested steps
					for (const sub of obj['itemListElement'] as unknown[]) {
						if (typeof sub === 'string') steps.push(sub.trim());
						else if (sub && typeof sub === 'object') {
							const subObj = sub as Record<string, unknown>;
							if (subObj.text) steps.push(String(subObj.text).trim());
						}
					}
				}
			}
		}
		return steps.filter(Boolean);
	}
	return [];
}

function parseServings(yieldValue: string | number | undefined): number {
	if (!yieldValue) return 4;
	if (typeof yieldValue === 'number') return yieldValue;
	const match = yieldValue.match(/\d+/);
	return match ? parseInt(match[0]) : 4;
}

function findRecipeInLd(data: unknown): SchemaRecipe | null {
	if (!data || typeof data !== 'object') return null;
	const obj = data as Record<string, unknown>;

	if (obj['@type'] === 'Recipe') return obj as unknown as SchemaRecipe;

	// Handle @graph array
	if (Array.isArray(obj['@graph'])) {
		for (const node of obj['@graph']) {
			const found = findRecipeInLd(node);
			if (found) return found;
		}
	}

	// Handle array at top level
	if (Array.isArray(data)) {
		for (const item of data) {
			const found = findRecipeInLd(item);
			if (found) return found;
		}
	}

	return null;
}

function validateRecipeUrl(raw: string): boolean {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return false;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
	const host = parsed.hostname.toLowerCase();
	// Block localhost, loopback, private ranges, link-local, metadata services
	if (
		host === 'localhost' ||
		/^127\./.test(host) ||
		/^10\./.test(host) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
		/^192\.168\./.test(host) ||
		/^169\.254\./.test(host) ||
		host === '::1' ||
		/^fc[0-9a-f]{2}:/i.test(host) ||
		host === '0.0.0.0'
	) return false;
	return true;
}

export const POST: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const { url } = await event.request.json();
	if (!url?.trim()) return json({ error: 'URL fehlt' }, { status: 400 });
	if (!validateRecipeUrl(url.trim())) return json({ error: 'Ungültige URL' }, { status: 400 });

	let html: string;
	try {
		const res = await fetch(url, {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Groly/1.0)' },
			signal: AbortSignal.timeout(10000)
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		html = await res.text();
	} catch (e) {
		return json({ error: 'Seite konnte nicht geladen werden' }, { status: 422 });
	}

	// Extract all JSON-LD blocks
	const ldBlocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
	let schemaRecipe: SchemaRecipe | null = null;

	for (const block of ldBlocks) {
		try {
			const parsed = JSON.parse(block[1]);
			const found = findRecipeInLd(parsed);
			if (found) { schemaRecipe = found; break; }
		} catch { /* skip invalid JSON */ }
	}

	if (!schemaRecipe) {
		return json({ error: 'Kein Rezept auf dieser Seite gefunden. Die Seite unterstützt leider das Recipe-Schema nicht.' }, { status: 422 });
	}

	const ingredients = (schemaRecipe.recipeIngredient ?? []).map(parseIngredient);
	const steps = parseInstructions(schemaRecipe.recipeInstructions).map((text, i) => ({ stepNumber: i + 1, text }));

	return json({
		title: schemaRecipe.name ?? '',
		description: schemaRecipe.description ?? null,
		imageUrl: extractImageUrl(schemaRecipe.image),
		sourceUrl: url,
		servings: parseServings(schemaRecipe.recipeYield),
		prepTime: schemaRecipe.prepTime ? parseIso8601Duration(schemaRecipe.prepTime) : null,
		cookTime: schemaRecipe.cookTime ? parseIso8601Duration(schemaRecipe.cookTime) : null,
		ingredients,
		steps
	});
};
