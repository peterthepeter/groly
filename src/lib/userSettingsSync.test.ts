import { describe, expect, it } from 'vitest';
import {
	applyUserSettingsPatch,
	combineUserSettingsPatches,
	sanitizeUserSettingsPatch,
	userSettingsPatchMatches
} from '$lib/userSettingsSync';

describe('user settings patches', () => {
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
});
