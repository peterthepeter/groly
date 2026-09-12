import { describe, expect, it } from 'vitest';
import { findRecipeInJsonLd, parseIngredient, parseRecipeHtml } from './recipeImport';

function recipeHtml(recipe: Record<string, unknown>): string {
	return `<html><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>`;
}

describe('recipe import normalization', () => {
	it('handles current Chefkoch graph references, yield arrays, and instruction sections', () => {
		const result = parseRecipeHtml(recipeHtml({
			'@context': 'https://schema.org',
			'@graph': [
				{
					'@type': 'Recipe',
					name: 'Schnelle Bolognese Sauce',
					image: { '@id': 'https://www.chefkoch.de/recipe#primaryimage' },
					recipeYield: ['2', '2 Portionen'],
					recipeIngredient: ['1 EL Olivenöl', '1 Zwiebel(n)'],
					recipeInstructions: [{
						'@type': 'HowToSection',
						itemListElement: [{ '@type': 'HowToStep', text: 'Alles anbraten.' }]
					}]
				},
				{
					'@type': 'ImageObject',
					'@id': 'https://www.chefkoch.de/recipe#primaryimage',
					url: 'https://img.chefkoch-cdn.de/bolognese.jpg',
					contentUrl: 'https://img.chefkoch-cdn.de/bolognese.jpg'
				}
			]
		}), 'https://www.chefkoch.de/recipe');

		expect(result?.servings).toBe(2);
		expect(result?.imageUrl).toBe('https://img.chefkoch-cdn.de/bolognese.jpg');
		expect(result?.steps).toEqual([{ stepNumber: 1, text: 'Alles anbraten.' }]);
		expect(result?.ingredients).toEqual([
			{ amount: '1', unit: 'EL', name: 'Olivenöl' },
			{ amount: '1', unit: null, name: 'Zwiebel' }
		]);
	});

	it('supports the live image and yield shapes used by the other example sites', () => {
		const cases = [
			{
				name: 'BBC Good Food',
				image: [{ '@type': 'ImageObject', url: 'https://images.immediate.co.uk/pancakes.jpg' }],
				recipeYield: 'Makes 12',
				expectedImage: 'https://images.immediate.co.uk/pancakes.jpg',
				expectedServings: 12
			},
			{
				name: 'Kitchen Stories',
				image: ['https://www.kitchenstories.com/uploads/recipe.jpg', 'https://www.kitchenstories.com/uploads/recipe-small.jpg'],
				recipeYield: ['6', '6 Portionen'],
				expectedImage: 'https://www.kitchenstories.com/uploads/recipe.jpg',
				expectedServings: 6
			},
			{
				name: 'Lecker',
				image: [{ '@type': 'ImageObject', url: 'https://images.lecker.de/lasagne.jpeg', width: 1600 }],
				recipeYield: '4 Personen',
				expectedImage: 'https://images.lecker.de/lasagne.jpeg',
				expectedServings: 4
			}
		];

		for (const testCase of cases) {
			const result = parseRecipeHtml(recipeHtml({
				'@type': 'Recipe',
				name: testCase.name,
				image: testCase.image,
				recipeYield: testCase.recipeYield
			}));
			expect(result?.imageUrl, testCase.name).toBe(testCase.expectedImage);
			expect(result?.servings, testCase.name).toBe(testCase.expectedServings);
		}
	});

	it('resolves relative image URLs and falls back to social metadata', () => {
		const relative = parseRecipeHtml(recipeHtml({
			'@type': 'Recipe',
			name: 'Relative image',
			image: '/media/recipe.jpg'
		}), 'https://recipes.example.com/path/recipe');
		expect(relative?.imageUrl).toBe('https://recipes.example.com/media/recipe.jpg');

		const metadata = `${recipeHtml({ '@type': 'Recipe', name: 'Metadata image' })}
			<meta content="/media/fallback.jpg?size=large&amp;crop=1" property="og:image">`;
		expect(parseRecipeHtml(metadata, 'https://recipes.example.com/path/recipe')?.imageUrl)
			.toBe('https://recipes.example.com/media/fallback.jpg?size=large&crop=1');

		const relativeReference = parseRecipeHtml(recipeHtml({
			'@graph': [
				{ '@type': 'Recipe', name: 'Relative reference', image: { '@id': '#photo' } },
				{ '@type': 'ImageObject', '@id': 'https://recipes.example.com/path/recipe#photo', contentUrl: '/media/photo.jpg' }
			]
		}), 'https://recipes.example.com/path/recipe');
		expect(relativeReference?.imageUrl).toBe('https://recipes.example.com/media/photo.jpg');
	});

	it('does not import unsafe image schemes or local metadata URLs', () => {
		const unsafe = `${recipeHtml({ '@type': 'Recipe', name: 'Unsafe image', image: 'data:image/png;base64,abc' })}
			<meta property="og:image" content="http://127.0.0.1/private.jpg">`;
		expect(parseRecipeHtml(unsafe, 'https://recipes.example.com/recipe')?.imageUrl).toBeNull();
	});

	it('accepts unquoted or parameterized JSON-LD script types', () => {
		const unquoted = '<script type=application/ld+json>{"@type":"Recipe","name":"Unquoted"}</script>';
		const parameterized = '<script type="application/ld+json; charset=utf-8">{"@type":"Recipe","name":"Parameterized"}</script>';
		expect(parseRecipeHtml(unquoted)?.title).toBe('Unquoted');
		expect(parseRecipeHtml(parameterized)?.title).toBe('Parameterized');
	});

	it('accepts Recipe in @type arrays and nested mainEntity nodes', () => {
		const node = { mainEntity: { '@type': ['HowTo', 'Recipe'], name: 'Soup' } };
		expect(findRecipeInJsonLd(node)?.name).toBe('Soup');
		expect(findRecipeInJsonLd({ '@type': 'https://schema.org/Recipe', name: 'Stew' })?.name).toBe('Stew');
	});

	it('normalizes structured yields, ingredients, images, sections, and total time', () => {
		const result = parseRecipeHtml(recipeHtml({
			'@type': ['Recipe', 'CreativeWork'],
			name: 'Test soup',
			description: '<b>Warm</b> &amp; quick',
			image: [{ contentUrl: 'https://example.com/soup.jpg' }],
			recipeYield: { '@type': 'QuantitativeValue', value: 6 },
			totalTime: 'PT1H30M',
			recipeIngredient: {
				'@type': 'ItemList',
				itemListElement: [
					{ '@type': 'PropertyValue', value: 2, unitText: 'cups', name: 'stock' },
					{ text: '½ TL Salz' }
				]
			},
			recipeInstructions: [{
				'@type': 'HowToSection',
				name: 'Cook',
				itemListElement: [{ '@type': 'HowToStep', text: 'Stir.' }, { text: 'Serve.' }]
			}]
		}));

		expect(result).toMatchObject({
			title: 'Test soup',
			description: 'Warm & quick',
			imageUrl: 'https://example.com/soup.jpg',
			servings: 6,
			prepTime: null,
			cookTime: 90,
			ingredients: [
				{ amount: '2', unit: 'cups', name: 'stock' },
				{ amount: '½', unit: 'TL', name: 'Salz' }
			],
			steps: [{ stepNumber: 1, text: 'Stir.' }, { stepNumber: 2, text: 'Serve.' }]
		});
	});

	it('skips malformed JSON-LD blocks and continues with valid ones', () => {
		const html = `<script type="application/ld+json">{bad}</script>${recipeHtml({ '@type': 'Recipe', name: 'Valid' })}`;
		expect(parseRecipeHtml(html)?.title).toBe('Valid');
	});

	it('returns null for pages without a usable Recipe node', () => {
		expect(parseRecipeHtml(recipeHtml({ '@type': 'Article', name: 'Not a recipe' }))).toBeNull();
		expect(parseRecipeHtml(recipeHtml({ '@type': 'Recipe' }))).toBeNull();
	});

	it('parses unicode fractions, ranges, and decimal amounts', () => {
		expect(parseIngredient('½ TL Salz')).toEqual({ amount: '½', unit: 'TL', name: 'Salz' });
		expect(parseIngredient('83⅓ g Quark')).toEqual({ amount: '83⅓', unit: 'g', name: 'Quark' });
		expect(parseIngredient('1–2 EL Öl')).toEqual({ amount: '1–2', unit: 'EL', name: 'Öl' });
		expect(parseIngredient('1,5 kg Kartoffeln')).toEqual({ amount: '1,5', unit: 'kg', name: 'Kartoffeln' });
	});

	it('prefers nested section steps and derives a missing time component from total time', () => {
		const result = parseRecipeHtml(recipeHtml({
			'@type': 'Recipe',
			name: 'Nested instructions',
			prepTime: 'PT10M',
			totalTime: 'PT35M',
			recipeInstructions: [{
				'@type': 'HowToSection',
				text: 'Preparation',
				itemListElement: [
					{ '@type': 'HowToStep', name: 'Mix' },
					{ '@type': 'HowToStep', text: 'Bake.<br>Serve.' }
				]
			}]
		}));
		expect(result?.prepTime).toBe(10);
		expect(result?.cookTime).toBe(25);
		expect(result?.steps).toEqual([
			{ stepNumber: 1, text: 'Mix' },
			{ stepNumber: 2, text: 'Bake. Serve.' }
		]);
	});

	it('falls back safely when optional fields use unexpected shapes', () => {
		const result = parseRecipeHtml(recipeHtml({
			'@type': 'Recipe',
			name: 'Still importable',
			recipeYield: { unexpected: true },
			recipeIngredient: [null, 42, { unknown: true }],
			recipeInstructions: { unknown: true },
			image: { url: { unexpected: true } }
		}));
		expect(result).toMatchObject({ servings: 4, ingredients: [], steps: [], imageUrl: null });
	});
});
