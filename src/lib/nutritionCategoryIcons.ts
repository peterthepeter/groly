// Kategorie-Icons für generische Lebensmittel (genericFoods.category).
// 5 Pfade sind 1:1 aus den Einkaufslisten-Kategorien übernommen (siehe categories.ts),
// 8 neu im selben Lucide-Stil ergänzt. Gerendert wird wie die Listen-Icons:
// viewBox 0 0 24 24, fill="none", stroke=<color>, stroke-width≈1.3, runde Enden.

export type NutritionCategory =
	| 'bread' | 'dairy' | 'drink' | 'fat' | 'fish' | 'fruit' | 'grain'
	| 'meat' | 'nuts' | 'protein' | 'sauce' | 'sweet' | 'vegetable';

export interface NutritionCategoryIcon {
	color: string;
	svgContent: string;
}

export const NUTRITION_CATEGORY_ICONS: Record<NutritionCategory, NutritionCategoryIcon> = {
	// --- aus den Einkaufslisten übernommen ---
	bread: {
		color: '#D97706',
		svgContent: `<g transform="translate(12,12) scale(1.1) translate(-12,-12)"><path d="M3 11a5 5 0 0 1 10 0v9H3v-9z"/><path d="M13 11a5 5 0 0 1 8 0v9h-8v-9z"/></g>`
	},
	dairy: {
		color: '#60A5FA',
		svgContent: `<path d="M3 20l9-16 9 16H3z"/><circle cx="10" cy="15" r="1"/><circle cx="15" cy="13" r="1"/>`
	},
	drink: {
		color: '#06B6D4',
		svgContent: `<path d="M5 3h14l-2 18H7L5 3z"/><path d="M5 8h14"/>`
	},
	fruit: {
		color: 'var(--color-primary)',
		svgContent: `<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>`
	},
	meat: {
		color: '#EF4444',
		svgContent: `<g transform="translate(12,12) scale(1.32) translate(-12,-12)"><path d="M5 10c.5-4 3.5-6.5 7-6.5S19 6 19.5 10c.5 4-2.5 10-7.5 10S4.5 14 5 10z"/><path d="M10 10.5c1-2 4-2.5 5-1"/><path d="M9.5 13.5c1.5-.5 4 0 5 1"/></g>`
	},

	// --- neu (Lucide-Stil) ---
	vegetable: {
		color: '#F97316',
		svgContent: `<path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7Z"/><path d="m8.64 14-2.05-2.04"/><path d="m15.34 15-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9Z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.86 2-3.5C17 3.33 15 2 15 2Z"/>`
	},
	fish: {
		color: '#0EA5E9',
		svgContent: `<path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6s-7.56-2.53-8.5-6Z"/><path d="M18 12v.5"/><path d="M16 17.93a9.77 9.77 0 0 1 0-11.86"/><path d="M7 10.67C7 8 5.58 5.97 2.73 5.5c-1 1.5-1 5 .23 6.5-1.24 1.5-1.24 5-.23 6.5C5.58 18.03 7 16 7 13.33"/><path d="M10.46 7.26C10.2 5.88 9.17 4.24 8 3h5.8a2 2 0 0 1 1.98 1.67l.23 1.4"/><path d="M16.01 17.93l.23 1.4A2 2 0 0 1 14.26 21H8c1.17-1.24 2.2-2.88 2.46-4.26"/>`
	},
	grain: {
		color: '#CA8A04',
		svgContent: `<path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/>`
	},
	fat: {
		color: '#EAB308',
		svgContent: `<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>`
	},
	nuts: {
		color: '#B45309',
		svgContent: `<path d="M12 3.5c-2.6 0-4 1.9-4 3.5 0 1.05.5 1.8 1 2.4-.85.8-1.6 2-1.6 3.6 0 2.5 2 4.5 4.6 4.5s4.6-2 4.6-4.5c0-1.6-.75-2.8-1.6-3.6.5-.6 1-1.35 1-2.4 0-1.6-1.4-3.5-4-3.5Z"/><path d="M9.2 7.2h5.6"/><path d="M8.7 12.2h6.6"/><path d="M9.3 14.9h5.4"/>`
	},
	protein: {
		color: '#8B5CF6',
		svgContent: `<path d="M12 22c6.23-.05 7.87-5.57 7.5-10-.36-4.34-3.95-9.96-7.5-10-3.55.04-7.14 5.66-7.5 10-.37 4.43 1.27 9.95 7.5 10z"/>`
	},
	sauce: {
		color: '#E11D48',
		svgContent: `<path d="M10 2h4v3l1 2v13a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2V7l1-2V2Z"/><path d="M9 11h6"/>`
	},
	sweet: {
		color: '#EC4899',
		svgContent: `<circle cx="11" cy="9" r="6"/><path d="m11 15-5 5"/><path d="M11 9c0-1.7 1.3-3 3-3"/>`
	}
};

// Sicherer Zugriff inkl. Fallback (Obst-Blatt in Primärfarbe), falls eine
// unbekannte Kategorie reinkommt.
export function getNutritionCategoryIcon(category: string | null | undefined): NutritionCategoryIcon {
	if (category && category in NUTRITION_CATEGORY_ICONS) {
		return NUTRITION_CATEGORY_ICONS[category as NutritionCategory];
	}
	return NUTRITION_CATEGORY_ICONS.fruit;
}
