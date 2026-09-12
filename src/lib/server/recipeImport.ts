export type ImportedIngredient = {
	amount: string | null;
	unit: string | null;
	name: string;
};

export type ImportedRecipe = {
	title: string;
	description: string | null;
	imageUrl: string | null;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	ingredients: ImportedIngredient[];
	steps: Array<{ stepNumber: number; text: string }>;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
	return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeText(value: unknown): string | null {
	if (typeof value !== 'string' && typeof value !== 'number') return null;
	const text = String(value)
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;|&#160;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&quot;/gi, '"')
		.replace(/&#(?:39|x27);/gi, "'")
		.replace(/\s+/g, ' ')
		.trim();
	return text || null;
}

function hasRecipeType(value: unknown): boolean {
	if (typeof value === 'string') return value.toLowerCase() === 'recipe';
	return Array.isArray(value) && value.some((entry) => typeof entry === 'string' && entry.toLowerCase() === 'recipe');
}

/** Finds a Recipe node even when a site nests it in @graph, mainEntity, or an array. */
export function findRecipeInJsonLd(data: unknown, depth = 0): JsonRecord | null {
	if (depth > 20 || data === null || typeof data !== 'object') return null;
	if (Array.isArray(data)) {
		for (const item of data) {
			const found = findRecipeInJsonLd(item, depth + 1);
			if (found) return found;
		}
		return null;
	}

	const record = data as JsonRecord;
	if (hasRecipeType(record['@type'])) return record;
	for (const value of Object.values(record)) {
		if (value !== null && typeof value === 'object') {
			const found = findRecipeInJsonLd(value, depth + 1);
			if (found) return found;
		}
	}
	return null;
}

function parseIso8601Duration(value: unknown): number | null {
	if (typeof value !== 'string') return null;
	const match = value.trim().match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i);
	if (!match) return null;
	const minutes = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60;
	return Number.isFinite(minutes) && minutes > 0 ? Math.max(1, Math.round(minutes)) : null;
}

function extractImageUrl(value: unknown): string | null {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const found = extractImageUrl(entry);
			if (found) return found;
		}
		return null;
	}
	if (typeof value === 'string') {
		try {
			const url = new URL(value);
			return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
		} catch {
			return null;
		}
	}
	if (isRecord(value)) return extractImageUrl(value.url) ?? extractImageUrl(value.contentUrl);
	return null;
}

function extractPositiveInteger(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : null;
	}
	if (typeof value === 'string') {
		const match = value.match(/\d+(?:[.,]\d+)?/);
		if (!match) return null;
		const parsed = Number(match[0].replace(',', '.'));
		return Number.isFinite(parsed) && parsed > 0 ? Math.max(1, Math.round(parsed)) : null;
	}
	if (Array.isArray(value)) {
		for (const entry of value) {
			const found = extractPositiveInteger(entry);
			if (found) return found;
		}
		return null;
	}
	if (isRecord(value)) {
		return extractPositiveInteger(value.value)
			?? extractPositiveInteger(value.maxValue)
			?? extractPositiveInteger(value.minValue);
	}
	return null;
}

function cleanGermanPlural(value: string): string {
	return value
		.replace(/\/(?:nen|en|n|e|s)\b/g, '')
		.replace(/\((?:nen|en|n|e|s)\)/g, '')
		.trim();
}

function cleanText(value: string): string {
	return cleanGermanPlural(value)
		.replace(/\s*\((?:oder|ca\.|z\.\s?B\.|nach\s|wahlweise|alternativ)[^)]*\)/gi, '')
		.trim();
}

export function parseIngredient(raw: string): ImportedIngredient {
	const text = normalizeText(raw) ?? '';
	const number = String.raw`(?:\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+)?|\d+\s*\/\s*\d+|[¼½¾⅓⅔⅛⅜⅝⅞])`;
	const match = text.match(new RegExp(`^(${number}(?:\\s*[–-]\\s*${number})?)\\s*([\\p{L}µμ]+\\.?)?\\s+(.+)$`, 'u'));
	if (!match) return { amount: null, unit: null, name: cleanText(text) || text };
	return {
		amount: match[1]?.trim() || null,
		unit: cleanText(match[2]?.replace(/\.$/, '') ?? '') || null,
		name: cleanText(match[3] ?? text) || text
	};
}

function ingredientTexts(value: unknown): string[] {
	if (Array.isArray(value)) return value.flatMap(ingredientTexts);
	const direct = typeof value === 'string' ? normalizeText(value) : null;
	if (direct) return [direct];
	if (!isRecord(value)) return [];
	if (value.itemListElement !== undefined) return ingredientTexts(value.itemListElement);
	const text = normalizeText(value.text);
	if (text) return [text];
	const name = normalizeText(value.name);
	const amount = normalizeText(value.value) ?? normalizeText(value.amount);
	const unit = normalizeText(value.unitText) ?? normalizeText(value.unitCode);
	const combined = [amount, unit, name].filter(Boolean).join(' ');
	return combined ? [combined] : [];
}

function instructionTexts(value: unknown): string[] {
	if (typeof value === 'string') {
		return value.split(/\n+/).map(normalizeText).filter((entry): entry is string => Boolean(entry));
	}
	if (Array.isArray(value)) return value.flatMap(instructionTexts);
	if (!isRecord(value)) return [];
	const text = normalizeText(value.text);
	if (text) return [text];
	if (value.itemListElement !== undefined) return instructionTexts(value.itemListElement);
	if (value.item !== undefined) return instructionTexts(value.item);
	return [];
}

function cleanDescription(value: unknown): string | null {
	const description = normalizeText(value);
	if (!description) return null;
	const clean = description
		.replace(/\s*Über\s+\d[\d.,]*\s+Bewertungen[^.!?]*[.!?]?/gi, '')
		.replace(/\s*Mit\s+►[\s\S]*/i, '')
		.replace(/[^.!?]*►[^.!?]*[.!?]?/g, '')
		.trim();
	return clean || null;
}

function jsonLdBlocks(html: string): unknown[] {
	const blocks: unknown[] = [];
	const pattern = /<script\b[^>]*\btype\s*=\s*(["'])application\/ld\+json\1[^>]*>([\s\S]*?)<\/script\s*>/gi;
	for (const match of html.matchAll(pattern)) {
		try {
			blocks.push(JSON.parse(match[2]));
		} catch {
			// A malformed block must not prevent another valid JSON-LD block from importing.
		}
	}
	return blocks;
}

/** Parses untrusted recipe markup without allowing an unexpected field shape to throw. */
export function parseRecipeHtml(html: string): ImportedRecipe | null {
	let schema: JsonRecord | null = null;
	for (const block of jsonLdBlocks(html)) {
		schema = findRecipeInJsonLd(block);
		if (schema) break;
	}
	if (!schema) return null;

	const title = normalizeText(schema.name);
	if (!title) return null;
	const ingredients = ingredientTexts(schema.recipeIngredient).map(parseIngredient).filter((entry) => entry.name);
	const instructions = instructionTexts(schema.recipeInstructions);
	const prepTime = parseIso8601Duration(schema.prepTime);
	let cookTime = parseIso8601Duration(schema.cookTime);
	if (prepTime === null && cookTime === null) cookTime = parseIso8601Duration(schema.totalTime);

	return {
		title,
		description: cleanDescription(schema.description),
		imageUrl: extractImageUrl(schema.image),
		servings: extractPositiveInteger(schema.recipeYield) ?? 4,
		prepTime,
		cookTime,
		ingredients,
		steps: instructions.map((text, index) => ({ stepNumber: index + 1, text }))
	};
}
