import * as m from '$lib/paraglide/messages';
import { setLanguageTag, type AvailableLanguageTag } from '$lib/paraglide/runtime';
import { browser } from '$app/environment';
import { userSettings, initUserSettings, onUserSettingsApplied } from '$lib/userSettings.svelte';
import type { UserSettings } from '$lib/userSettingsTypes';

let _lang = $state<AvailableLanguageTag>('de');
let initializedUserId: string | null | undefined;
let initializationToken = 0;

if (browser) {
	onUserSettingsApplied((settings) => {
		const lang = settings.lang ?? 'de';
		setLanguageTag(lang);
		_lang = lang;
	});
}

export function currentLang(): AvailableLanguageTag {
	return _lang;
}

export function setLang(lang: AvailableLanguageTag) {
	setLanguageTag(lang);
	_lang = lang;
	userSettings.lang = lang;
}

export async function initLanguage(
	userId: string | null,
	serverSettings: UserSettings = {},
	settingsRevision = 0
) {
	if (!browser) return;
	if (initializedUserId === userId) return;
	initializedUserId = userId;
	const token = ++initializationToken;
	// Load the user-scoped offline cache first, then reconcile with the server.
	const effectiveSettings = await initUserSettings(userId, serverSettings, settingsRevision);
	if (token !== initializationToken) return;
	const lang = userSettings.lang;
	setLanguageTag(lang);
	_lang = lang;
	// If no explicit language preference was saved, detect from browser
	if (userId && !effectiveSettings?.lang) {
		const browserLang = navigator.language.slice(0, 2);
		setLang(browserLang === 'en' ? 'en' : 'de');
	}
}

// Reactive translation proxy — each access reads _lang, creating a reactive dependency
// in any Svelte 5 reactive context (component render, $derived, $effect). Typed against
// the paraglide messages module so typos in `t.foo_bar` are still flagged by TypeScript.
type NoArgMessages = {
	[K in keyof typeof m]: typeof m[K] extends () => string ? K : never;
}[keyof typeof m];

export const t = new Proxy({} as Record<NoArgMessages, string>, {
	get(_target, key: string | symbol): string {
		void _lang; // register reactive dependency
		if (typeof key !== 'string') return '';
		const fn = (m as Record<string, unknown>)[key];
		return typeof fn === 'function' ? (fn as () => string)() : '';
	}
});

// Parametric helpers with inline plural logic (Paraglide doesn't support ICU plural syntax)
export function lists_active(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} active ${count === 1 ? 'list' : 'lists'}`;
	return `${count} aktive ${count === 1 ? 'Liste' : 'Listen'}`;
}
export function list_items_open(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} ${count === 1 ? 'item' : 'items'}`;
	return `${count} ${count === 1 ? 'Artikel' : 'Artikel'}`;
}
export function items_checked_count(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} completed ${count === 1 ? 'item' : 'items'}`;
	return `${count} erledigte ${count === 1 ? 'Element' : 'Elemente'}`;
}
export function sync_pending(count: number): string {
	void _lang;
	if (_lang === 'en') return `${count} pending sync`;
	return `${count} Sync offen`;
}
export function reminders_deactivated_for(name: string): string {
	void _lang;
	if (_lang === 'en') return `Reminders for "${name}" have been deactivated`;
	return `Erinnerungen für „${name}" wurden deaktiviert`;
}

export function nutrients_show_more(count: number): string {
	void _lang;
	if (_lang === 'en') return `Show ${count} more`;
	return `${count} weitere anzeigen`;
}

export function nutrition_kcal_remaining(kcal: string): string {
	void _lang;
	if (_lang === 'en') return `${kcal} kcal remaining`;
	return `Noch ${kcal} kcal frei`;
}

export function nutrition_kcal_over(kcal: string): string {
	void _lang;
	if (_lang === 'en') return `${kcal} kcal over goal`;
	return `${kcal} kcal über dem Ziel`;
}

export function nutrition_meals_count(count: number): string {
	void _lang;
	if (_lang === 'en') return count === 1 ? '1 meal' : `${count} meals`;
	return count === 1 ? '1 Mahlzeit' : `${count} Mahlzeiten`;
}

export function today_reminders_label(count: number): string {
	void _lang;
	if (_lang === 'en') return count === 1 ? '1 reminder today' : `${count} reminders today`;
	return count === 1 ? 'heute 1 Erinnerung' : `heute ${count} Erinnerungen`;
}
