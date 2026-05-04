import { offlineDb } from './db';
import type { OfflineList, OfflineItem, OfflineSupplement, OfflineSupplementLog, OfflineRecipe, OfflineRecipeDetail, OfflineWaterLog, OfflineCaffeineLog, OfflineMeditationLog } from './db';
import { networkStore } from '$lib/stores/online.svelte';

export function generateClientId(): string {
	const bytes = new Uint8Array(12);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '');
}

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
				case 'create_supplement_log':
					await apiFetch('/api/supplement-logs', { method: 'POST', body: JSON.stringify(mutation.payload) });
					break;
				case 'delete_supplement_log':
					await apiFetch(`/api/supplement-logs/${mutation.payload.id}`, { method: 'DELETE' });
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
	// Sofort versuchen, die Queue zu leeren (z.B. 409-Konflikte bereinigen)
	if (networkStore.online) void processPendingMutations();
	return null;
}

// ── Listen-Cache ───────────────────────────────────────────────────────────────

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

// ── Supplement-Cache ───────────────────────────────────────────────────────────

export async function cacheSupplements(supplements: OfflineSupplement[]) {
	await offlineDb.supplements.bulkPut(supplements);
}

export async function getOfflineSupplements(): Promise<OfflineSupplement[]> {
	return offlineDb.supplements.toArray();
}

export async function cacheTodayLogs(logs: OfflineSupplementLog[]) {
	await offlineDb.supplementLogs.clear();
	if (logs.length > 0) await offlineDb.supplementLogs.bulkPut(logs);
}

export async function addOfflineLog(log: OfflineSupplementLog) {
	await offlineDb.supplementLogs.put(log);
}

export async function queueOfflineLog(supplementId: string, amount: number, loggedAt: number): Promise<void> {
	const tempId = generateClientId();
	await offlineDb.pendingMutations.add({
		type: 'create_supplement_log',
		payload: { supplementId, amount, loggedAt },
		createdAt: Date.now()
	});
	await addOfflineLog({ id: tempId, supplementId, amount, loggedAt });
	networkStore.setPending(await offlineDb.pendingMutations.count());
}

export async function getOfflineTodayLogs(): Promise<OfflineSupplementLog[]> {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	const start = d.getTime();
	const end = start + 86_400_000 - 1;
	return offlineDb.supplementLogs.where('loggedAt').between(start, end, true, true).toArray();
}

// ── Rezept-Cache ───────────────────────────────────────────────────────────────

export async function cacheRecipes(recipes: OfflineRecipe[]) {
	await offlineDb.recipes.bulkPut(recipes);
}

export async function getOfflineRecipes(): Promise<OfflineRecipe[]> {
	return offlineDb.recipes.toArray();
}

export async function cacheRecipeDetail(detail: OfflineRecipeDetail) {
	await offlineDb.recipeDetails.put(detail);
}

export async function getOfflineRecipeDetail(id: string): Promise<OfflineRecipeDetail | undefined> {
	return offlineDb.recipeDetails.get(id);
}

// ── Wasser-Cache ───────────────────────────────────────────────────────────────

export async function cacheWaterLogs(logs: OfflineWaterLog[]) {
	await offlineDb.waterLogs.bulkPut(logs);
}

export async function getOfflineWaterLogsToday(): Promise<OfflineWaterLog[]> {
	const d = new Date(); d.setHours(0, 0, 0, 0);
	return offlineDb.waterLogs.where('loggedAt').between(d.getTime(), d.getTime() + 86_400_000 - 1, true, true).toArray();
}

// ── Koffein-Cache ──────────────────────────────────────────────────────────────

export async function cacheCaffeineLogs(logs: OfflineCaffeineLog[]) {
	await offlineDb.caffeineLogs.bulkPut(logs);
}

export async function getOfflineCaffeineLogsToday(): Promise<OfflineCaffeineLog[]> {
	const d = new Date(); d.setHours(0, 0, 0, 0);
	return offlineDb.caffeineLogs.where('loggedAt').between(d.getTime(), d.getTime() + 86_400_000 - 1, true, true).toArray();
}

// ── Meditation-Cache ───────────────────────────────────────────────────────────

export async function cacheMeditationLogs(logs: OfflineMeditationLog[]) {
	await offlineDb.meditationLogs.bulkPut(logs);
}

export async function getOfflineMeditationLogsToday(): Promise<OfflineMeditationLog[]> {
	const d = new Date(); d.setHours(0, 0, 0, 0);
	return offlineDb.meditationLogs.where('loggedAt').between(d.getTime(), d.getTime() + 86_400_000 - 1, true, true).toArray();
}

export async function getOfflineMeditationLogsRange(from: number, to: number): Promise<OfflineMeditationLog[]> {
	return offlineDb.meditationLogs.where('loggedAt').between(from, to, true, true).toArray();
}

// ── Init ───────────────────────────────────────────────────────────────────────

export function initSync() {
	if (typeof window === 'undefined') return;
	window.addEventListener('online', () => {
		processPendingMutations();
	});
	// Initial prüfen und ggf. sofort abarbeiten
	offlineDb.pendingMutations.count().then((c) => {
		networkStore.setPending(c);
		if (c > 0) processPendingMutations();
	});
}
