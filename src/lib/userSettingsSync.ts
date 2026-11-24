import { normalizeShortcuts } from '#lib/shortcutActions';
import { isDateFormat, isTimeFormat, type DateFormat, type TimeFormat } from '#lib/dates';
import type { ListCategorySettings, UserSettings } from '#lib/userSettingsTypes';

export type UserSettingsPatch = Partial<Omit<UserSettings, 'listCategorySettings'>> & {
	listCategorySettings?: Record<string, ListCategorySettings | null>;
	initialFormats?: { dateFormat?: DateFormat; timeFormat?: TimeFormat };
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeUserSettingsPatch(value: unknown): UserSettingsPatch | null {
	if (!isRecord(value)) return null;
	let plainValue: unknown;
	try {
		// Settings can originate from Svelte 5's deeply proxied $state values. IndexedDB
		// uses the structured-clone algorithm and rejects those proxies, while a JSON
		// round-trip produces the plain data shape that the API and cache expect.
		plainValue = JSON.parse(JSON.stringify(value));
	} catch {
		return null;
	}
	if (!isRecord(plainValue)) return null;
	const patch = plainValue as UserSettingsPatch;
	if (plainValue.dateFormat !== undefined && !isDateFormat(plainValue.dateFormat)) return null;
	if (plainValue.timeFormat !== undefined && !isTimeFormat(plainValue.timeFormat)) return null;
	if (plainValue.initialFormats !== undefined) {
		const initial = plainValue.initialFormats;
		if (!isRecord(initial) ||
			(initial.dateFormat !== undefined && !isDateFormat(initial.dateFormat)) ||
			(initial.timeFormat !== undefined && !isTimeFormat(initial.timeFormat))) return null;
		patch.initialFormats = {
			...(isDateFormat(initial.dateFormat) ? { dateFormat: initial.dateFormat } : {}),
			...(isTimeFormat(initial.timeFormat) ? { timeFormat: initial.timeFormat } : {})
		};
	}
	if (plainValue.listCategorySettings !== undefined && !isRecord(plainValue.listCategorySettings)) return null;
	if (plainValue.shortcuts !== undefined) {
		if (!Array.isArray(plainValue.shortcuts)) return null;
		patch.shortcuts = normalizeShortcuts(plainValue.shortcuts);
	}
	return patch;
}

export function hasExplicitUserLanguage(settings: UserSettings): boolean {
	return settings.lang === 'de' || settings.lang === 'en';
}

export function getStoredFormats(settings: UserSettings): { dateFormat?: DateFormat; timeFormat?: TimeFormat } {
	return {
		dateFormat: isDateFormat(settings.dateFormat) ? settings.dateFormat
			: isDateFormat(settings.checklistDateFormat) ? settings.checklistDateFormat : undefined,
		timeFormat: isTimeFormat(settings.timeFormat) ? settings.timeFormat
			: isTimeFormat(settings.checklistTimeFormat) ? settings.checklistTimeFormat : undefined
	};
}

export function applyUserSettingsPatch(base: UserSettings, patch: UserSettingsPatch): UserSettings {
	const { listCategorySettings, initialFormats, ...topLevel } = patch;
	const next: UserSettings = { ...base, ...topLevel };
	if (initialFormats) {
		const stored = getStoredFormats(next);
		if (initialFormats.dateFormat) next.dateFormat = stored.dateFormat ?? initialFormats.dateFormat;
		if (initialFormats.timeFormat) next.timeFormat = stored.timeFormat ?? initialFormats.timeFormat;
	}
	if (listCategorySettings !== undefined) {
		const lists = new Map(Object.entries(base.listCategorySettings ?? {}));
		for (const [listId, settings] of Object.entries(listCategorySettings)) {
			if (settings === null) lists.delete(listId);
			else lists.set(listId, settings);
		}
		next.listCategorySettings = Object.fromEntries(lists);
	}
	return next;
}

export function combineUserSettingsPatches(
	previous: UserSettingsPatch,
	next: UserSettingsPatch
): UserSettingsPatch {
	const combined: UserSettingsPatch = { ...previous, ...next };
	if (previous.initialFormats && next.initialFormats) {
		combined.initialFormats = { ...next.initialFormats, ...previous.initialFormats };
	}
	if (previous.listCategorySettings !== undefined || next.listCategorySettings !== undefined) {
		combined.listCategorySettings = {
			...(previous.listCategorySettings ?? {}),
			...(next.listCategorySettings ?? {})
		};
	}
	return combined;
}

function equalValue(a: unknown, b: unknown): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function userSettingsPatchMatches(settings: UserSettings, patch: UserSettingsPatch): boolean {
	const { listCategorySettings, initialFormats, ...topLevel } = patch;
	if (initialFormats?.dateFormat && !isDateFormat(settings.dateFormat)) return false;
	if (initialFormats?.timeFormat && !isTimeFormat(settings.timeFormat)) return false;
	for (const [key, value] of Object.entries(topLevel)) {
		if (!equalValue(settings[key as keyof UserSettings], value)) return false;
	}
	if (listCategorySettings !== undefined) {
		for (const [listId, value] of Object.entries(listCategorySettings)) {
			const current = settings.listCategorySettings?.[listId];
			if (value === null ? current !== undefined : !equalValue(current, value)) return false;
		}
	}
	return true;
}
