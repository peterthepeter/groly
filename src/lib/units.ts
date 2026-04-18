// Canonical unit strings stored in DB (German)
export const SUPPLEMENT_UNITS = ['Stück', 'g', 'ml', 'Tablette', 'Kapsel'];

const DE_TO_EN: Record<string, string> = {
	'Kapsel': 'Capsule',
	'Tablette': 'Tablet',
	'Stück': 'Piece',
	'Portion': 'Serving',
};

export function displayUnit(unit: string, lang: string): string {
	if (lang === 'en') return DE_TO_EN[unit] ?? unit;
	return unit;
}

const DE_SHORT: Record<string, string> = {
	'Kapsel': 'Kps.',
	'Tablette': 'Tbl.',
	'Stück': 'Stk.',
	'Portion': 'Port.',
	'g': 'g',
	'ml': 'ml',
};

const EN_SHORT: Record<string, string> = {
	'Kapsel': 'Cap.',
	'Tablette': 'Tab.',
	'Stück': 'pc.',
	'Portion': 'srv.',
	'g': 'g',
	'ml': 'ml',
};

export function shortUnit(unit: string, lang: string): string {
	const map = lang === 'en' ? EN_SHORT : DE_SHORT;
	return map[unit] ?? unit;
}
