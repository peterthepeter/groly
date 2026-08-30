import { offlineDb } from './db';
import type { OfflineList, OfflineItem, OfflineSupplement, OfflineSupplementLog, OfflineRecipe, OfflineRecipeDetail, OfflineWaterLog, OfflineCaffeineLog, OfflineMeditationLog, OfflineCaffeineDrink, OfflineCategoryPreference, OfflineUserSettings, PendingMutation } from './db';
import { networkStore } from '$lib/stores/online.svelte';
import { isValidCategoryKey } from '$lib/categories';
import { normalizeCategoryPreferenceName, resolveCategoryOverrideForCreate } from '$lib/categoryPreferences';
import type { UserSettings } from '$lib/userSettingsTypes';
import {
	applyUserSettingsPatch,
	combineUserSettingsPatches,
	sanitizeUserSettingsPatch,
	userSettingsPatchMatches,
	type UserSettingsPatch
} from '$lib/userSettingsSync';

let activeUserId: string | null = null;
let syncInitialized = false;
let drainPromise: Promise<void> | null = null;
let drainingUserId: string | null = null;
let drainAgain = false;

type SupplementLogSyncResult = {
	log: OfflineSupplementLog;
	stockQuantity: number | null;
};

type SupplementLogSyncHandler = (result: SupplementLogSyncResult) => void;
const supplementLogSyncHandlers = new Set<SupplementLogSyncHandler>();

export function onSupplementLogSynced(handler: SupplementLogSyncHandler): () => void {
	supplementLogSyncHandlers.add(handler);
	return () => supplementLogSyncHandlers.delete(handler);
}

function readSupplementLogSyncResult(value: unknown): SupplementLogSyncResult | null {
	if (typeof value !== 'object' || value === null) return null;
	const body = value as Record<string, unknown>;
	if (typeof body.log !== 'object' || body.log === null) return null;
	const log = body.log as Record<string, unknown>;
	if (
		typeof log.id !== 'string' ||
		typeof log.supplementId !== 'string' ||
		typeof log.amount !== 'number' ||
		typeof log.loggedAt !== 'number' ||
		(body.stockQuantity !== null && typeof body.stockQuantity !== 'number')
	) return null;
	return {
		log: {
			id: log.id,
			userId: typeof log.userId === 'string' ? log.userId : activeUserId ?? undefined,
			supplementId: log.supplementId,
			amount: log.amount,
			loggedAt: log.loggedAt,
			note: typeof log.note === 'string' ? log.note : null,
			clientLogId: typeof log.clientLogId === 'string' ? log.clientLogId : null,
			stockDeducted: typeof log.stockDeducted === 'number' ? log.stockDeducted : null,
			createdAt: typeof log.createdAt === 'number' ? log.createdAt : undefined
		},
		stockQuantity: body.stockQuantity as number | null
	};
}

async function confirmSupplementLogMutation(
	mutation: PendingMutation,
	result: SupplementLogSyncResult,
	userId: string
): Promise<SupplementLogSyncResult> {
	const clientLogId = typeof mutation.payload.clientLogId === 'string'
		? mutation.payload.clientLogId
		: null;
	let effectiveStock = result.stockQuantity;
	await offlineDb.transaction(
		'rw',
		offlineDb.pendingMutations,
		offlineDb.supplementLogs,
		offlineDb.supplements,
		async () => {
			const laterPendingAmount = (await offlineDb.pendingMutations
				.where('type')
				.equals('create_supplement_log')
				.toArray())
				.filter(entry =>
					entry.id !== mutation.id &&
					(entry.userId === undefined || entry.userId === userId) &&
					entry.payload.supplementId === result.log.supplementId
				)
				.reduce((sum, entry) => sum + (typeof entry.payload.amount === 'number' ? entry.payload.amount : 0), 0);
			effectiveStock = result.stockQuantity == null
				? null
				: Math.max(0, result.stockQuantity - laterPendingAmount);
			if (clientLogId && clientLogId !== result.log.id) {
				await offlineDb.supplementLogs.delete(clientLogId);
			}
			await offlineDb.supplementLogs.put({ ...result.log, userId, localConfirmedAt: Date.now() });
			await offlineDb.supplements.update(result.log.supplementId, {
				stockQuantity: effectiveStock,
				localStockUpdatedAt: Date.now()
			});
			if (mutation.id !== undefined) await offlineDb.pendingMutations.delete(mutation.id);
		}
	);
	const effectiveResult = { ...result, stockQuantity: effectiveStock };
	for (const handler of supplementLogSyncHandlers) handler(effectiveResult);
	return effectiveResult;
}

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

function belongsToActiveUser(mutation: PendingMutation): boolean {
	// Mutationen aus älteren App-Versionen hatten noch keine Besitzer-ID. Sie werden
	// aus Kompatibilitätsgründen beim aktuell angemeldeten Benutzer fertig verarbeitet.
	return mutation.userId === undefined || mutation.userId === activeUserId;
}

async function countActivePendingMutations(): Promise<number> {
	if (!activeUserId) return 0;
	const pending = await offlineDb.pendingMutations.toArray();
	return pending.filter(belongsToActiveUser).length;
}

async function addPendingMutation(mutation: Omit<PendingMutation, 'id'>): Promise<void> {
	await offlineDb.pendingMutations.add({
		...mutation,
		...(mutation.userId ? {} : activeUserId ? { userId: activeUserId } : {})
	});
	networkStore.setPending(await countActivePendingMutations());
}

type SettingsMutationPayload = {
	settings: UserSettingsPatch;
	settingsRevision: number;
	generation: number;
};

type SettingsServerState = {
	settings: UserSettings;
	settingsRevision: number;
};

function readSettingsMutationPayload(mutation: PendingMutation): SettingsMutationPayload | null {
	const settings = sanitizeUserSettingsPatch(mutation.payload.settings);
	const settingsRevision = mutation.payload.settingsRevision;
	const generation = mutation.payload.generation;
	if (
		!settings ||
		!Number.isSafeInteger(settingsRevision) || (settingsRevision as number) < 0 ||
		!Number.isSafeInteger(generation) || (generation as number) < 1
	) return null;
	return {
		settings,
		settingsRevision: settingsRevision as number,
		generation: generation as number
	};
}

function readSettingsServerState(value: unknown): SettingsServerState | null {
	if (typeof value !== 'object' || value === null) return null;
	const body = value as Record<string, unknown>;
	const settings = sanitizeUserSettingsPatch(body.settings);
	if (!settings || !Number.isSafeInteger(body.settingsRevision) || (body.settingsRevision as number) < 0) return null;
	return { settings: settings as UserSettings, settingsRevision: body.settingsRevision as number };
}

async function reconcileSettingsMutation(
	mutationId: number,
	userId: string,
	sentGeneration: number,
	serverState: SettingsServerState,
	sentPatchApplied: boolean
): Promise<boolean> {
	let remainsPending = false;
	await offlineDb.transaction('rw', offlineDb.pendingMutations, offlineDb.userSettings, async () => {
		const latest = await offlineDb.pendingMutations.get(mutationId);
		if (!latest) {
			await offlineDb.userSettings.put({
				userId,
				settings: serverState.settings as Record<string, unknown>,
				revision: serverState.settingsRevision,
				updatedAt: Date.now()
			});
			return;
		}
		const latestPayload = readSettingsMutationPayload(latest);
		if (!latestPayload) throw Object.assign(new Error('Invalid settings mutation'), { status: 400 });
		if (latestPayload.generation === sentGeneration && sentPatchApplied) {
			await offlineDb.pendingMutations.delete(mutationId);
			await offlineDb.userSettings.put({
				userId,
				settings: serverState.settings as Record<string, unknown>,
				revision: serverState.settingsRevision,
				updatedAt: Date.now()
			});
			return;
		}

		remainsPending = true;
		await offlineDb.pendingMutations.update(mutationId, {
			payload: {
				settings: latestPayload.settings,
				settingsRevision: serverState.settingsRevision,
				generation: latestPayload.generation
			}
		});
		await offlineDb.userSettings.put({
			userId,
			settings: applyUserSettingsPatch(serverState.settings, latestPayload.settings) as Record<string, unknown>,
			revision: serverState.settingsRevision,
			updatedAt: Date.now()
		});
	});
	return remainsPending;
}

async function syncPendingUserSettings(mutation: PendingMutation, userId: string): Promise<void> {
	if (mutation.id === undefined) return;
	for (let attempt = 0; attempt < 6; attempt++) {
		if (activeUserId !== userId) return;
		const latest = await offlineDb.pendingMutations.get(mutation.id);
		if (!latest || latest.userId !== userId) return;
		const payload = readSettingsMutationPayload(latest);
		if (!payload) throw Object.assign(new Error('Invalid settings mutation'), { status: 400 });

		const response = await fetchWithTimeout('/api/users/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ settings: payload.settings, settingsRevision: payload.settingsRevision })
		});
		let responseBody: unknown = null;
		try { responseBody = await response.json(); } catch {}
		const serverState = readSettingsServerState(responseBody);

		if (response.status === 409 && serverState) {
			const alreadyApplied = userSettingsPatchMatches(serverState.settings, payload.settings);
			const remains = await reconcileSettingsMutation(
				mutation.id,
				userId,
				payload.generation,
				serverState,
				alreadyApplied
			);
			if (!remains) return;
			continue;
		}
		if (!response.ok) {
			const err = new Error(`API error: ${response.status}`) as Error & { status: number };
			err.status = response.status;
			throw err;
		}
		if (!serverState) throw Object.assign(new Error('Invalid settings response'), { status: 502 });
		const remains = await reconcileSettingsMutation(
			mutation.id,
			userId,
			payload.generation,
			serverState,
			true
		);
		if (!remains) return;
	}
}

async function runPendingMutations(userId: string) {
	const pending = (await offlineDb.pendingMutations.orderBy('createdAt').toArray())
		.filter(mutation => mutation.userId === undefined || mutation.userId === userId);
	for (const mutation of pending) {
		if (activeUserId !== userId) break;
		try {
			let mutationManagesItsOwnQueueEntry = false;
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
					{
						const response = await apiFetch('/api/supplement-logs', { method: 'POST', body: JSON.stringify(mutation.payload) });
						const result = readSupplementLogSyncResult(response);
						if (result) {
							mutationManagesItsOwnQueueEntry = true;
							await confirmSupplementLogMutation(mutation, result, userId);
						}
					}
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
				case 'set_category_preference':
					await apiFetch('/api/category-preferences', { method: 'PUT', body: JSON.stringify(mutation.payload) });
					break;
				case 'delete_category_preference':
					await apiFetch('/api/category-preferences', { method: 'DELETE', body: JSON.stringify(mutation.payload) });
					break;
				case 'update_user_settings':
					mutationManagesItsOwnQueueEntry = true;
					await syncPendingUserSettings(mutation, userId);
					break;
			}
			if (!mutationManagesItsOwnQueueEntry) await offlineDb.pendingMutations.delete(mutation.id!);
		} catch (e: unknown) {
			const status = (e as { status?: number })?.status;
			const isCategoryPreferenceMutation = mutation.type === 'set_category_preference' || mutation.type === 'delete_category_preference';
			const isSettingsMutation = mutation.type === 'update_user_settings';
			if (status === 404 || status === 409 || status === 403 || (
				status === 400 && (isCategoryPreferenceMutation || isSettingsMutation)
			)) {
				// Diese Endpunkte liefern selbst weder 403, 404 noch 409. Solche Antworten
				// stammen daher typischerweise von einem kalten Proxy/WAF und dürfen eine
				// persönliche Lernregel nicht vernichten. Nur echte 400-Validierungsfehler
				// sind dauerhaft.
				if ((isCategoryPreferenceMutation || isSettingsMutation) && status !== 400) continue;
				// Permanenter Fehler – Mutation überspringen (Item gelöscht, Konflikt oder keine Berechtigung)
				// Ausnahme: selbst geloggte Tracker-Einträge NIEMALS wegen 4xx verwerfen.
				// Ein 403/404 ist hier fast immer ein transienter Front-/Proxy-Treffer
				// (z.B. CrowdSec auf den Kaltstart-Request-Burst) — die Create-Endpunkte der
				// App selbst geben gar kein 403 zurück. Verwerfen würde unwiederbringlich
				// Nutzerdaten löschen. Stattdessen behalten und beim nächsten Drain
				// (online / visibilitychange / Öffnen) erneut versuchen; dank clientLogId
				// entstehen dabei keine Duplikate.
				if (
					mutation.type === 'create_supplement_log' ||
					mutation.type === 'create_water_log' ||
					mutation.type === 'create_caffeine_log' ||
					mutation.type === 'create_meditation_log'
				) continue; // in der Queue lassen, nächste Mutation versuchen
				await offlineDb.pendingMutations.delete(mutation.id!);
				continue;
			}
			break; // Netzwerkfehler / Timeout / 5xx — beim nächsten Drain erneut versuchen
		}
	}
	const remaining = await countActivePendingMutations();
	networkStore.setPending(remaining);
}

// Öffentliche Variante für Aufrufer außerhalb (resumeOrchestrator).
export function drainPendingMutations(): Promise<void> {
	if (!activeUserId) return Promise.resolve();
	if (drainPromise) {
		drainAgain = true;
		return drainPromise;
	}
	drainPromise = (async () => {
		do {
			drainAgain = false;
			const userId: string | null = activeUserId;
			if (!userId) return;
			drainingUserId = userId;
			await runPendingMutations(userId);
		} while (activeUserId !== null && (drainAgain || activeUserId !== drainingUserId));
	})().finally(() => {
		drainPromise = null;
		drainingUserId = null;
	});
	return drainPromise;
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

	await addPendingMutation({ ...offlineMutation, userId: activeUserId ?? undefined });
	// Sofort versuchen, die Queue zu leeren (z.B. 409-Konflikte bereinigen)
	if (networkStore.online) void drainPendingMutations();
	return null;
}

type CreateItemMutationPayload = {
	id: string;
	listId: string;
	name: string;
	quantityInfo: string;
	categoryOverride: string | null;
};

/**
 * Item creation is local-first: the visible item and its mutation are committed
 * in one IndexedDB transaction before server sync starts. This removes the data
 * loss window between an optimistic UI update and a failed/aborted network call.
 */
export async function queueItemCreate(
	userId: string,
	item: OfflineItem,
	payload: CreateItemMutationPayload
): Promise<void> {
	await offlineDb.transaction('rw', offlineDb.items, offlineDb.pendingMutations, async () => {
		await offlineDb.items.put(item);
		await offlineDb.pendingMutations.add({
			type: 'create_item',
			userId,
			payload,
			createdAt: Date.now()
		});
	});

	if (activeUserId !== userId) return;
	networkStore.setPending(await countActivePendingMutations());
	if (networkStore.online) void drainPendingMutations();
}

export async function getPendingCreateItems(userId: string, listId: string): Promise<OfflineItem[]> {
	const pending = (await offlineDb.pendingMutations.where('type').equals('create_item').toArray())
		.filter((mutation) =>
			(mutation.userId === undefined || mutation.userId === userId) &&
			mutation.payload.listId === listId &&
			typeof mutation.payload.id === 'string'
		);
	const rows = await offlineDb.items.bulkGet(pending.map((mutation) => mutation.payload.id as string));
	return rows.filter((item): item is OfflineItem => item !== undefined);
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
	await addPendingMutation({ type, payload, createdAt: Date.now(), userId: activeUserId ?? undefined });
	if (networkStore.online) void drainPendingMutations();
}

export async function logSupplementOffline(args: { supplementId: string; amount: number; loggedAt: number; note: string | null; clientLogId: string }): Promise<void> {
	await offlineDb.transaction(
		'rw',
		offlineDb.supplementLogs,
		offlineDb.supplements,
		offlineDb.pendingMutations,
		async () => {
			await offlineDb.supplementLogs.put({
				id: args.clientLogId,
				...(activeUserId ? { userId: activeUserId } : {}),
				supplementId: args.supplementId,
				amount: args.amount,
				loggedAt: args.loggedAt,
				note: args.note,
				clientLogId: args.clientLogId
			});
			const supplement = await offlineDb.supplements.get(args.supplementId);
			if (supplement?.stockQuantity != null) {
				const stockDeducted = Math.min(Math.max(0, supplement.stockQuantity), args.amount);
				await offlineDb.supplementLogs.update(args.clientLogId, { stockDeducted });
				await offlineDb.supplements.update(args.supplementId, {
					stockQuantity: Math.max(0, supplement.stockQuantity - args.amount),
					localStockUpdatedAt: Date.now()
				});
			}
			await offlineDb.pendingMutations.add({
				type: 'create_supplement_log',
				payload: {
					supplementId: args.supplementId,
					amount: args.amount,
					loggedAt: args.loggedAt,
					note: args.note,
					clientLogId: args.clientLogId
				},
				createdAt: Date.now(),
				...(activeUserId ? { userId: activeUserId } : {})
			});
		}
	);
	networkStore.setPending(await countActivePendingMutations());
	if (networkStore.online) void drainPendingMutations();
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
	return muts.filter(belongsToActiveUser)
		.map(m => m.payload)
		.filter(p => {
			const ts = (p as { loggedAt?: number }).loggedAt;
			return typeof ts === 'number' && ts >= from && ts <= to;
		});
}

// ── Persönliche Kategorie-Präferenzen ────────────────────────────────────────

async function sendOrQueueCategoryPreference(
	type: 'set_category_preference' | 'delete_category_preference',
	userId: string,
	payload: { name: string; categoryOverride?: string }
): Promise<void> {
	if (networkStore.online && activeUserId === userId) {
		try {
			await apiFetch('/api/category-preferences', {
				method: type === 'set_category_preference' ? 'PUT' : 'DELETE',
				body: JSON.stringify(payload)
			});
			return;
		} catch {
			// Antwort verloren oder Server nicht erreichbar: idempotent nachstellen.
		}
	}

	await addPendingMutation({ type, userId, payload, createdAt: Date.now() });
}

export async function setCategoryPreferenceOffline(userId: string, name: string, categoryOverride: string): Promise<void> {
	const normalizedName = normalizeCategoryPreferenceName(name);
	if (!normalizedName || !isValidCategoryKey(categoryOverride)) return;
	await offlineDb.categoryPreferences.put({ userId, normalizedName, categoryOverride, updatedAt: Date.now() });
	await sendOrQueueCategoryPreference('set_category_preference', userId, { name: normalizedName, categoryOverride });
}

export async function deleteCategoryPreferenceOffline(userId: string, name: string): Promise<void> {
	const normalizedName = normalizeCategoryPreferenceName(name);
	if (!normalizedName) return;
	await offlineDb.categoryPreferences.delete([userId, normalizedName]);
	await sendOrQueueCategoryPreference('delete_category_preference', userId, { name: normalizedName });
}

export async function getOfflineCategoryPreferences(userId: string): Promise<Map<string, string>> {
	const rows = await offlineDb.categoryPreferences.where('userId').equals(userId).toArray();
	return new Map(rows.map(row => [row.normalizedName, row.categoryOverride]));
}

export async function getCategoryOverrideForCreate(
	userId: string,
	name: string,
	favoriteOverride?: string | null
): Promise<string | null> {
	return resolveCategoryOverrideForCreate(name, favoriteOverride, await getOfflineCategoryPreferences(userId));
}

export async function refreshCategoryPreferences(userId: string): Promise<void> {
	if (activeUserId !== userId) return;
	await drainPendingMutations();
	const syncStartedAt = Date.now();
	let serverRows: OfflineCategoryPreference[];
	try {
		const response = await fetchWithTimeout('/api/category-preferences');
		if (!response.ok) return;
		const rows = await response.json() as Array<Partial<OfflineCategoryPreference>>;
		serverRows = rows.flatMap(row =>
			typeof row.normalizedName === 'string' && isValidCategoryKey(row.categoryOverride)
				? [{
					userId,
					normalizedName: normalizeCategoryPreferenceName(row.normalizedName),
					categoryOverride: row.categoryOverride,
					updatedAt: syncStartedAt
				}]
				: []
		).filter(row => row.normalizedName.length > 0);
	} catch {
		return;
	}

	await offlineDb.transaction('rw', offlineDb.categoryPreferences, offlineDb.pendingMutations, async () => {
		const localRows = await offlineDb.categoryPreferences.where('userId').equals(userId).toArray();
		const concurrentRows = localRows.filter(row => row.updatedAt >= syncStartedAt);
		await offlineDb.categoryPreferences.where('userId').equals(userId).delete();
		if (serverRows.length > 0) await offlineDb.categoryPreferences.bulkPut(serverRows);
		if (concurrentRows.length > 0) await offlineDb.categoryPreferences.bulkPut(concurrentRows);

		const pending = (await offlineDb.pendingMutations.orderBy('createdAt').toArray())
			.filter(mutation => mutation.userId === userId && (
				mutation.type === 'set_category_preference' || mutation.type === 'delete_category_preference'
			));
		for (const mutation of pending) {
			const normalizedName = normalizeCategoryPreferenceName(String(mutation.payload.name ?? ''));
			if (!normalizedName) continue;
			if (mutation.type === 'delete_category_preference') {
				await offlineDb.categoryPreferences.delete([userId, normalizedName]);
			} else if (isValidCategoryKey(mutation.payload.categoryOverride)) {
				await offlineDb.categoryPreferences.put({
					userId,
					normalizedName,
					categoryOverride: mutation.payload.categoryOverride,
					updatedAt: Date.now()
				});
			}
		}
	});
}

// ── Benutzereinstellungen: offline + revisionsgeschützt ──────────────────────

async function getPendingSettingsMutations(userId: string): Promise<PendingMutation[]> {
	return (await offlineDb.pendingMutations.where('type').equals('update_user_settings').toArray())
		.filter(mutation => mutation.userId === userId)
		.sort((a, b) => a.createdAt - b.createdAt);
}

export async function queueUserSettingsPatch(
	userId: string,
	patch: UserSettingsPatch,
	effectiveSettings: UserSettings
): Promise<void> {
	await offlineDb.transaction('rw', offlineDb.pendingMutations, offlineDb.userSettings, async () => {
		const existingMutations = await getPendingSettingsMutations(userId);
		const primary = existingMutations[0];
		const cached = await offlineDb.userSettings.get(userId);
		let combined = patch;
		let settingsRevision = cached?.revision ?? 0;
		let generation = 1;

		if (primary) {
			const payload = readSettingsMutationPayload(primary);
			if (payload) {
				combined = combineUserSettingsPatches(payload.settings, patch);
				settingsRevision = payload.settingsRevision;
				generation = payload.generation + 1;
			}
		}

		const payload: Record<string, unknown> = {
			settings: combined,
			settingsRevision,
			generation
		};
		if (primary?.id !== undefined) {
			await offlineDb.pendingMutations.update(primary.id, { payload, createdAt: Date.now() });
			for (const duplicate of existingMutations.slice(1)) {
				if (duplicate.id !== undefined) await offlineDb.pendingMutations.delete(duplicate.id);
			}
		} else {
			await offlineDb.pendingMutations.add({
				type: 'update_user_settings',
				userId,
				payload,
				createdAt: Date.now()
			});
		}

		await offlineDb.userSettings.put({
			userId,
			settings: effectiveSettings as Record<string, unknown>,
			revision: settingsRevision,
			updatedAt: Date.now()
		});
	});
	if (activeUserId === userId) networkStore.setPending(await countActivePendingMutations());
}

export async function getOfflineUserSettings(userId: string): Promise<OfflineUserSettings | undefined> {
	return offlineDb.userSettings.get(userId);
}

export async function refreshUserSettings(
	userId: string,
	serverSeed: SettingsServerState
): Promise<OfflineUserSettings> {
	const existing = await offlineDb.userSettings.get(userId);
	const seedRevision = Number.isSafeInteger(serverSeed.settingsRevision) && serverSeed.settingsRevision >= 0
		? serverSeed.settingsRevision
		: 0;
	const pendingBeforeSeed = await getPendingSettingsMutations(userId);
	let seededSettings = serverSeed.settings;
	for (const mutation of pendingBeforeSeed) {
		const payload = readSettingsMutationPayload(mutation);
		if (payload) seededSettings = applyUserSettingsPatch(seededSettings, payload.settings);
	}
	if (!existing || seedRevision >= existing.revision) {
		await offlineDb.userSettings.put({
			userId,
			settings: seededSettings as Record<string, unknown>,
			revision: seedRevision,
			updatedAt: Date.now()
		});
	}

	if (activeUserId === userId) await drainPendingMutations();
	if (activeUserId !== userId) {
		return (await offlineDb.userSettings.get(userId)) ?? {
			userId,
			settings: seededSettings as Record<string, unknown>,
			revision: seedRevision,
			updatedAt: Date.now()
		};
	}

	try {
		const response = await fetchWithTimeout('/api/users/me', { cache: 'no-store' });
		if (!response.ok) throw new Error(`API error: ${response.status}`);
		const serverState = readSettingsServerState(await response.json());
		if (!serverState) throw new Error('Invalid settings response');
		let effective = serverState.settings;
		const pending = await getPendingSettingsMutations(userId);
		for (const mutation of pending) {
			const payload = readSettingsMutationPayload(mutation);
			if (payload) effective = applyUserSettingsPatch(effective, payload.settings);
		}
		const row: OfflineUserSettings = {
			userId,
			settings: effective as Record<string, unknown>,
			revision: serverState.settingsRevision,
			updatedAt: Date.now()
		};
		await offlineDb.userSettings.put(row);
		return row;
	} catch {
		return (await offlineDb.userSettings.get(userId)) ?? {
			userId,
			settings: seededSettings as Record<string, unknown>,
			revision: seedRevision,
			updatedAt: Date.now()
		};
	}
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
	const rows = supplements.map(supplement => ({
		...supplement,
		...(activeUserId ? { userId: activeUserId } : {})
	}));
	await offlineDb.supplements.bulkPut(rows);
}

// A server read can race with a local log and still return the old stock. The
// IndexedDB value wins while a log is pending and also when the local stock was
// confirmed after this particular GET had already started.
export async function mergePendingSupplementStock<T extends { id: string; stockQuantity: number | null }>(
	serverSupplements: T[],
	requestStartedAt = 0
): Promise<T[]> {
	const pending = (await offlineDb.pendingMutations
		.where('type')
		.equals('create_supplement_log')
		.toArray())
		.filter(belongsToActiveUser);
	const pendingIds = new Set(
		pending
			.map(mutation => mutation.payload.supplementId)
			.filter((id): id is string => typeof id === 'string')
	);
	const cachedRows = await offlineDb.supplements.bulkGet(serverSupplements.map(supplement => supplement.id));
	const cachedById = new Map(
		cachedRows
			.filter((row): row is OfflineSupplement =>
				row !== undefined && (!activeUserId || row.userId === undefined || row.userId === activeUserId)
			)
			.map(row => [row.id, row])
	);
	return serverSupplements.map(supplement => {
		const cached = cachedById.get(supplement.id);
		const localStockUpdatedAt = cached?.localStockUpdatedAt ?? 0;
		const localWriteWonRace = localStockUpdatedAt > 0 && localStockUpdatedAt >= requestStartedAt;
		return cached && (pendingIds.has(supplement.id) || localWriteWonRace)
			? { ...supplement, stockQuantity: cached.stockQuantity }
			: supplement;
	});
}

export async function getOfflineSupplements(): Promise<OfflineSupplement[]> {
	const rows = await offlineDb.supplements.toArray();
	return activeUserId ? rows.filter(row => row.userId === activeUserId) : [];
}

export async function cacheTodayLogs(logs: OfflineSupplementLog[], requestStartedAt = 0): Promise<OfflineSupplementLog[]> {
	if (!activeUserId) return logs;
	const userId = activeUserId;
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	const from = d.getTime();
	const next = new Date(d);
	next.setDate(next.getDate() + 1);
	const to = next.getTime() - 1;
	return offlineDb.transaction('rw', offlineDb.supplementLogs, async () => {
		const localRows = (await offlineDb.supplementLogs.where('loggedAt').between(from, to, true, true).toArray())
			.filter(row => row.userId === userId);
		const serverClientIds = new Set(logs.map(log => log.clientLogId).filter((id): id is string => typeof id === 'string'));
		const preserved = localRows.filter(row => {
			if (!row.clientLogId || serverClientIds.has(row.clientLogId)) return false;
			const localConfirmedAt = row.localConfirmedAt ?? 0;
			return row.id === row.clientLogId || (localConfirmedAt > 0 && localConfirmedAt >= requestStartedAt);
		});
		if (localRows.length > 0) await offlineDb.supplementLogs.bulkDelete(localRows.map(row => row.id));
		const serverRows = logs.map(log => ({ ...log, userId }));
		const merged = [...serverRows, ...preserved];
		if (merged.length > 0) await offlineDb.supplementLogs.bulkPut(merged);
		return merged.sort((a, b) => a.loggedAt - b.loggedAt);
	});
}

export async function addOfflineLog(log: OfflineSupplementLog) {
	await offlineDb.supplementLogs.put(log);
}

export async function getOfflineTodayLogs(): Promise<OfflineSupplementLog[]> {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	const start = d.getTime();
	const next = new Date(d);
	next.setDate(next.getDate() + 1);
	const end = next.getTime() - 1;
	const rows = await offlineDb.supplementLogs.where('loggedAt').between(start, end, true, true).toArray();
	return activeUserId ? rows.filter(row => row.userId === activeUserId) : [];
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

// Koffein-Getränke-Katalog (admin-verwaltet, kein Pending-State) — voller Ersatz
// des Caches, damit Löschungen mitgezogen werden. Ermöglicht Offline-Loggen.
export async function cacheCaffeineDrinks(drinks: OfflineCaffeineDrink[]) {
	await offlineDb.caffeineDrinks.clear();
	if (drinks.length > 0) await offlineDb.caffeineDrinks.bulkPut(drinks);
}

export async function getOfflineCaffeineDrinks(): Promise<OfflineCaffeineDrink[]> {
	return offlineDb.caffeineDrinks.orderBy('sortOrder').toArray();
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

export function initSync(userId: string | null = null) {
	activeUserId = userId;
	if (typeof window === 'undefined') return;
	void countActivePendingMutations().then(count => networkStore.setPending(count));
	if (syncInitialized) {
		if (userId) void drainPendingMutations();
		return;
	}
	syncInitialized = true;
	window.addEventListener('online', () => {
		drainPendingMutations();
	});
	// Beim Foregrounding nach Hintergrund-Suspend (besonders iOS): das 'online'-Event
	// feuert dort unzuverlässig. Wir prüfen die Queue zusätzlich bei jedem
	// visibilitychange → visible, damit gestrandete Mutations nicht hängenbleiben.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		countActivePendingMutations().then((c) => {
			networkStore.setPending(c);
			if (c > 0) drainPendingMutations();
		});
	});
	// Wenn nur der Server kurz nicht erreichbar war, feuert der Browser kein neues
	// `online`-Event. Solange die App sichtbar ist, werden liegengebliebene Writes
	// deshalb regelmäßig erneut versucht.
	setInterval(() => {
		if (document.visibilityState !== 'visible' || !networkStore.online) return;
		countActivePendingMutations().then((count) => {
			if (count > 0) void drainPendingMutations();
		});
	}, 30_000);
	// Initial prüfen und ggf. sofort abarbeiten
	countActivePendingMutations().then((c) => {
		networkStore.setPending(c);
		if (c > 0) drainPendingMutations();
	});
}
