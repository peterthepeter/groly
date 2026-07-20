import { describe, expect, it } from 'vitest';
import {
	CATEGORIES,
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
	['Saftapfel', 'obst', 'fruit'],
	['Milchkaffee', 'getraenke', 'coffee'],
	['Kaffeemilch', 'milch'],
	['Erdbeer-Joghurt', 'milch'],
	['Apple Juice', 'getraenke'],
	['Toothpaste', 'koerperpflege', 'tube'],
	['Tomato Paste', 'konserven', 'tube'],
	['Strawberry Yogurt', 'milch'],
	['DM Bio Kamillentee', 'getraenke', 'tea'],
	['Pfefferminz-Tee', 'getraenke', 'tea'],
	['Iced Tea Lemon', 'getraenke', 'tea'],
	['Cold Brew Coffee', 'getraenke', 'coffee'],
	['Bio-Eier', 'milch', 'egg'],
	['Mixed Nuts', 'snacks', 'nuts'],
	['Thunfisch', 'fleisch', 'fish'],
	['Thunfischdose', 'konserven'],
	['Fischsauce', 'gewuerze'],
	['Apple Cider Vinegar', 'gewuerze'],
	['Milchschokolade', 'snacks'],
	['Kokosmilch', 'getraenke'],
	['Tiefkühlfisch', 'tiefkuehl'],
	['Marmelade', 'konserven', 'spread'],
	['Nussmus', 'konserven', 'spread'],
	['Nutella', 'snacks', 'spread'],
	['Badreiniger', 'haushalt', 'cleaner-spray'],
	['Toilettenpapier', 'haushalt', 'paper-goods'],
	['Shampoo', 'koerperpflege', 'liquid-care'],
	['Duschgel', 'koerperpflege', 'liquid-care'],
	['Apfel', 'obst', 'fruit'],
	['Birne', 'obst', 'fruit'],
	['Banane', 'obst', 'fruit'],
	['Tomate', 'obst', 'vegetable'],
	['Karotte', 'obst', 'vegetable'],
	['Brokkoli', 'obst', 'vegetable'],
	['Salbei', 'obst'],
	['Fresh Sage', 'obst'],
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
});

describe('subgroup icons', () => {
	it('contains exactly the 13 approved visual groups', () => {
		expect(VISUAL_GROUPS).toHaveLength(13);
		expect(Object.keys(VISUAL_GROUP_ICONS).sort()).toEqual([...VISUAL_GROUPS].sort());
	});

	it.each([
		['Apfel', 'fruit'],
		['Karotte', 'vegetable'],
		['Lachs', 'fish'],
		['Tee', 'tea'],
		['Espresso', 'coffee'],
		['Wein', 'alcohol'],
		['Ei', 'egg'],
		['Mandeln', 'nuts'],
		['Zahnpasta', 'tube'],
		['Pesto', 'spread'],
		['Badreiniger', 'cleaner-spray'],
		['Küchenrolle', 'paper-goods'],
		['Flüssigseife', 'liquid-care']
	] satisfies Array<readonly [string, VisualGroup]>)('uses the approved %s icon', (name, visualGroup) => {
		expect(getCategoryForItem(name).svgContent).toBe(VISUAL_GROUP_ICONS[visualGroup]);
	});

	it('uses the resulting category colour for subgroup and packaging icons', () => {
		expect(getCategoryForItem('Tomatenmark').color).toBe(getCategoryByKey('konserven').color);
		expect(getCategoryForItem('Zahnpasta').color).toBe(getCategoryByKey('koerperpflege').color);
		expect(getCategoryForItem('Tomatenmark', 'koerperpflege').color).toBe(getCategoryByKey('koerperpflege').color);
	});

	it('prefers packaging and falls back to the established category icon', () => {
		expect(resolveItem('Thunfischdose')).toMatchObject({ categoryKey: 'konserven' });
		expect(resolveItem('Thunfischdose').visualGroup).toBeUndefined();
		expect(getCategoryForItem('Thunfischdose').svgContent).toBe(getCategoryByKey('konserven').svgContent);
		expect(getCategoryForItem('Salbei').svgContent).toBe(getCategoryByKey('obst').svgContent);
		expect(getCategoryForItem('Unbekannter Spezialartikel')).toEqual(getCategoryByKey('default'));
	});
});
