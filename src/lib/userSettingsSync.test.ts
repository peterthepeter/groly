import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, resolveShoppingItemSortMode, type UserSettings } from '#lib/userSettingsTypes';
import {
	applyUserSettingsPatch,
	combineUserSettingsPatches,
	hasExplicitUserLanguage,
	sanitizeUserSettingsPatch,
	userSettingsPatchMatches
} from '#lib/userSettingsSync';

describe('user settings patches', () => {
	it('persists the two date and time choices independently and rejects unknown formats', () => {
		const date = sanitizeUserSettingsPatch({ dateFormat: 'ymd-dash' });
		const time = sanitizeUserSettingsPatch({ timeFormat: '12h' });
		expect(date).toEqual({ dateFormat: 'ymd-dash' });
		expect(time).toEqual({ timeFormat: '12h' });
		const original = { lang: 'en' as const };
		const changed = applyUserSettingsPatch(applyUserSettingsPatch(original, date!), time!);
		expect(changed).toEqual({ ...original, dateFormat: 'ymd-dash', timeFormat: '12h' });
		expect(applyUserSettingsPatch(original, { theme: 'dark' })).toEqual({ ...original, theme: 'dark' });
		expect(sanitizeUserSettingsPatch({ dateFormat: 'default' })).toBeNull();
		expect(sanitizeUserSettingsPatch({ timeFormat: 'automatic' })).toBeNull();
	});

	it('initializes missing formats without overriding an account selection', () => {
		const initial = { initialFormats: { dateFormat: 'mdy-slash', timeFormat: '12h' } } as const;
		expect(sanitizeUserSettingsPatch(initial)).toEqual(initial);
		expect(sanitizeUserSettingsPatch({ initialFormats: { dateFormat: 'invalid' } })).toBeNull();
		const upgraded = applyUserSettingsPatch({ lang: 'de', theme: 'dark' }, initial);
		expect(upgraded).toEqual({ lang: 'de', theme: 'dark', dateFormat: 'mdy-slash', timeFormat: '12h' });
		expect(applyUserSettingsPatch(upgraded, { initialFormats: { dateFormat: 'dmy-dot', timeFormat: '24h' } })).toEqual(upgraded);
		expect(userSettingsPatchMatches(upgraded, { initialFormats: { dateFormat: 'dmy-dot', timeFormat: '24h' } })).toBe(true);
		expect(userSettingsPatchMatches({}, initial)).toBe(false);
	});

	it('preserves a local test selection and allows a deliberate change before automatic settings sync', () => {
		const initial = { initialFormats: { dateFormat: 'mdy-slash', timeFormat: '12h' } } as const;
		expect(applyUserSettingsPatch({ checklistTimeFormat: '24h' }, initial)).toMatchObject({ dateFormat: 'mdy-slash', timeFormat: '24h' });
		const pending = combineUserSettingsPatches(initial, { dateFormat: 'ymd-dash' });
		expect(applyUserSettingsPatch({}, pending)).toEqual({ dateFormat: 'ymd-dash', timeFormat: '12h' });
	});

	it('updates top-level settings without replacing unrelated values', () => {
		expect(applyUserSettingsPatch(
			{ theme: 'light', categorySortEnabled: true },
			{ theme: 'dark' }
		)).toEqual({ theme: 'dark', categorySortEnabled: true });
	});

	it('merges per-list category settings independently', () => {
		const result = applyUserSettingsPatch(
			{ listCategorySettings: { a: { enabled: true, order: ['obst'] } } },
			{ listCategorySettings: { b: { enabled: false, order: ['snacks'] } } }
		);
		expect(result.listCategorySettings).toEqual({
			a: { enabled: true, order: ['obst'] },
			b: { enabled: false, order: ['snacks'] }
		});
	});

	it('keeps existing category preferences until alphabetical sorting is explicitly selected', () => {
		const legacy = {
			categorySortEnabled: false,
			categoryOrder: ['obst', 'snacks'],
			listCategorySettings: { a: { enabled: true, order: ['snacks', 'obst'] } }
		} satisfies UserSettings;
		const list = legacy.listCategorySettings.a;
		expect(resolveShoppingItemSortMode(DEFAULT_SETTINGS.categorySortEnabled)).toBe('category');
		expect(resolveShoppingItemSortMode(legacy.categorySortEnabled)).toBe('off');
		expect(resolveShoppingItemSortMode(list.enabled)).toBe('category');

		const changes = sanitizeUserSettingsPatch({
			itemSortDirection: 'az',
			listCategorySettings: { a: { ...list, itemSortDirection: 'za' } }
		})!;
		const alphabetical = applyUserSettingsPatch(legacy, changes);
		expect(alphabetical).toEqual({
			...legacy,
			itemSortDirection: 'az',
			listCategorySettings: { a: { ...list, itemSortDirection: 'za' } }
		});
		expect(resolveShoppingItemSortMode(legacy.categorySortEnabled, alphabetical.itemSortDirection)).toBe('az');
		expect(resolveShoppingItemSortMode(list.enabled, alphabetical.listCategorySettings?.a.itemSortDirection)).toBe('za');
		expect(applyUserSettingsPatch(alphabetical, { itemSortDirection: null, listCategorySettings: { a: list } })).toEqual({
			...legacy, itemSortDirection: null
		});
	});

	it('represents a per-list reset without clearing other lists', () => {
		const result = applyUserSettingsPatch(
			{ listCategorySettings: {
				a: { enabled: true, order: ['obst'] },
				b: { enabled: true, order: ['snacks'] }
			} },
			{ listCategorySettings: { a: null } }
		);
		expect(result.listCategorySettings).toEqual({ b: { enabled: true, order: ['snacks'] } });
	});

	it('coalesces repeated offline changes while preserving changes for other lists', () => {
		expect(combineUserSettingsPatches(
			{ theme: 'light', listCategorySettings: { a: { enabled: true, order: ['obst'] } } },
			{ theme: 'dark', listCategorySettings: { b: { enabled: true, order: ['snacks'] } } }
		)).toEqual({
			theme: 'dark',
			listCategorySettings: {
				a: { enabled: true, order: ['obst'] },
				b: { enabled: true, order: ['snacks'] }
			}
		});
	});

	it('detects whether a lost response already applied the queued patch', () => {
		const settings = {
			theme: 'dark' as const,
			listCategorySettings: { a: { enabled: true, order: ['obst'] } }
		};
		expect(userSettingsPatchMatches(settings, {
			theme: 'dark',
			listCategorySettings: { a: { enabled: true, order: ['obst'] } }
		})).toBe(true);
		expect(userSettingsPatchMatches(settings, { theme: 'light' })).toBe(false);
	});

	it('rejects malformed patch containers', () => {
		expect(sanitizeUserSettingsPatch(null)).toBeNull();
		expect(sanitizeUserSettingsPatch([])).toBeNull();
		expect(sanitizeUserSettingsPatch({ listCategorySettings: [] })).toBeNull();
	});

	it('turns reactive-style proxies into structured-cloneable settings', () => {
		const categoryOrder = new Proxy(['snacks', 'obst'], {});
		const settings = new Proxy({ lang: 'en', categoryOrder }, {});
		expect(() => structuredClone(settings)).toThrow();

		const sanitized = sanitizeUserSettingsPatch(settings);
		expect(sanitized).toEqual({ lang: 'en', categoryOrder: ['snacks', 'obst'] });
		expect(() => structuredClone(sanitized)).not.toThrow();
	});

	it('distinguishes a saved language from the implicit default', () => {
		expect(hasExplicitUserLanguage({})).toBe(false);
		expect(hasExplicitUserLanguage({ lang: 'de' })).toBe(true);
		expect(hasExplicitUserLanguage({ lang: 'en' })).toBe(true);
	});
});
