import { describe, expect, it } from 'vitest';
import {
	normalizeCategoryPreferenceName,
	resolveCategoryOverrideForCreate,
	getCategoryPreferenceAction
} from '$lib/categoryPreferences';

describe('category preference resolution', () => {
	it('uses the same exact normalized item name for German and separator variants', () => {
		expect(normalizeCategoryPreferenceName('  MÜSLI–Schoko  ')).toBe('muesli schoko');
		expect(normalizeCategoryPreferenceName('Muesli Schoko')).toBe('muesli schoko');
	});

	it('prioritizes an explicit favorite override over a learned preference', () => {
		const preferences = new Map([['magentabletten', 'koerperpflege']]);
		expect(resolveCategoryOverrideForCreate('Magentabletten', 'haushalt', preferences)).toBe('haushalt');
	});

	it('falls back from the personal preference to automatic resolution', () => {
		const preferences = new Map([['magentabletten', 'koerperpflege']]);
		expect(resolveCategoryOverrideForCreate('Magentabletten', null, preferences)).toBe('koerperpflege');
		expect(resolveCategoryOverrideForCreate('Milch', null, preferences)).toBeNull();
		expect(resolveCategoryOverrideForCreate('Magentabletten', 'not-a-category', preferences)).toBe('koerperpflege');
	});

	it('learns only after explicit picker use and treats Automatic as delete', () => {
		expect(getCategoryPreferenceAction(false, 'koerperpflege')).toEqual({ type: 'unchanged' });
		expect(getCategoryPreferenceAction(false, null)).toEqual({ type: 'unchanged' });
		expect(getCategoryPreferenceAction(true, 'koerperpflege')).toEqual({
			type: 'set', categoryOverride: 'koerperpflege'
		});
		expect(getCategoryPreferenceAction(true, null)).toEqual({ type: 'delete' });
	});
});
