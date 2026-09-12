import { describe, expect, it } from 'vitest';
import { isPrivateIpAddress, parsePublicRecipeUrl } from './recipeImportSecurity';

describe('recipe import URL security', () => {
	it('accepts ordinary public recipe domains without a whitelist', () => {
		for (const url of [
			'https://www.chefkoch.de/rezepte/123/Test.html',
			'https://www.bbcgoodfood.com/recipes/test',
			'https://www.kitchenstories.com/de/rezepte/test',
			'https://www.lecker.de/test-rezept.html',
			'https://example.com/any-future-recipe-site'
		]) {
			expect(parsePublicRecipeUrl(url), url).not.toBeNull();
		}
	});

	it('rejects unsupported protocols and local hostnames', () => {
		expect(parsePublicRecipeUrl('file:///etc/passwd')).toBeNull();
		expect(parsePublicRecipeUrl('http://localhost/recipe')).toBeNull();
		expect(parsePublicRecipeUrl('http://groly.local/recipe')).toBeNull();
	});

	it('rejects private literal IPv4 and IPv6 addresses', () => {
		expect(parsePublicRecipeUrl('http://127.0.0.1/recipe')).toBeNull();
		expect(parsePublicRecipeUrl('http://192.168.1.2/recipe')).toBeNull();
		expect(parsePublicRecipeUrl('http://[::1]/recipe')).toBeNull();
		expect(parsePublicRecipeUrl('http://[fd00::1]/recipe')).toBeNull();
	});

	it('recognizes public and private resolved addresses', () => {
		expect(isPrivateIpAddress('93.184.216.34')).toBe(false);
		expect(isPrivateIpAddress('10.0.0.1')).toBe(true);
		expect(isPrivateIpAddress('::ffff:127.0.0.1')).toBe(true);
	});
});
