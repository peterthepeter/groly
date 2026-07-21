import type { ListCategorySettings, UserSettings } from '$lib/userSettingsTypes';

export type UserSettingsPatch = Partial<Omit<UserSettings, 'listCategorySettings'>> & {
	listCategorySettings?: Record<string, ListCategorySettings | null>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeUserSettingsPatch(value: unknown): UserSettingsPatch | null {
	if (!isRecord(value)) return null;
	const patch = { ...value } as UserSettingsPatch;
	if (value.listCategorySettings !== undefined && !isRecord(value.listCategorySettings)) return null;
	return patch;
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
