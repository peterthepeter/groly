import { offlineDb, type AccountCache, type OfflineItem, type OfflineList } from './db';

/** Preserve legacy mutations, but never assign them to whoever logs in next. */
export async function migrateAccountCache(legacyOwner: string | null): Promise<void> {
	await offlineDb.transaction('rw', offlineDb.tables, async () => {
		if (await offlineDb.cacheMeta.get('account-ownership-v1')) return;
		const pending = await offlineDb.pendingMutations.toArray();
		for (const mutation of pending) {
			if (!mutation.userId && legacyOwner) {
				mutation.userId = legacyOwner;
				await offlineDb.pendingMutations.put(mutation);
			}
		}
		const lists = await offlineDb.lists.toArray();
		const ownedLists = new Map(lists.filter(row => row.ownerId === legacyOwner).map(row => [row.id, legacyOwner!]));
		const details = await offlineDb.recipeDetails.toArray();
		const recipeOwners = new Map(details.filter(row => row.userId).map(row => [row.id, row.userId!]));
		for (const table of [offlineDb.lists, offlineDb.items, offlineDb.supplements, offlineDb.supplementLogs, offlineDb.recipes, offlineDb.recipeDetails, offlineDb.waterLogs, offlineDb.caffeineLogs, offlineDb.meditationLogs]) {
			for (const row of await table.toArray()) {
				if (row.cacheUserId) continue;
				const mutation = pending.find(entry => entry.userId && (entry.payload.id === row.id || entry.payload.clientLogId === row.id));
				const owner = row.userId ?? mutation?.userId
					?? (table.name === 'lists' ? ownedLists.get(row.id) : undefined)
					?? (table.name === 'items' ? ownedLists.get((row as { listId: string }).listId) : undefined)
					?? (table.name === 'recipes' ? recipeOwners.get(row.id) : undefined);
				if (owner) {
					await table.update(row.id, { cacheUserId: owner });
					if (table.name === 'lists') await offlineDb.accountLists.put({ ...row as OfflineList, cacheUserId: owner });
					if (table.name === 'items') await offlineDb.accountItems.put({ ...row as OfflineItem, cacheUserId: owner });
				}
			}
		}
		// Ambiguous old read caches stay stored but hidden until a fresh authorized
		// response replaces them. Unattributed mutations are retained, never replayed
		// under a guessed account. Supported 0.9.x clients record the settings owner.
		await offlineDb.cacheMeta.put({ key: 'account-ownership-v1', value: legacyOwner });
	});
}

export function cachedForUser(row: AccountCache, userId: string | null): boolean {
	return userId !== null && (row.cacheUserId ?? row.userId) === userId;
}
