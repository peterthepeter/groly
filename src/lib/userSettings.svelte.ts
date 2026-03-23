import { browser } from '$app/environment';
import { type UserSettings, DEFAULT_SETTINGS } from '$lib/userSettingsTypes';
export type { UserSettings } from '$lib/userSettingsTypes';
export { DEFAULT_SETTINGS } from '$lib/userSettingsTypes';
import type { AvailableLanguageTag } from '$lib/paraglide/runtime';

const CACHE_KEY = 'groly_settings';

function loadCache(): UserSettings {
	if (!browser) return {};
	try {
		const raw = localStorage.getItem(CACHE_KEY);
		// Legacy: migrate old separate keys
		if (!raw) {
			const legacyLang = localStorage.getItem('groly_lang');
			const legacyCat = localStorage.getItem('groly_category_settings');
			const merged: UserSettings = {};
			if (legacyLang) merged.lang = legacyLang as AvailableLanguageTag;
			if (legacyCat) {
				try { Object.assign(merged, JSON.parse(legacyCat)); } catch {}
			}
			return merged;
		}
		return JSON.parse(raw);
	} catch { return {}; }
}

function saveCache(s: UserSettings) {
	if (!browser) return;
	localStorage.setItem(CACHE_KEY, JSON.stringify(s));
}

function merge(stored: UserSettings): Required<typeof DEFAULT_SETTINGS> {
	return {
		lang: stored.lang ?? DEFAULT_SETTINGS.lang,
		categorySortEnabled: stored.categorySortEnabled ?? DEFAULT_SETTINGS.categorySortEnabled,
		categoryOrder: stored.categoryOrder ?? [...DEFAULT_SETTINGS.categoryOrder]
	};
}

// --- Reactive state ---
const cache = loadCache();
const initial = merge(cache);

let _lang = $state(initial.lang);
let _categorySortEnabled = $state(initial.categorySortEnabled);
let _categoryOrder = $state<string[]>(initial.categoryOrder);

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
	if (_saveTimer) clearTimeout(_saveTimer);
	_saveTimer = setTimeout(async () => {
		const settings: UserSettings = {
			lang: _lang,
			categorySortEnabled: _categorySortEnabled,
			categoryOrder: _categoryOrder
		};
		saveCache(settings);
		try {
			await fetch('/api/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ settings })
			});
		} catch {}
	}, 500);
}

export const userSettings = {
	get lang() { return _lang; },
	set lang(v: AvailableLanguageTag) { _lang = v; scheduleSave(); },

	get categorySortEnabled() { return _categorySortEnabled; },
	set categorySortEnabled(v: boolean) { _categorySortEnabled = v; scheduleSave(); },

	get categoryOrder() { return _categoryOrder; },
	moveUp(index: number) {
		if (index <= 0) return;
		const arr = [..._categoryOrder];
		[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
		_categoryOrder = arr;
		scheduleSave();
	},
	moveDown(index: number) {
		if (index >= _categoryOrder.length - 1) return;
		const arr = [..._categoryOrder];
		[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
		_categoryOrder = arr;
		scheduleSave();
	}
};

export async function initUserSettings(): Promise<UserSettings | null> {
	if (!browser) return null;
	try {
		const res = await fetch('/api/users/me');
		if (!res.ok) return null;
		const { settings } = await res.json() as { settings: UserSettings };
		const merged = merge(settings);
		_lang = merged.lang;
		_categorySortEnabled = merged.categorySortEnabled;
		_categoryOrder = merged.categoryOrder;
		saveCache(settings);
		return settings;
	} catch { return null; }
}
