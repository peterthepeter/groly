import { describe, expect, it } from 'vitest';
import { normalizeShortcuts, shortcutTarget } from './shortcutActions';
import { sanitizeUserSettingsPatch } from './userSettingsSync';

describe('quick-access actions', () => {
	it('removes retired actions before applying the four-slot limit and preserves valid entries', () => {
		const old = ['recipes', 'mealplan'].map(action => ({ id: action, name: action, action }));
		const current = ['go', 'add', 'log-tracker', 'log-supplement'].map(action => ({ id: action, name: action, action, listId: 'family' }));
		expect(normalizeShortcuts([...old, ...current]).map(shortcut => shortcut.action)).toEqual(['go', 'add', 'log-tracker', 'log-supplement']);
		expect(normalizeShortcuts(current)[2]).toEqual({ id: 'log-tracker', name: 'log-tracker', action: 'log-tracker' });
	});
	it('drops malformed and duplicate entries without requiring a list for logging', () => {
		expect(normalizeShortcuts([null, { id: 'bad', name: 'Broken', action: 'go' }, { id: 'log', name: ' Log ', action: 'log-tracker' }, { id: 'log', name: 'Duplicate', action: 'log-supplement' }])).toEqual([{ id: 'log', name: 'Log', action: 'log-tracker' }]);
	});
	it('routes each action to its real target, including both quick-log tabs', () => {
		for (const [action, target] of [['go', '/listen/family'], ['add', '/listen/family?action=add'], ['scanner', '/listen/family?action=scanner'], ['log-tracker', '/tracker?action=log-tracker'], ['log-supplement', '/tracker?action=log-supplement']] as const) {
			expect(shortcutTarget({ id: action, name: action, action, listId: 'family' })).toBe(target);
		}
	});
	it('cleans old clients and persisted offline patches so retired actions cannot return', () => {
		expect(sanitizeUserSettingsPatch({ shortcuts: [{ id: 'old', name: 'Recipes', action: 'recipes' }, { id: 'log', name: 'Supplements', action: 'log-supplement' }] })).toEqual({ shortcuts: [{ id: 'log', name: 'Supplements', action: 'log-supplement' }] });
		expect(sanitizeUserSettingsPatch({ shortcuts: {} })).toBeNull();
	});
});
