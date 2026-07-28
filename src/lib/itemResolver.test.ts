import { describe, expect, it } from 'vitest';
import {
	CATEGORIES,
	DEFAULT_CATEGORY_ORDER,
	MANUAL_CATEGORIES,
	getCategoryByKey,
	getCategoryForItem,
	getCategoryKey,
	resolveItem
} from '$lib/categories';
import { normalizeItemName } from '$lib/itemResolver';
import { VISUAL_GROUP_ICONS, VISUAL_GROUPS, type VisualGroup } from '$lib/itemVisualGroups';

type GoldenCase = readonly [name: string, categoryKey: string, visualGroup?: VisualGroup];

const REQUIRED_CASES: GoldenCase[] = [
	['Salbeitee', 'getraenke', 'tea'],
	['Teewurst', 'fleisch'],
	['Tomatenmark', 'konserven', 'tube'],
	['Zahnpasta', 'koerperpflege', 'tube'],
	['Apfelsaft', 'getraenke'],
	['Saftapfel', 'obst', 'apple'],
	['Milchkaffee', 'getraenke', 'coffee'],
	['Kaffeemilch', 'milch', 'milk-container'],
	['Erdbeer-Joghurt', 'milch', 'dairy-cup'],
	['Apple Juice', 'getraenke'],
	['Toothpaste', 'koerperpflege', 'tube'],
	['Tomato Paste', 'konserven', 'tube'],
	['Strawberry Yogurt', 'milch', 'dairy-cup'],
	['DM Bio Kamillentee', 'getraenke', 'tea'],
	['Pfefferminz-Tee', 'getraenke', 'tea'],
	['Iced Tea Lemon', 'getraenke', 'tea'],
	['Cold Brew Coffee', 'getraenke', 'coffee'],
	['Bio-Eier', 'milch', 'egg'],
	['Mixed Nuts', 'snacks', 'nuts'],
	['Thunfisch', 'fleisch', 'fish'],
	['Thunfischdose', 'konserven'],
	['Fischsauce', 'gewuerze', 'oil-bottle'],
	['Apple Cider Vinegar', 'gewuerze', 'oil-bottle'],
	['Milchschokolade', 'snacks'],
	['Kokosmilch', 'getraenke', 'milk-container'],
	['Tiefkühlfisch', 'tiefkuehl'],
	['Marmelade', 'konserven', 'spread'],
	['Nussmus', 'konserven', 'spread'],
	['Nutella', 'snacks', 'spread'],
	['Badreiniger', 'haushalt', 'cleaner-spray'],
	['Toilettenpapier', 'haushalt', 'paper-goods'],
	['Shampoo', 'koerperpflege', 'liquid-care'],
	['Duschgel', 'koerperpflege', 'liquid-care'],
	['Apfel', 'obst', 'apple'],
	['Banane', 'obst', 'banana'],
	['Birne', 'obst', 'pear'],
	['Orange', 'obst', 'orange'],
	['Zitrone', 'obst', 'lemon'],
	['Erdbeere', 'obst', 'strawberry'],
	['Trauben', 'obst', 'grapes'],
	['Mango', 'obst'],
	['Karotte', 'obst', 'carrot'],
	['Tomate', 'obst', 'tomato'],
	['Paprika', 'obst', 'bell-pepper'],
	['Kartoffel', 'obst', 'potato'],
	['Süßkartoffel', 'obst', 'potato'],
	['Gurke', 'obst', 'cucumber'],
	['Zwiebel', 'obst', 'onion'],
	['Brokkoli', 'obst', 'broccoli'],
	['Pilz', 'obst', 'mushroom'],
	['Salat', 'obst'],
	['Salbei', 'obst'],
	['Fresh Sage', 'obst'],
	['Bier', 'getraenke', 'beer'],
	['Wein', 'getraenke', 'wine'],
	['Sekt', 'getraenke', 'sparkling-wine'],
	['Whisky', 'getraenke', 'spirits'],
	['Cocktail', 'getraenke', 'alcohol-neutral'],
	['Quark', 'milch', 'dairy-cup'],
	['Magerquark', 'milch', 'dairy-cup'],
	['Skyr Erdbeere', 'milch', 'dairy-cup'],
	['Yogurt Passion Fruit', 'milch', 'dairy-cup'],
	['Passion Fruit Yogurt', 'milch', 'dairy-cup'],
	['Greek Yoghurt', 'milch', 'dairy-cup'],
	['Crème fraîche', 'milch', 'dairy-cup'],
	['Cottage Cheese', 'milch', 'dairy-cup'],
	['Milch', 'milch', 'milk-container'],
	['Buttermilch', 'milch', 'milk-container'],
	['Heavy Cream', 'milch', 'milk-container'],
	['Hafermilch', 'getraenke', 'milk-container'],
	['Oat Milk', 'getraenke', 'milk-container'],
	['Ketchup', 'konserven', 'sauce-bottle'],
	['Salatdressing', 'konserven', 'sauce-bottle'],
	['BBQ Sauce', 'konserven', 'sauce-bottle'],
	['Hot Sauce', 'gewuerze', 'sauce-bottle'],
	['Sriracha', 'gewuerze', 'sauce-bottle'],
	['Olivenöl', 'gewuerze', 'oil-bottle'],
	['Balsamico Essig', 'gewuerze', 'oil-bottle'],
	['Soy Sauce', 'gewuerze', 'oil-bottle'],
	['Maple Syrup', 'gewuerze', 'oil-bottle'],
	['Chips Paprika', 'snacks', 'snack-bag'],
	['Salzstangen', 'snacks', 'snack-bag'],
	['Crisps', 'snacks', 'snack-bag'],
	['Pretzels', 'backwaren', 'snack-bag'],
	['Müsli', 'backwaren', 'cereal-bowl'],
	['Müsli Schokolade', 'backwaren', 'cereal-bowl'],
	['Chocolate Muesli', 'backwaren', 'cereal-bowl'],
	['Porridge', 'backwaren', 'cereal-bowl'],
	['Cornflakes', 'backwaren', 'cereal-bowl'],
	['Granola Bar', 'snacks'],
	['Spülmittel Zitrone', 'haushalt', 'detergent'],
	['Waschmittel Lavendel', 'haushalt', 'detergent'],
	['Dish Soap Lemon', 'haushalt', 'detergent'],
	['Laundry Detergent', 'haushalt', 'detergent'],
	['Tomato Sauce', 'konserven'],
	['Unbekannter Spezialartikel', 'default']
];

// Diese wenigen Begriffe waren bereits mehrfach in der alten Keyword-Liste
// vorhanden. Die neue fachliche Hauptwortlogik legt ihre beabsichtigte
// Bedeutung explizit fest, statt von der Array-Reihenfolge abzuhängen.
const LEGACY_EXPECTATION_OVERRIDES: Record<string, string> = {
	[normalizeItemName('cracker')]: 'snacks',
	[normalizeItemName('crackers')]: 'snacks',
	[normalizeItemName('buckwheat')]: 'backwaren',
	[normalizeItemName('buchweizen')]: 'nudeln',
	[normalizeItemName('datteln')]: 'snacks',
	[normalizeItemName('dates')]: 'obst',
	[normalizeItemName('coconut')]: 'obst',
	[normalizeItemName('kokosnuss')]: 'snacks',
	[normalizeItemName('pepper')]: 'gewuerze',
	[normalizeItemName('brause')]: 'getraenke',
	[normalizeItemName('vanillezucker')]: 'gewuerze',
	[normalizeItemName('pizza')]: 'tiefkuehl',
	[normalizeItemName('eierlikör')]: 'getraenke',
	[normalizeItemName('peanut butter')]: 'konserven'
};

function buildLegacyGoldenMatrix(): GoldenCase[] {
	const seen = new Set<string>();
	const matrix: GoldenCase[] = [];
	for (const category of CATEGORIES) {
		for (const keyword of category.keywords) {
			const normalized = normalizeItemName(keyword);
			if (!normalized || seen.has(normalized)) continue;
			seen.add(normalized);
			matrix.push([keyword, LEGACY_EXPECTATION_OVERRIDES[normalized] ?? category.key]);
		}
	}
	return matrix;
}

const LEGACY_GOLDEN_MATRIX = buildLegacyGoldenMatrix();

describe('item resolver', () => {
	it('normalizes Unicode, separators, apostrophes and German replacement spellings', () => {
		expect(normalizeItemName('  KRÄUTER–TEE  ')).toBe('kraeuter tee');
		expect(normalizeItemName('Kraeuter-Tee')).toBe('kraeuter tee');
		expect(normalizeItemName("Lay’s Chips")).toBe('lay s chips');
		expect(normalizeItemName('Crème fraîche')).toBe('creme fraiche');
	});

	it.each(REQUIRED_CASES.map(([name, categoryKey, visualGroup]) => ({ name, categoryKey, visualGroup })))
	('$name is resolved deterministically', ({ name, categoryKey, visualGroup }) => {
		const resolution = resolveItem(name);
		expect(resolution.categoryKey).toBe(categoryKey);
		expect(resolution.visualGroup).toBe(visualGroup);
	});

	it('keeps a bilingual legacy golden matrix with more than 300 unique names', () => {
		expect(LEGACY_GOLDEN_MATRIX.length).toBeGreaterThanOrEqual(300);
		const mismatches = LEGACY_GOLDEN_MATRIX.flatMap(([name, expected]) => {
			const actual = getCategoryKey(name);
			return actual === expected ? [] : [{ name, expected, actual }];
		});
		expect(mismatches).toEqual([]);
	});

	it('lets product meaning beat a weak brand hint', () => {
		expect(resolveItem('Haribo Salbeitee')).toMatchObject({ categoryKey: 'getraenke', visualGroup: 'tea' });
		expect(resolveItem('Alpro Teewurst')).toMatchObject({ categoryKey: 'fleisch' });
		expect(resolveItem('Haribo Goldbären')).toMatchObject({ categoryKey: 'snacks' });
		expect(resolveItem('Katjes Mystery')).toMatchObject({ categoryKey: 'snacks', source: 'brand' });
	});

	it('preserves valid manual overrides without losing a confident packaging icon', () => {
		expect(resolveItem('Tomatenmark', 'koerperpflege')).toMatchObject({
			categoryKey: 'koerperpflege',
			visualGroup: 'tube',
			source: 'override'
		});
		expect(getCategoryKey('Apfel', 'not-a-category')).toBe('obst');
	});

	it('allows an explicit Everything else override without turning visual groups into categories', () => {
		expect(MANUAL_CATEGORIES.map(category => category.key)).toEqual([...CATEGORIES.map(category => category.key), 'default']);
		expect(new Set(DEFAULT_CATEGORY_ORDER)).toEqual(new Set(MANUAL_CATEGORIES.map(category => category.key)));
		expect(VISUAL_GROUPS.some(group => DEFAULT_CATEGORY_ORDER.includes(group))).toBe(false);
		expect(resolveItem('Tomatenmark', 'default')).toMatchObject({
			categoryKey: 'default',
			visualGroup: 'tube',
			source: 'override'
		});
		expect(getCategoryKey('Magentabletten', 'default')).toBe('default');
	});
});

describe('subgroup icons', () => {
	it('contains exactly the 37 approved visual groups', () => {
		expect(VISUAL_GROUPS).toHaveLength(37);
		expect(Object.keys(VISUAL_GROUP_ICONS).sort()).toEqual([...VISUAL_GROUPS].sort());
	});

	it.each([
		['Apfel', 'apple'],
		['Banane', 'banana'],
		['Birne', 'pear'],
		['Orange', 'orange'],
		['Zitrone', 'lemon'],
		['Erdbeere', 'strawberry'],
		['Trauben', 'grapes'],
		['Karotte', 'carrot'],
		['Tomate', 'tomato'],
		['Paprika', 'bell-pepper'],
		['Kartoffel', 'potato'],
		['Gurke', 'cucumber'],
		['Zwiebel', 'onion'],
		['Brokkoli', 'broccoli'],
		['Pilz', 'mushroom'],
		['Lachs', 'fish'],
		['Tee', 'tea'],
		['Espresso', 'coffee'],
		['Wein', 'wine'],
		['Bier', 'beer'],
		['Sekt', 'sparkling-wine'],
		['Whisky', 'spirits'],
		['Cocktail', 'alcohol-neutral'],
		['Ei', 'egg'],
		['Mandeln', 'nuts'],
		['Zahnpasta', 'tube'],
		['Pesto', 'spread'],
		['Badreiniger', 'cleaner-spray'],
		['Küchenrolle', 'paper-goods'],
		['Flüssigseife', 'liquid-care'],
		['Skyr', 'dairy-cup'],
		['Milch', 'milk-container'],
		['Ketchup', 'sauce-bottle'],
		['Olivenöl', 'oil-bottle'],
		['Chips', 'snack-bag'],
		['Müsli', 'cereal-bowl'],
		['Waschmittel', 'detergent']
	] satisfies Array<readonly [string, VisualGroup]>)('uses the approved %s icon', (name, visualGroup) => {
		expect(getCategoryForItem(name).svgContent).toBe(VISUAL_GROUP_ICONS[visualGroup]);
	});

	it('uses the resulting category colour for subgroup and packaging icons', () => {
		expect(getCategoryForItem('Tomatenmark').color).toBe(getCategoryByKey('konserven').color);
		expect(getCategoryForItem('Zahnpasta').color).toBe(getCategoryByKey('koerperpflege').color);
		expect(getCategoryForItem('Tomatenmark', 'koerperpflege').color).toBe(getCategoryByKey('koerperpflege').color);
		expect(getCategoryForItem('Milch').color).toBe(getCategoryByKey('milch').color);
		expect(getCategoryForItem('Hafermilch').color).toBe(getCategoryByKey('getraenke').color);
		expect(getCategoryForItem('Ketchup').color).toBe(getCategoryByKey('konserven').color);
		expect(getCategoryForItem('Soy Sauce').color).toBe(getCategoryByKey('gewuerze').color);
	});

	it('prefers packaging and falls back to the established category icon', () => {
		expect(resolveItem('Thunfischdose')).toMatchObject({ categoryKey: 'konserven' });
		expect(resolveItem('Thunfischdose').visualGroup).toBeUndefined();
		expect(getCategoryForItem('Thunfischdose').svgContent).toBe(getCategoryByKey('konserven').svgContent);
		expect(getCategoryForItem('Mango').svgContent).toBe(getCategoryByKey('obst').svgContent);
		expect(getCategoryForItem('Salat').svgContent).toBe(getCategoryByKey('obst').svgContent);
		expect(getCategoryForItem('Salbei').svgContent).toBe(getCategoryByKey('obst').svgContent);
		expect(getCategoryForItem('Unbekannter Spezialartikel')).toEqual(getCategoryByKey('default'));
	});

	it('never uses another produce item as a generic group symbol', () => {
		expect(getCategoryForItem('Banane').svgContent).not.toBe(getCategoryForItem('Apfel').svgContent);
		expect(getCategoryForItem('Paprika').svgContent).not.toBe(getCategoryForItem('Karotte').svgContent);
		expect(getCategoryForItem('Mango').svgContent).toBe(getCategoryByKey('obst').svgContent);
	});
});
