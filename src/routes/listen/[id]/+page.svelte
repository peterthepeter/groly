<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ItemTile from '$lib/components/ItemTile.svelte';
	import CheckedDrawer from '$lib/components/CheckedDrawer.svelte';
	import AddItemModal from '$lib/components/AddItemModal.svelte';
	import AddItemBar from '$lib/components/AddItemBar.svelte';
	import { execute, cacheItemsData, getOfflineItems, getOfflineListName, updateOfflineItem, deleteOfflineItem } from '$lib/sync/manager';
	import { t, list_items_open } from '$lib/i18n.svelte';
	import { getCategoryKey } from '$lib/categories';
	import { userSettings } from '$lib/userSettings.svelte';

	let { data } = $props();

	type Item = { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number };

	let listName = $state('');
	let items = $state<Item[]>([]);
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let loading = $state(true);
	let editItem = $state<Item | null>(null);
	let suggestions = $state<string[]>([]);
	let userPermission = $state<'owner' | 'write' | 'read'>('write');
	let searchQuery = $state('');
	let searchOpen = $state(false);

	const listId = $derived($page.params.id);
	const openItems = $derived.by(() => {
		const unchecked = items.filter(i => !i.isChecked);
		if (!userSettings.categorySortEnabled) return unchecked;
		const order = userSettings.categoryOrder;
		return [...unchecked].sort((a, b) => {
			const ai = order.indexOf(getCategoryKey(a.name, a.categoryOverride));
			const bi = order.indexOf(getCategoryKey(b.name, b.categoryOverride));
			// Higher index = top of grid (earlier in array), lower index = bottom (later in array)
			return bi - ai;
		});
	});
	const checkedItems = $derived(
		items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)).slice(0, 6)
	);
	const openCount = $derived(openItems.length);
	const showSearch = $derived(openItems.length >= 5);
	const displayItems = $derived(
		searchQuery.trim()
			? openItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: openItems
	);
	// Empty prefix slots so the grid fills bottom-up (empty slots at top-left)
	const gridPrefix = $derived(displayItems.length % 3 === 0 ? 0 : 3 - (displayItems.length % 3));
	const headerSubtitle = $derived(
		searchQuery.trim()
			? `${displayItems.length} Ergebnis${displayItems.length !== 1 ? 'se' : ''}`
			: list_items_open(openCount)
	);

	async function loadItems() {
		try {
			const [listRes, itemsRes, suggestRes] = await Promise.all([
				fetch(`/api/lists/${listId}`),
				fetch(`/api/lists/${listId}/items`),
				fetch('/api/suggestions')
			]);
			if (!listRes.ok || !itemsRes.ok) throw new Error();
			const listData = await listRes.json();
			listName = listData.name;
			userPermission = listData.userPermission ?? 'write';
			items = await itemsRes.json();
			if (suggestRes.ok) suggestions = await suggestRes.json();
			void cacheItemsData(items);
		} catch {
			listName = await getOfflineListName(listId);
			items = await getOfflineItems(listId);
		}
		loading = false;
	}

	async function toggleItem(item: Item) {
		if (userPermission === 'read') return;
		const newChecked = !item.isChecked;
		const newCheckedAt = newChecked ? Math.floor(Date.now() / 1000) : null;
		const clientUpdatedAt = item.updatedAt;
		await execute(
			() => fetch(`/api/items/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isChecked: newChecked, clientUpdatedAt })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'update_item', payload: { id: item.id, isChecked: newChecked, clientUpdatedAt }, createdAt: Date.now() },
			() => {
				items = items.map(i => i.id === item.id ? { ...i, isChecked: newChecked, checkedAt: newCheckedAt } : i);
				void updateOfflineItem(item.id, { isChecked: newChecked, checkedAt: newCheckedAt, updatedAt: Math.floor(Date.now() / 1000) });
			}
		);
	}

	async function addItem(name: string, quantityInfo: string) {
		const res = await fetch(`/api/lists/${listId}/items`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, quantityInfo })
		});
		if (res.ok) {
			const newItem = await res.json();
			items = [...items, newItem];
			void cacheItemsData(items);
			if (!suggestions.includes(name)) {
				suggestions = [name, ...suggestions].slice(0, 30);
			}
		}
	}

	async function saveEditItem(name: string, quantityInfo: string, categoryOverride: string | null) {
		if (!editItem) return;
		const id = editItem.id;
		const clientUpdatedAt = editItem.updatedAt;
		editItem = null;
		addModalOpen = false;
		await execute(
			() => fetch(`/api/items/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, quantityInfo, categoryOverride, clientUpdatedAt })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'update_item', payload: { id, name, quantityInfo, categoryOverride, clientUpdatedAt }, createdAt: Date.now() },
			() => {
				items = items.map(i => i.id === id ? { ...i, name, quantityInfo: quantityInfo || null, categoryOverride } : i);
				void updateOfflineItem(id, { name, quantityInfo: quantityInfo || null, categoryOverride, updatedAt: Math.floor(Date.now() / 1000) });
			}
		);
	}

	async function deleteItem(id: string) {
		await execute(
			() => fetch(`/api/items/${id}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'delete_item', payload: { id }, createdAt: Date.now() },
			() => {
				items = items.filter(i => i.id !== id);
				void deleteOfflineItem(id);
			}
		);
	}

	onMount(loadItems);

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
	}

	// SSE — Echtzeit-Updates von anderen Usern empfangen, mit Reconnect-Backoff
	$effect(() => {
		const id = listId;
		let retryDelay = 1000;
		let retryTimeout: ReturnType<typeof setTimeout> | null = null;
		let sse: EventSource | null = null;

		function handleMessage(e: MessageEvent) {
			try {
				const ev = JSON.parse(e.data);
				if (ev.byUserId === data.user?.id) return; // eigene Änderungen bereits optimistisch angewendet

				if (ev.type === 'item_added') {
					items = [...items, ev.item];
					void cacheItemsData(items);
				} else if (ev.type === 'item_updated') {
					items = items.map(i => i.id === ev.item.id ? { ...i, ...ev.item } : i);
					void updateOfflineItem(ev.item.id, ev.item);
				} else if (ev.type === 'item_deleted') {
					items = items.filter(i => i.id !== ev.id);
					void deleteOfflineItem(ev.id);
				}
			} catch { /* JSON parse error ignorieren */ }
		}

		function connect() {
			sse = new EventSource(`/api/lists/${id}/events`);
			sse.onopen = () => { retryDelay = 1000; };
			sse.onmessage = handleMessage;
			sse.onerror = () => {
				sse?.close();
				retryTimeout = setTimeout(connect, retryDelay);
				retryDelay = Math.min(retryDelay * 2, 30_000);
			};
		}

		connect();

		return () => {
			sse?.close();
			if (retryTimeout !== null) clearTimeout(retryTimeout);
		};
	});
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={listName || 'Liste'}
		subtitle={headerSubtitle}
		onMenuOpen={() => menuOpen = true}
		onSearch={showSearch && !searchOpen ? () => searchOpen = true : null}
	/>

	<!-- Suchleiste (fixiert unter dem Header, nur wenn aktiv) -->
	{#if searchOpen}
		<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto px-4 py-2"
		     style="top: calc(env(safe-area-inset-top) + 5.25rem); background-color: var(--color-bg)">
			<div class="flex items-center gap-2 rounded-xl px-3 py-2.5"
			     style="background-color: var(--color-surface-low)">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-on-surface-variant)" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					autofocus
					type="text"
					placeholder="Suchen..."
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Escape' && closeSearch()}
					class="flex-1 bg-transparent outline-none text-sm"
					style="color: var(--color-on-surface)"
				/>
				<button
					onclick={closeSearch}
					class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label="Suche schließen"
				>×</button>
			</div>
		</div>
	{/if}

	<!-- Bottom-Anchored Content -->
	<div class="flex-1 flex flex-col justify-end overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + {searchOpen ? '8.75rem' : '5.25rem'}); padding-bottom: 6.5rem">
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else}
			<!-- CheckedDrawer – direkt über den offenen Items -->
			{#if checkedItems.length > 0}
				<CheckedDrawer {checkedItems} totalChecked={items.filter(i => i.isChecked).length} onUncheck={toggleItem} />
			{/if}

			<!-- Open Items 3er-Grid -->
			{#if openItems.length === 0 && checkedItems.length === 0}
				<div class="text-center py-12">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.items_empty}</p>
				</div>
			{:else if displayItems.length === 0 && searchQuery.trim()}
				<div class="text-center py-12">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">Keine Ergebnisse</p>
				</div>
			{:else if displayItems.length > 0}
				<div class="grid grid-cols-3 gap-3 mt-3" style={userSettings.categorySortEnabled ? 'direction: rtl' : ''}>
					{#each { length: gridPrefix } as _}
						<div class="aspect-square"></div>
					{/each}
					{#each displayItems as item (item.id)}
						<ItemTile
							{item}
							onTap={() => toggleItem(item)}
							onLongPress={userPermission !== 'read' ? () => { editItem = item; addModalOpen = true; } : () => {}}
							createdByUsername={item.createdByUsername}
							currentUsername={data.user?.username ?? null}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	{#if !addModalOpen && userPermission !== 'read'}
		<BottomNav onAdd={() => { editItem = null; addModalOpen = true; }} />
	{/if}
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Persistente Eingabeleiste für neue Items -->
{#if addModalOpen && !editItem}
	<AddItemBar
		onAdd={addItem}
		onClose={() => { addModalOpen = false; }}
		{suggestions}
	/>
{/if}

<!-- Modal nur für Bearbeiten -->
{#if addModalOpen && editItem}
	<AddItemModal
		item={editItem}
		onSave={saveEditItem}
		onClose={() => { addModalOpen = false; editItem = null; }}
	/>
{/if}
