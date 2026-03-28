import { browser } from '$app/environment';
import { type UserSettings, type ListCategorySettings, DEFAULT_SETTINGS } from '$lib/userSettingsTypes';
import { DEFAULT_CATEGORY_ORDER } from '$lib/categories';
export type { UserSettings, ListCategorySettings } from '$lib/userSettingsTypes';
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
	let order: string[];
	if (!stored.categoryOrder) {
		order = [...DEFAULT_SETTINGS.categoryOrder];
	} else {
		// Migration: fehlende Kategorien aus dem Default an der richtigen Stelle einfügen
		order = [...stored.categoryOrder];
		for (const key of DEFAULT_CATEGORY_ORDER) {
			if (order.includes(key)) continue;
			// Vor dem nächsten Default-Nachfolger einfügen, der bereits in der Order ist
			const defaultIdx = DEFAULT_CATEGORY_ORDER.indexOf(key);
			let inserted = false;
			for (let i = defaultIdx + 1; i < DEFAULT_CATEGORY_ORDER.length; i++) {
				const resultIdx = order.indexOf(DEFAULT_CATEGORY_ORDER[i]);
				if (resultIdx !== -1) {
					order.splice(resultIdx, 0, key);
					inserted = true;
					break;
				}
			}
			if (!inserted) order.push(key);
		}
	}
	return {
		lang: stored.lang ?? DEFAULT_SETTINGS.lang,
		categorySortEnabled: stored.categorySortEnabled ?? DEFAULT_SETTINGS.categorySortEnabled,
		categoryOrder: order
	};
}

// --- Reactive state ---
const cache = loadCache();
const initial = merge(cache);

let _lang = $state(initial.lang);
let _categorySortEnabled = $state(initial.categorySortEnabled);
let _categoryOrder = $state<string[]>(initial.categoryOrder);
let _listCategorySettings = $state<Record<string, ListCategorySettings>>(cache.listCategorySettings ?? {});

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
	if (_saveTimer) clearTimeout(_saveTimer);
	_saveTimer = setTimeout(async () => {
		const settings: UserSettings = {
			lang: _lang,
			categorySortEnabled: _categorySortEnabled,
			categoryOrder: _categoryOrder,
			listCategorySettings: _listCategorySettings
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
	},

	// Per-list category settings
	getListCategorySettings(listId: string): ListCategorySettings | null {
		return _listCategorySettings[listId] ?? null;
	},
	setListCategorySettings(listId: string, settings: ListCategorySettings) {
		_listCategorySettings = { ..._listCategorySettings, [listId]: settings };
		scheduleSave();
	},
	clearListCategorySettings(listId: string) {
		const next = { ..._listCategorySettings };
		delete next[listId];
		_listCategorySettings = next;
		scheduleSave();
	},
	moveListCategoryUp(listId: string, index: number) {
		const s = _listCategorySettings[listId];
		if (!s || index <= 0) return;
		const arr = [...s.order];
		[arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
		_listCategorySettings = { ..._listCategorySettings, [listId]: { ...s, order: arr } };
		scheduleSave();
	},
	moveListCategoryDown(listId: string, index: number) {
		const s = _listCategorySettings[listId];
		if (!s || index >= s.order.length - 1) return;
		const arr = [...s.order];
		[arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
		_listCategorySettings = { ..._listCategorySettings, [listId]: { ...s, order: arr } };
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
		_listCategorySettings = settings.listCategorySettings ?? {};
		saveCache(settings);
		return settings;
	} catch { return null; }
}
