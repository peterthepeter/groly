<script lang="ts">
	import { onMount, onDestroy, tick } from 'svelte';
	import { on } from '$lib/sseStore.svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ItemTile from '$lib/components/ItemTile.svelte';
	import ItemRow from '$lib/components/ItemRow.svelte';
	import CheckedDrawer from '$lib/components/CheckedDrawer.svelte';
	import AddItemModal from '$lib/components/AddItemModal.svelte';
	import AddItemBar from '$lib/components/AddItemBar.svelte';
	import { execute, generateClientId, cacheItemsData, getOfflineItems, getOfflineListName, updateOfflineItem, deleteOfflineItem } from '$lib/sync/manager';
	import { t, list_items_open } from '$lib/i18n.svelte';
	import { getCategoryKey } from '$lib/categories';
	import { userSettings } from '$lib/userSettings.svelte';

	const LISTVIEW_HINT_KEY = 'groly_listview_hint_dismissed';
	const LOCATION_HINT_KEY = 'groly_location_hint_dismissed';
	let showListViewHint = $state(false);
	let showLocationHint = $state(false);

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
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let autoScannerOnOpen = $state(false);
	let itemsLoadVersion = 0;

	const listId = $derived($page.params.id);
	const openItems = $derived.by(() => {
		const unchecked = items.filter(i => !i.isChecked);
		const listSettings = listId ? userSettings.getListCategorySettings(listId) : null;
		const sortEnabled = listSettings !== null ? listSettings.enabled : userSettings.categorySortEnabled;
		if (!sortEnabled) return unchecked;
		const order = listSettings !== null ? listSettings.order : userSettings.categoryOrder;
		const orderIndex = new Map(order.map((key, index) => [key, index]));
		return [...unchecked].sort((a, b) => {
			const ai = orderIndex.get(getCategoryKey(a.name, a.categoryOverride)) ?? -1;
			const bi = orderIndex.get(getCategoryKey(b.name, b.categoryOverride)) ?? -1;
			// Higher index = top of grid (earlier in array), lower index = bottom (later in array)
			return bi - ai;
		});
	});
	const checkedItems = $derived(
		items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)).slice(0, 16)
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
		const targetListId = listId ?? '';
		const requestVersion = ++itemsLoadVersion;

		// Gecachte Daten sofort anzeigen, während der Netzwerk-Fetch läuft (stale-while-revalidate)
		if (items.length === 0) {
			const [cachedName, cachedItems] = await Promise.all([
				getOfflineListName(targetListId),
				getOfflineItems(targetListId)
			]);
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			if (cachedItems.length > 0) {
				listName = cachedName || listName;
				items = cachedItems.map(item => ({ ...item, createdByUsername: null }));
				loading = false;
				await tick();
				scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
			}
		}

		try {
			const [listRes, itemsRes, suggestRes] = await Promise.all([
				fetch(`/api/lists/${targetListId}`),
				fetch(`/api/lists/${targetListId}/items`),
				fetch('/api/suggestions')
			]);
			if (!listRes.ok || !itemsRes.ok) throw new Error();
			const listData = await listRes.json();
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			listName = listData.name;
			userPermission = listData.userPermission ?? 'write';
			const newItems: Item[] = await itemsRes.json();
			if (suggestRes.ok) suggestions = await suggestRes.json();
			// Cache als plain objects (vor State-Zuweisung)
			void cacheItemsData(newItems);
			items = newItems;
		} catch {
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			if (items.length === 0) {
				listName = await getOfflineListName(targetListId);
				if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
				items = (await getOfflineItems(targetListId)).map(item => ({ ...item, createdByUsername: null }));
			}
		}
		if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
		loading = false;
		await tick();
		scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
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
		const id = generateClientId();
		const optimisticItem: Item = {
			id, listId: listId ?? '', name: name.trim(),
			quantityInfo: quantityInfo.trim() || null,
			isChecked: false, checkedAt: null, categoryOverride: null,
			createdByUsername: data.user?.username ?? null,
			updatedAt: Math.floor(Date.now() / 1000)
		};
		await execute(
			() => fetch(`/api/lists/${listId}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id, name, quantityInfo })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'create_item', payload: { id, listId: listId ?? '', name, quantityInfo }, createdAt: Date.now() },
			() => {
				items = [...items, optimisticItem];
				void cacheItemsData(items);
				if (!suggestions.includes(name)) {
					suggestions = [name, ...suggestions].slice(0, 30);
				}
			}
		);
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

	afterNavigate(({ to, from }) => {
		const fromId = from?.params?.id;
		const toId = to?.params?.id;

		// When navigating between different lists (component is reused by SvelteKit),
		// reset state so we don't briefly show the old list's items.
		if (fromId && toId && fromId !== toId) {
			items = [];
			loading = true;
			listName = '';
			addModalOpen = false;
			editItem = null;
			void loadItems();
		}

		// Handle shortcut ?action param — fires on every navigation incl. same-route
		const action = to?.url.searchParams.get('action');
		if (action === 'add' || action === 'scanner') {
			editItem = null;
			addModalOpen = true;
			autoScannerOnOpen = action === 'scanner';
			// Clean the URL so refreshing doesn't re-trigger the action
			history.replaceState({}, '', window.location.pathname);
		}
	});

	onMount(() => {
		void loadItems();
		const handleOnline = () => void loadItems();
		window.addEventListener('online', handleOnline);

		// Hinweis-Banner für kleine Bildschirme (< 374px), einmalig pro Gerät
		if (
			window.innerWidth < 374 &&
			userSettings.itemLayout === 'grid' &&
			!localStorage.getItem(LISTVIEW_HINT_KEY)
		) {
			showListViewHint = true;
		}

		// Hinweis-Banner für Location Service, einmalig pro Gerät
		if (
			!userSettings.locationNavEnabled &&
			!localStorage.getItem(LOCATION_HINT_KEY)
		) {
			showLocationHint = true;
		}

		return () => window.removeEventListener('online', handleOnline);
	});

	function dismissListViewHint(navigate = false) {
		showListViewHint = false;
		localStorage.setItem(LISTVIEW_HINT_KEY, '1');
		if (navigate) goto('/einstellungen');
	}

	function dismissLocationHint(navigate = false) {
		showLocationHint = false;
		localStorage.setItem(LOCATION_HINT_KEY, '1');
		if (navigate) goto('/einstellungen?expand=location');
	}

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
	}

	// SSE — Echtzeit-Updates via globalem SSE-Kanal (Verbindung liegt im Root-Layout)
	let sseConnectedSinceMount = false;
	const offHandlers = [
		on('sse_connected', () => {
			// Beim Reconnect Items neu laden (bei erstem Connect schon via onMount geschehen)
			if (sseConnectedSinceMount) void loadItems();
			sseConnectedSinceMount = true;
		}),
		on('item_added', (ev) => {
			if (ev.listId !== listId) return;
			if (!items.some(i => i.id === (ev.item as Item).id)) {
				items = [...items, ev.item as Item];
				void cacheItemsData(items);
			}
		}),
		on('item_updated', (ev) => {
			if (ev.listId !== listId) return;
			items = items.map(i => i.id === (ev.item as Item).id ? { ...i, ...(ev.item as Item) } : i);
			void updateOfflineItem((ev.item as Item).id, ev.item as Partial<Item>);
		}),
		on('item_deleted', (ev) => {
			if (ev.listId !== listId) return;
			items = items.filter(i => i.id !== ev.id);
			void deleteOfflineItem(ev.id as string);
		}),
	];

	onDestroy(() => offHandlers.forEach(off => off()));
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
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

	<!-- Hinweis-Banner für kleine Bildschirme -->
	{#if showListViewHint}
		<div class="fixed left-0 right-0 z-20 max-w-[430px] mx-auto px-4 pointer-events-none"
		     style="top: calc(env(safe-area-inset-top) + 5.5rem)">
			<div class="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl pointer-events-auto"
			     style="background-color: var(--color-surface-elevated); border: 1px solid var(--color-outline-variant)">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<div class="flex-1 min-w-0">
					<p class="text-xs leading-snug" style="color: var(--color-on-surface-variant)">{t.listview_hint_text}</p>
					<button
						onclick={() => dismissListViewHint(true)}
						class="text-xs font-semibold mt-0.5"
						style="color: var(--color-primary)"
					>{t.listview_hint_action}</button>
				</div>
				<button
					onclick={() => dismissListViewHint(false)}
					class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label="Hinweis schließen"
				>×</button>
			</div>
		</div>
	{/if}

	<!-- Location-Hint-Banner -->
	{#if showLocationHint}
		<div class="fixed left-0 right-0 z-20 max-w-[430px] mx-auto px-4 pointer-events-none"
		     style="top: calc(env(safe-area-inset-top) + 5.5rem + {showListViewHint ? '3.5rem' : '0px'})">
			<div class="flex items-center gap-3 px-3.5 py-2.5 rounded-2xl pointer-events-auto"
			     style="background-color: var(--color-surface-elevated); border: 1px solid var(--color-outline-variant)">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				<div class="flex-1 min-w-0">
					<p class="text-xs leading-snug" style="color: var(--color-on-surface-variant)">{t.location_hint_text}</p>
					<button
						onclick={() => dismissLocationHint(true)}
						class="text-xs font-semibold mt-0.5"
						style="color: var(--color-primary)"
					>{t.location_hint_action}</button>
				</div>
				<button
					onclick={() => dismissLocationHint(false)}
					class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label="Hinweis schließen"
				>×</button>
			</div>
		</div>
	{/if}

	<!-- Bottom-Anchored Content -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + 5.25rem + {searchOpen ? '3.5rem' : '0px'} + {showListViewHint ? '3.5rem' : '0px'} + {showLocationHint ? '3.5rem' : '0px'}); padding-bottom: 5rem">
		<div class="min-h-full flex flex-col justify-end">
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else}
			<!-- CheckedDrawer – direkt über den offenen Items -->
			{#if checkedItems.length > 0}
				<CheckedDrawer {checkedItems} totalChecked={items.filter(i => i.isChecked).length} onUncheck={toggleItem} layout={userSettings.itemLayout} />
			{/if}

			{#if openItems.length === 0 && checkedItems.length === 0}
				<div class="text-center py-12">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.items_empty}</p>
				</div>
			{:else if displayItems.length === 0 && searchQuery.trim()}
				<div class="text-center py-12">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">Keine Ergebnisse</p>
				</div>
			{:else if displayItems.length > 0}

				{#if userSettings.itemLayout === 'list'}
					<!-- Listen-Ansicht: vertikale Zeilen, von unten nach oben -->
					<div class="flex flex-col gap-1 mt-2">
						{#each displayItems as item (item.id)}
							<div class="rounded-2xl overflow-hidden">
								<ItemRow
									{item}
									onTap={() => toggleItem(item)}
									onLongPress={userPermission !== 'read' ? () => { editItem = item; addModalOpen = true; } : () => {}}
									createdByUsername={item.createdByUsername}
									currentUsername={data.user?.username ?? null}
								/>
							</div>
						{/each}
					</div>
				{:else}
				<!-- Kachel-Ansicht: 3er-Grid -->
				<div class="grid grid-cols-3 gap-2 mt-3" style={userSettings.categorySortEnabled ? 'direction: rtl' : ''}>
					{#if userSettings.categorySortEnabled}
						{#each { length: gridPrefix } as _}
							<div class="aspect-square"></div>
						{/each}
					{/if}
					{#each displayItems as item (item.id)}
						<ItemTile
							{item}
							onTap={() => toggleItem(item)}
							onLongPress={userPermission !== 'read' ? () => { editItem = item; addModalOpen = true; } : () => {}}
							createdByUsername={item.createdByUsername}
							currentUsername={data.user?.username ?? null}
						/>
					{/each}
					{#if !userSettings.categorySortEnabled}
						{#each { length: gridPrefix } as _}
							<div class="aspect-square"></div>
						{/each}
					{/if}
				</div>
				{/if}<!-- end grid/list if -->
			{/if}
		{/if}
		</div>
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
		onClose={() => { addModalOpen = false; autoScannerOnOpen = false; }}
		{suggestions}
		autoOpenScanner={autoScannerOnOpen}
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
