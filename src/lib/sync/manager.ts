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

// Fetch mit hartem Abort-Timeout. iOS-PWA-Resume hat oft 5-10 s, in denen der
// Netz-Stack noch eingefroren ist und ein fetch() einfach hängenbleibt — ohne
// Timeout würde der Aufrufer ewig warten und nichts in die Queue stellen.
const DEFAULT_TIMEOUT_MS = 6000;

export async function fetchWithTimeout(url: string, init: RequestInit = {}, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<Response> {
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), timeoutMs);
	try {
		return await fetch(url, { ...init, signal: ctrl.signal });
	} finally {
		clearTimeout(t);
	}
}

async function apiFetch(url: string, options?: RequestInit) {
	const res = await fetchWithTimeout(url, {
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
				case 'create_water_log':
					await apiFetch('/api/water-logs', { method: 'POST', body: JSON.stringify(mutation.payload) });
					break;
				case 'create_caffeine_log':
					await apiFetch('/api/caffeine-logs', { method: 'POST', body: JSON.stringify(mutation.payload) });
					break;
				case 'create_meditation_log':
					await apiFetch('/api/meditation-logs', { method: 'POST', body: JSON.stringify(mutation.payload) });
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
			break; // Netzwerkfehler / Timeout / 5xx — beim nächsten Drain erneut versuchen
		}
	}
	const remaining = await offlineDb.pendingMutations.count();
	networkStore.setPending(remaining);
}

// Öffentliche Variante für Aufrufer außerhalb (resumeOrchestrator).
export function drainPendingMutations(): Promise<void> {
	return processPendingMutations();
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

// ── Tracker-Logs: optimistisch + idempotent ────────────────────────────────────
//
// Einheitlicher Pfad für alle vier Logger (Supplement, Wasser, Koffein, Meditation).
// Reihenfolge bewusst so:
//   1. clientLogId generieren (Idempotenz-Schlüssel, überlebt Retries)
//   2. lokale IDB-Kopie schreiben (UI sieht den Eintrag sofort)
//   3. Mutation in die Queue legen (Drain übernimmt Server-Sync)
//   4. wenn online: einmal sofort drainen (best-effort)
// Bei Timeout/Netzwerk-Fehler bleibt der Eintrag in der Queue und wird beim
// nächsten Online-Event oder Resume erneut versucht. Dank clientLogId entstehen
// auf dem Server keine Duplikate, falls ein Request doch durchging und nur die
// Antwort verloren ging.

async function enqueueLog(
	type: 'create_supplement_log' | 'create_water_log' | 'create_caffeine_log' | 'create_meditation_log',
	payload: Record<string, unknown>,
	localWrite: () => Promise<unknown>
): Promise<void> {
	await localWrite();
	await offlineDb.pendingMutations.add({ type, payload, createdAt: Date.now() });
	networkStore.setPending(await offlineDb.pendingMutations.count());
	if (networkStore.online) void processPendingMutations();
}

export async function logSupplementOffline(args: { supplementId: string; amount: number; loggedAt: number; note: string | null; clientLogId: string }): Promise<void> {
	await enqueueLog(
		'create_supplement_log',
		{ supplementId: args.supplementId, amount: args.amount, loggedAt: args.loggedAt, note: args.note, clientLogId: args.clientLogId },
		() => offlineDb.supplementLogs.put({ id: args.clientLogId, supplementId: args.supplementId, amount: args.amount, loggedAt: args.loggedAt, note: args.note, clientLogId: args.clientLogId })
	);
}

export async function logWaterOffline(args: { amountMl: number; loggedAt: number; clientLogId: string }): Promise<void> {
	await enqueueLog(
		'create_water_log',
		{ amountMl: args.amountMl, loggedAt: args.loggedAt, clientLogId: args.clientLogId },
		() => offlineDb.waterLogs.put({ id: args.clientLogId, amountMl: args.amountMl, loggedAt: args.loggedAt, clientLogId: args.clientLogId })
	);
}

export async function logCaffeineOffline(args: { drinkName: string; amountMl: number; caffeineMg: number; loggedAt: number; clientLogId: string }): Promise<void> {
	await enqueueLog(
		'create_caffeine_log',
		{ drinkName: args.drinkName, amountMl: args.amountMl, caffeineMg: args.caffeineMg, loggedAt: args.loggedAt, clientLogId: args.clientLogId },
		() => offlineDb.caffeineLogs.put({ id: args.clientLogId, drinkName: args.drinkName, amountMl: args.amountMl, caffeineMg: args.caffeineMg, loggedAt: args.loggedAt, clientLogId: args.clientLogId })
	);
}

export async function logMeditationOffline(args: { durationSeconds: number; loggedAt: number; clientLogId: string }): Promise<void> {
	await enqueueLog(
		'create_meditation_log',
		{ durationSeconds: args.durationSeconds, loggedAt: args.loggedAt, clientLogId: args.clientLogId },
		() => offlineDb.meditationLogs.put({ id: args.clientLogId, durationSeconds: args.durationSeconds, loggedAt: args.loggedAt, clientLogId: args.clientLogId })
	);
}

// Liefert noch-nicht-synchronisierte Log-Mutations zurück, gefiltert auf einen
// Zeitraum. Wird von den Load-Funktionen verwendet, um die Server-Antwort um
// optimistische Pending-Einträge zu ergänzen (sonst würden sie aus der UI
// verschwinden, bis der Queue-Drain den Server informiert hat).
export async function getPendingLogs(
	type: 'create_supplement_log' | 'create_water_log' | 'create_caffeine_log' | 'create_meditation_log',
	from: number,
	to: number
): Promise<Array<Record<string, unknown>>> {
	const muts = await offlineDb.pendingMutations.where('type').equals(type).toArray();
	return muts
		.map(m => m.payload)
		.filter(p => {
			const ts = (p as { loggedAt?: number }).loggedAt;
			return typeof ts === 'number' && ts >= from && ts <= to;
		});
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
	// Skip clear() if there are unsynced supplement logs in the queue —
	// clearing would drop optimistic entries that aren't on the server yet.
	// They'll be flushed by processPendingMutations(); afterwards clear() is safe again.
	const pendingCount = await offlineDb.pendingMutations
		.where('type')
		.equals('create_supplement_log')
		.count();
	if (pendingCount === 0) {
		await offlineDb.supplementLogs.clear();
	}
	if (logs.length > 0) await offlineDb.supplementLogs.bulkPut(logs);
}

export async function addOfflineLog(log: OfflineSupplementLog) {
	await offlineDb.supplementLogs.put(log);
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
	// Beim Foregrounding nach Hintergrund-Suspend (besonders iOS): das 'online'-Event
	// feuert dort unzuverlässig. Wir prüfen die Queue zusätzlich bei jedem
	// visibilitychange → visible, damit gestrandete Mutations nicht hängenbleiben.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		offlineDb.pendingMutations.count().then((c) => {
			networkStore.setPending(c);
			if (c > 0) processPendingMutations();
		});
	});
	// Initial prüfen und ggf. sofort abarbeiten
	offlineDb.pendingMutations.count().then((c) => {
		networkStore.setPending(c);
		if (c > 0) processPendingMutations();
	});
}
