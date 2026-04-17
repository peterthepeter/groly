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
