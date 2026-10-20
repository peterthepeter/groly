import type { Shortcut, ShortcutAction } from '#lib/userSettingsTypes';

export const SHORTCUT_ACTIONS: ShortcutAction[] = ['go', 'add', 'scanner', 'log-tracker', 'log-supplement'];
export const MAX_SHORTCUTS = 4;

export function isShortcutAction(action: unknown): action is ShortcutAction {
	return typeof action === 'string' && SHORTCUT_ACTIONS.includes(action as ShortcutAction);
}

export function shortcutNeedsList(action: ShortcutAction): boolean {
	return action === 'go' || action === 'add' || action === 'scanner';
}

// Remove retired actions from both stored settings and older clients' queued writes.
export function normalizeShortcuts(value: unknown): Shortcut[] {
	if (!Array.isArray(value)) return [];
	const result: Shortcut[] = [];
	const ids = new Set<string>();
	for (const entry of value) {
		if (!entry || typeof entry !== 'object' || typeof entry.id !== 'string' || !entry.id
			|| ids.has(entry.id) || typeof entry.name !== 'string' || !entry.name.trim() || !isShortcutAction(entry.action)) continue;
		if (shortcutNeedsList(entry.action) && (typeof entry.listId !== 'string' || !entry.listId)) continue;
		const shortcut: Shortcut = { id: entry.id, name: entry.name.trim(), action: entry.action };
		if (shortcutNeedsList(entry.action)) {
			shortcut.listId = entry.listId;
			if (typeof entry.listName === 'string') shortcut.listName = entry.listName;
		}
		ids.add(shortcut.id);
		result.push(shortcut);
		if (result.length === MAX_SHORTCUTS) break;
	}
	return result;
}

export function shortcutTarget(shortcut: Shortcut): string | null {
	if (!isShortcutAction(shortcut.action)) return null;
	if (!shortcutNeedsList(shortcut.action)) return `/tracker?action=${shortcut.action}`;
	if (!shortcut.listId) return null;
	return `/listen/${encodeURIComponent(shortcut.listId)}${shortcut.action === 'go' ? '' : `?action=${shortcut.action}`}`;
}
