import { browser } from '$app/environment';
import { type UserSettings, type ListCategorySettings, type Shortcut, DEFAULT_SETTINGS } from '$lib/userSettingsTypes';
import { DEFAULT_CATEGORY_ORDER } from '$lib/categories';
export type { UserSettings, ListCategorySettings, Shortcut } from '$lib/userSettingsTypes';
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
let _shortcuts = $state<Shortcut[]>(cache.shortcuts ?? []);
let _locationNavEnabled = $state<boolean>(cache.locationNavEnabled ?? false);
let _listLocationDisabled = $state<string[]>(cache.listLocationDisabled ?? []);
let _itemLayout = $state<'grid' | 'list'>(cache.itemLayout ?? 'grid');
let _showAllCheckedItems = $state<boolean>(cache.showAllCheckedItems ?? false);
let _showFavoriteIndicator = $state<boolean>(cache.showFavoriteIndicator ?? true);
let _showSupplementTracker = $state<boolean>(cache.showSupplementTracker ?? true);
let _showRecipes = $state<boolean>(cache.showRecipes ?? true);
let _theme = $state<'system' | 'light' | 'dark'>(cache.theme ?? 'system');

let _saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
	if (_saveTimer) clearTimeout(_saveTimer);
	_saveTimer = setTimeout(async () => {
		const settings: UserSettings = {
			lang: _lang,
			theme: _theme,
			categorySortEnabled: _categorySortEnabled,
			categoryOrder: _categoryOrder,
			listCategorySettings: _listCategorySettings,
			shortcuts: _shortcuts,
			locationNavEnabled: _locationNavEnabled,
			listLocationDisabled: _listLocationDisabled,
			itemLayout: _itemLayout,
			showAllCheckedItems: _showAllCheckedItems,
			showFavoriteIndicator: _showFavoriteIndicator,
			showSupplementTracker: _showSupplementTracker,
			showRecipes: _showRecipes
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
	},

	// Location navigation
	get locationNavEnabled() { return _locationNavEnabled; },
	set locationNavEnabled(v: boolean) { _locationNavEnabled = v; scheduleSave(); },

	isListLocationDisabled(listId: string): boolean {
		return _listLocationDisabled.includes(listId);
	},
	setListLocationDisabled(listId: string, disabled: boolean) {
		if (disabled) {
			if (!_listLocationDisabled.includes(listId)) {
				_listLocationDisabled = [..._listLocationDisabled, listId];
			}
		} else {
			_listLocationDisabled = _listLocationDisabled.filter(id => id !== listId);
		}
		scheduleSave();
	},

	// Item layout
	get itemLayout() { return _itemLayout; },
	set itemLayout(v: 'grid' | 'list') { _itemLayout = v; scheduleSave(); },

	// Show all checked items (default: false = limit to 16)
	get showAllCheckedItems() { return _showAllCheckedItems; },
	set showAllCheckedItems(v: boolean) { _showAllCheckedItems = v; scheduleSave(); },

	// Show favourite indicator dot on tiles/rows (default: true)
	get showFavoriteIndicator() { return _showFavoriteIndicator; },
	set showFavoriteIndicator(v: boolean) { _showFavoriteIndicator = v; scheduleSave(); },

	// Show supplement tracker tab in navigation (default: true)
	get showSupplementTracker() { return _showSupplementTracker; },
	set showSupplementTracker(v: boolean) { _showSupplementTracker = v; scheduleSave(); },

	// Show recipes tab in navigation (default: true)
	get showRecipes() { return _showRecipes; },
	set showRecipes(v: boolean) { _showRecipes = v; scheduleSave(); },

	// Theme
	get theme() { return _theme; },
	set theme(v: 'system' | 'light' | 'dark') { _theme = v; scheduleSave(); },

	// Shortcuts
	get shortcuts() { return _shortcuts; },
	addShortcut(s: Shortcut) {
		if (_shortcuts.length >= 4) return;
		_shortcuts = [..._shortcuts, s];
		scheduleSave();
	},
	updateShortcut(id: string, changes: Partial<Omit<Shortcut, 'id'>>) {
		_shortcuts = _shortcuts.map(s => s.id === id ? { ...s, ...changes } : s);
		scheduleSave();
	},
	removeShortcut(id: string) {
		_shortcuts = _shortcuts.filter(s => s.id !== id);
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
		_shortcuts = settings.shortcuts ?? [];
		_locationNavEnabled = settings.locationNavEnabled ?? false;
		_listLocationDisabled = settings.listLocationDisabled ?? [];
		_itemLayout = settings.itemLayout ?? 'grid';
		_showAllCheckedItems = settings.showAllCheckedItems ?? false;
		_showFavoriteIndicator = settings.showFavoriteIndicator ?? true;
		_showSupplementTracker = settings.showSupplementTracker ?? true;
		_showRecipes = settings.showRecipes ?? true;
		_theme = settings.theme ?? 'system';
		saveCache(settings);
		return settings;
	} catch { return null; }
}
