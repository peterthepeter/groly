import { describe, expect, it } from 'vitest';
import { languageFromAcceptLanguage, languageFromBrowserLanguage } from './language';

describe('browser language fallback', () => {
	it.each([
		['de', 'de'],
		['de-DE', 'de'],
		['en-US', 'en'],
		['es-ES', 'en'],
		['fr-FR', 'en'],
		[null, 'en']
	] as const)('uses %s as %s', (language, expected) => {
		expect(languageFromBrowserLanguage(language)).toBe(expected);
	});

	it('uses the first browser language from Accept-Language', () => {
		expect(languageFromAcceptLanguage('es-ES,es;q=0.9,en;q=0.8')).toBe('en');
		expect(languageFromAcceptLanguage('de-AT,de;q=0.9,en;q=0.8')).toBe('de');
	});
});
