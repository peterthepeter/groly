import { offlineDb } from './db';
import type { OfflineList, OfflineItem } from './db';
import { networkStore } from '$lib/stores/online.svelte';

async function apiFetch(url: string, options?: RequestInit) {
	const res = await fetch(url, {
		...options,
		headers: { 'Content-Type': 'application/json', ...(options?.headers ?? {}) }
	});
	if (!res.ok) {
		const err = new Error(`API error: ${res.status}`) as Error & { status: number };
		err.status = res.status;
		throw err;
	}
	return res.json();
}

async function processPendingMutations() {
	const pending = await offlineDb.pendingMutations.orderBy('createdAt').toArray();
	for (const mutation of pending) {
		try {
			switch (mutation.type) {
				case 'create_list':
					await apiFetch('/api/lists', { method: 'POST', body: JSON.stringify(mutation.payload) });
					break;
				case 'update_list':
					await apiFetch(`/api/lists/${mutation.payload.id}`, { method: 'PUT', body: JSON.stringify(mutation.payload) });
					break;
				case 'delete_list':
					await apiFetch(`/api/lists/${mutation.payload.id}`, { method: 'DELETE' });
					break;
				case 'create_item':
					await apiFetch(`/api/lists/${mutation.payload.listId}/items`, { method: 'POST', body: JSON.stringify(mutation.payload) });
					break;
				case 'update_item':
					await apiFetch(`/api/items/${mutation.payload.id}`, { method: 'PUT', body: JSON.stringify(mutation.payload) });
					break;
				case 'delete_item':
					await apiFetch(`/api/items/${mutation.payload.id}`, { method: 'DELETE' });
					break;
			}
			await offlineDb.pendingMutations.delete(mutation.id!);
		} catch (e: unknown) {
			const status = (e as { status?: number })?.status;
			if (status === 404 || status === 409 || status === 403) {
				// Permanenter Fehler – Mutation überspringen (Item gelöscht, Konflikt oder keine Berechtigung)
				await offlineDb.pendingMutations.delete(mutation.id!);
				continue;
			}
			break; // Netzwerkfehler – beim nächsten Online-Event erneut versuchen
		}
	}
	const remaining = await offlineDb.pendingMutations.count();
	networkStore.setPending(remaining);
}

export async function execute<T>(
	onlineAction: () => Promise<T>,
	offlineMutation: Parameters<typeof offlineDb.pendingMutations.add>[0],
	optimisticUpdate: () => void
): Promise<T | null> {
	optimisticUpdate();

	if (networkStore.online) {
		try {
			return await onlineAction();
		} catch {
			// Fallback zu offline queue
		}
	}

	await offlineDb.pendingMutations.add(offlineMutation);
	const count = await offlineDb.pendingMutations.count();
	networkStore.setPending(count);
	return null;
}

// ── Offline-Cache-Hilfsfunktionen ──────────────────────────────────────────

export async function cacheListsData(lists: OfflineList[]) {
	await offlineDb.lists.bulkPut(lists);
}

export async function getOfflineLists(): Promise<OfflineList[]> {
	return offlineDb.lists.toArray();
}

export async function cacheItemsData(items: OfflineItem[]) {
	await offlineDb.items.bulkPut(items);
}

export async function getOfflineItems(listId: string): Promise<OfflineItem[]> {
	return offlineDb.items.where('listId').equals(listId).toArray();
}

export async function getOfflineListName(listId: string): Promise<string> {
	const list = await offlineDb.lists.get(listId);
	return list?.name ?? '';
}

export async function updateOfflineItem(id: string, changes: Partial<OfflineItem>) {
	await offlineDb.items.update(id, changes);
}

export async function deleteOfflineItem(id: string) {
	await offlineDb.items.delete(id);
}

export async function updateOfflineList(id: string, changes: Partial<OfflineList>) {
	await offlineDb.lists.update(id, changes);
}

export async function deleteOfflineList(id: string) {
	await offlineDb.lists.delete(id);
}

export function initSync() {
	if (typeof window === 'undefined') return;
	window.addEventListener('online', () => {
		processPendingMutations();
	});
	// Initial prüfen
	offlineDb.pendingMutations.count().then((c) => networkStore.setPending(c));
}
