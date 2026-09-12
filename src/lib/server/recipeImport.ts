import { parsePublicRecipeUrl } from './recipeImportSecurity';

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

type JsonLdIndex = Map<string, JsonRecord>;

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
	const isRecipe = (entry: unknown) => typeof entry === 'string'
		&& entry.toLowerCase().split(/[\/#]/).pop() === 'recipe';
	return Array.isArray(value) ? value.some(isRecipe) : isRecipe(value);
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

function normalizeWebUrl(value: unknown, baseUrl?: string): string | null {
	if (typeof value !== 'string') return null;
	try {
		const url = baseUrl ? new URL(value, baseUrl) : new URL(value);
		return parsePublicRecipeUrl(url.href)?.href ?? null;
	} catch {
		return null;
	}
}

function imageNodeScore(record: JsonRecord): number {
	let score = Object.keys(record).length;
	if (record.url !== undefined) score += 10;
	if (record.contentUrl !== undefined) score += 10;
	if (record.thumbnailUrl !== undefined) score += 5;
	return score;
}

function referenceKeys(value: unknown, baseUrl?: string): string[] {
	const raw = normalizeText(value);
	if (!raw) return [];
	const absolute = normalizeWebUrl(raw, baseUrl);
	return absolute && absolute !== raw ? [raw, absolute] : [raw];
}

function buildJsonLdIndex(blocks: unknown[], baseUrl?: string): JsonLdIndex {
	const index: JsonLdIndex = new Map();
	const visit = (value: unknown, depth = 0) => {
		if (depth > 20 || value === null || typeof value !== 'object') return;
		if (Array.isArray(value)) {
			for (const entry of value) visit(entry, depth + 1);
			return;
		}
		const record = value as JsonRecord;
		for (const id of referenceKeys(record['@id'], baseUrl)) {
			const existing = index.get(id);
			if (!existing || imageNodeScore(record) > imageNodeScore(existing)) index.set(id, record);
		}
		for (const nested of Object.values(record)) visit(nested, depth + 1);
	};
	for (const block of blocks) visit(block);
	return index;
}

function bestIndexedReference(index: JsonLdIndex, keys: string[]): JsonRecord | undefined {
	return keys
		.map((key) => index.get(key))
		.filter((record): record is JsonRecord => Boolean(record))
		.sort((left, right) => imageNodeScore(right) - imageNodeScore(left))[0];
}

function extractImageUrl(
	value: unknown,
	index: JsonLdIndex,
	baseUrl?: string,
	seenReferences = new Set<string>()
): string | null {
	if (Array.isArray(value)) {
		for (const entry of value) {
			const found = extractImageUrl(entry, index, baseUrl, seenReferences);
			if (found) return found;
		}
		return null;
	}
	if (typeof value === 'string') {
		const referenced = bestIndexedReference(index, referenceKeys(value, baseUrl));
		if (referenced && !seenReferences.has(value)) {
			seenReferences.add(value);
			const found = extractImageUrl(referenced, index, baseUrl, seenReferences);
			if (found) return found;
		}
		if (referenced && value.includes('#')) return null;
		return normalizeWebUrl(value, baseUrl);
	}
	if (isRecord(value)) {
		const direct = extractImageUrl(value.url, index, baseUrl, seenReferences)
			?? extractImageUrl(value.contentUrl, index, baseUrl, seenReferences)
			?? extractImageUrl(value.thumbnailUrl, index, baseUrl, seenReferences);
		if (direct) return direct;

		const reference = referenceKeys(value['@id'], baseUrl)[0];
		if (reference && !seenReferences.has(reference)) {
			seenReferences.add(reference);
			const referenced = bestIndexedReference(index, referenceKeys(value['@id'], baseUrl));
			if (referenced) return extractImageUrl(referenced, index, baseUrl, seenReferences);
		}
	}
	return null;
}

function htmlAttribute(tag: string, name: string): string | null {
	const pattern = new RegExp(`\\b${name}\\s*=\\s*(["'])([\\s\\S]*?)\\1`, 'i');
	return pattern.exec(tag)?.[2] ?? null;
}

function extractMetadataImage(html: string, baseUrl?: string): string | null {
	for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
		const tag = match[0];
		const key = (htmlAttribute(tag, 'property') ?? htmlAttribute(tag, 'name'))?.toLowerCase();
		if (!['og:image', 'og:image:url', 'twitter:image', 'twitter:image:src'].includes(key ?? '')) continue;
		const content = htmlAttribute(tag, 'content')?.replace(/&amp;/gi, '&');
		const imageUrl = normalizeWebUrl(content, baseUrl);
		if (imageUrl) return imageUrl;
	}
	for (const match of html.matchAll(/<link\b[^>]*>/gi)) {
		const tag = match[0];
		if (htmlAttribute(tag, 'rel')?.toLowerCase() !== 'image_src') continue;
		const imageUrl = normalizeWebUrl(htmlAttribute(tag, 'href')?.replace(/&amp;/gi, '&'), baseUrl);
		if (imageUrl) return imageUrl;
	}
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
	const vulgarFraction = String.raw`[¼½¾⅓⅔⅛⅜⅝⅞]`;
	const number = String.raw`(?:\d+(?:[.,]\d+)?(?:\s+\d+\s*\/\s*\d+|\s*${vulgarFraction})?|\d+\s*\/\s*\d+|${vulgarFraction})`;
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
		return value.replace(/<br\s*\/?\s*>/gi, '\n').split(/\n+/).map(normalizeText).filter((entry): entry is string => Boolean(entry));
	}
	if (Array.isArray(value)) return value.flatMap(instructionTexts);
	if (!isRecord(value)) return [];
	if (value.itemListElement !== undefined) {
		const nested = instructionTexts(value.itemListElement);
		if (nested.length) return nested;
	}
	if (value.item !== undefined) {
		const nested = instructionTexts(value.item);
		if (nested.length) return nested;
	}
	const text = normalizeText(value.text) ?? normalizeText(value.name);
	if (text) return [text];
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
	const pattern = /<script\b[^>]*\btype\s*=\s*(?:(["'])application\/ld\+json(?:\s*;[^"']*)?\1|application\/ld\+json)[^>]*>([\s\S]*?)<\/script\s*>/gi;
	for (const match of html.matchAll(pattern)) {
		try {
			blocks.push(JSON.parse(match[2].replace(/^\s*<!--|-->\s*$/g, '').trim()));
		} catch {
			// A malformed block must not prevent another valid JSON-LD block from importing.
		}
	}
	return blocks;
}

/** Parses untrusted recipe markup without allowing an unexpected field shape to throw. */
export function parseRecipeHtml(html: string, baseUrl?: string): ImportedRecipe | null {
	const blocks = jsonLdBlocks(html);
	let schema: JsonRecord | null = null;
	for (const block of blocks) {
		schema = findRecipeInJsonLd(block);
		if (schema) break;
	}
	if (!schema) return null;
	const jsonLdIndex = buildJsonLdIndex(blocks, baseUrl);

	const title = normalizeText(schema.name);
	if (!title) return null;
	const ingredients = ingredientTexts(schema.recipeIngredient).map(parseIngredient).filter((entry) => entry.name);
	const instructions = instructionTexts(schema.recipeInstructions);
	let prepTime = parseIso8601Duration(schema.prepTime);
	let cookTime = parseIso8601Duration(schema.cookTime);
	const totalTime = parseIso8601Duration(schema.totalTime);
	if (totalTime !== null) {
		if (prepTime === null && cookTime === null) cookTime = totalTime;
		else if (cookTime === null && prepTime !== null && totalTime > prepTime) cookTime = totalTime - prepTime;
		else if (prepTime === null && cookTime !== null && totalTime > cookTime) prepTime = totalTime - cookTime;
	}

	return {
		title,
		description: cleanDescription(schema.description),
		imageUrl: extractImageUrl(schema.image, jsonLdIndex, baseUrl)
			?? extractImageUrl(schema.thumbnailUrl, jsonLdIndex, baseUrl)
			?? extractMetadataImage(html, baseUrl),
		servings: extractPositiveInteger(schema.recipeYield) ?? 4,
		prepTime,
		cookTime,
		ingredients,
		steps: instructions.map((text, index) => ({ stepNumber: index + 1, text }))
	};
}
