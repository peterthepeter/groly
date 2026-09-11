import type { ListCategorySettings, UserSettings } from '$lib/userSettingsTypes';

export type UserSettingsPatch = Partial<Omit<UserSettings, 'listCategorySettings'>> & {
	listCategorySettings?: Record<string, ListCategorySettings | null>;
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
	if (plainValue.listCategorySettings !== undefined && !isRecord(plainValue.listCategorySettings)) return null;
	return patch;
}

export function hasExplicitUserLanguage(settings: UserSettings): boolean {
	return settings.lang === 'de' || settings.lang === 'en';
}

export function applyUserSettingsPatch(base: UserSettings, patch: UserSettingsPatch): UserSettings {
	const { listCategorySettings, ...topLevel } = patch;
	const next: UserSettings = { ...base, ...topLevel };
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
	const { listCategorySettings, ...topLevel } = patch;
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
