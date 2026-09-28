import type { AvailableLanguageTag } from '$lib/paraglide/runtime';

// Browsers send their preferred language first. Keep the existing German fallback
// for languages Groly does not support.
export function languageFromAcceptLanguage(header: string | null): AvailableLanguageTag {
	const primary = header?.split(',')[0]?.trim().split(';')[0]?.toLowerCase();
	return primary === 'en' || primary?.startsWith('en-') ? 'en' : 'de';
}
