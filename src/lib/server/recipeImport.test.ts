import { describe, expect, it } from 'vitest';
import { findRecipeInJsonLd, parseIngredient, parseRecipeHtml } from './recipeImport';

function recipeHtml(recipe: Record<string, unknown>): string {
	return `<html><script type="application/ld+json">${JSON.stringify(recipe)}</script></html>`;
}

describe('recipe import normalization', () => {
	it('handles Chefkoch recipeYield arrays without throwing', () => {
		const result = parseRecipeHtml(recipeHtml({
			'@context': 'https://schema.org',
			'@graph': [{
				'@type': 'Recipe',
				name: 'Schnelle Bolognese Sauce',
				recipeYield: ['2', '2 Portionen'],
				recipeIngredient: ['1 EL Olivenöl', '1 Zwiebel(n)'],
				recipeInstructions: [{ '@type': 'HowToStep', text: 'Alles anbraten.' }]
			}]
		}));

		expect(result?.servings).toBe(2);
		expect(result?.ingredients).toEqual([
			{ amount: '1', unit: 'EL', name: 'Olivenöl' },
			{ amount: '1', unit: null, name: 'Zwiebel' }
		]);
	});

	it('accepts Recipe in @type arrays and nested mainEntity nodes', () => {
		const node = { mainEntity: { '@type': ['HowTo', 'Recipe'], name: 'Soup' } };
		expect(findRecipeInJsonLd(node)?.name).toBe('Soup');
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
		expect(parseIngredient('1–2 EL Öl')).toEqual({ amount: '1–2', unit: 'EL', name: 'Öl' });
		expect(parseIngredient('1,5 kg Kartoffeln')).toEqual({ amount: '1,5', unit: 'kg', name: 'Kartoffeln' });
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
