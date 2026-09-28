import type { AvailableLanguageTag } from '$lib/paraglide/runtime';

// German is shown only for German browser preferences. English is the fallback
// for every other language because those languages have no translations yet.
export function languageFromBrowserLanguage(language: string | null): AvailableLanguageTag {
	const tag = language?.trim().toLowerCase();
	return tag === 'de' || tag?.startsWith('de-') ? 'de' : 'en';
}

export function languageFromAcceptLanguage(header: string | null): AvailableLanguageTag {
	return languageFromBrowserLanguage(header?.split(',')[0]?.split(';')[0] ?? null);
}
