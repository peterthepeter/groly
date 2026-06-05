// Client-side parser that turns free-text ingredient lines into structured rows.
// Bilingual (de + en) — recognises the common unit tokens of both languages.
// It only guesses: every result stays fully editable in the recipe editor, so a
// wrong split costs the user two seconds, never data.

export type ParsedIngredient = { amount: string; unit: string; name: string };

// Normalised (lowercase, no trailing dot) unit tokens. Singular + plural forms are
// listed explicitly to avoid fragile stemming.
const UNITS = new Set<string>([
	// metric weight / volume (shared)
	'g', 'gr', 'gramm', 'gram', 'grams', 'kg', 'mg', 'dag', 'dkg',
	'ml', 'cl', 'dl', 'l', 'liter', 'litre', 'litres', 'liters',
	// German
	'el', 'tl', 'msp', 'prise', 'prisen', 'stück', 'stk', 'st',
	'bund', 'dose', 'dosen', 'packung', 'packungen', 'pck', 'pkg', 'paket', 'päckchen',
	'becher', 'glas', 'gläser', 'tasse', 'tassen', 'scheibe', 'scheiben',
	'zehe', 'zehen', 'knolle', 'kopf', 'blatt', 'blätter', 'tropfen', 'schuss',
	'handvoll', 'würfel', 'kugel', 'kugeln', 'zweig', 'zweige', 'stange', 'stangen',
	'portion', 'portionen', 'flasche', 'flaschen', 'beutel', 'tube', 'tuben', 'spritzer',
	// English
	'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
	'cup', 'cups', 'tbsp', 'tbs', 'tablespoon', 'tablespoons',
	'tsp', 'teaspoon', 'teaspoons', 'pinch', 'pinches', 'clove', 'cloves',
	'can', 'cans', 'pack', 'packs', 'slice', 'slices', 'bunch', 'bunches',
	'stick', 'sticks', 'dash', 'dashes', 'drop', 'drops', 'handful', 'handfuls',
	'sprig', 'sprigs', 'quart', 'quarts', 'pint', 'pints', 'gallon', 'gallons',
	'piece', 'pieces'
]);

// Matches a leading quantity: mixed fraction (1 1/2), fraction (1/2), decimal with
// optional range (2-3, 1,5), or a single unicode fraction (½).
const AMOUNT_RE =
	/^(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?(?:\s*[-–]\s*\d+(?:[.,]\d+)?)?|[½¼¾⅓⅔⅛⅜⅝⅞⅕⅖⅗⅘])/;

// Leading list markers / bullets to strip before parsing.
const BULLET_RE = /^[-–—•*·▪◦‣]\s*/;

export function parseIngredientLine(raw: string): ParsedIngredient | null {
	let line = raw.trim();
	if (!line) return null;
	line = line.replace(BULLET_RE, '').trim();
	if (!line) return null;

	let amount = '';
	let unit = '';

	const m = AMOUNT_RE.exec(line);
	if (m) {
		amount = m[0].replace(/\s*[-–]\s*/, '-').trim();
		line = line.slice(m[0].length).trim();

		// Unit = first word token right after the amount, if it's a known unit.
		const tok = /^([\p{L}.]+)/u.exec(line);
		if (tok) {
			const norm = tok[1].toLowerCase().replace(/\.+$/, '');
			if (UNITS.has(norm)) {
				unit = tok[1].replace(/\.+$/, '');
				line = line.slice(tok[1].length).trim();
			}
		}
	}

	const name = line.trim();
	if (!name && !amount && !unit) return null;
	return { amount, unit, name };
}

export function parseIngredientText(text: string): ParsedIngredient[] {
	return text
		.split(/\r?\n/)
		.map(parseIngredientLine)
		.filter((x): x is ParsedIngredient => x !== null && (x.name !== '' || x.amount !== ''));
}
