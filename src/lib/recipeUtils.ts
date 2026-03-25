export type Ingredient = { id: string; amount: string | null; unit: string | null; name: string; sortOrder: number };
export type Step = { id: string; stepNumber: number; text: string };
export type Recipe = {
	id: string;
	title: string;
	description: string | null;
	imageUrl: string | null;
	sourceUrl: string | null;
	servings: number;
	prepTime: number | null;
	cookTime: number | null;
	ingredients: Ingredient[];
	steps: Step[];
};

export function scaleAmount(raw: string | null, currentServings: number, originalServings: number): string | null {
	if (!raw) return null;
	const num = parseFloat(raw.replace(',', '.'));
	if (isNaN(num)) return raw;
	const scaled = (num * currentServings) / originalServings;
	return parseFloat(scaled.toFixed(2)).toString().replace('.', ',');
}
