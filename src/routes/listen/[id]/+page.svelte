<script lang="ts">
	import { flushSync, onMount, onDestroy, tick } from 'svelte';
	import { on } from '#lib/sseStore.svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import ItemTile from '#lib/components/ItemTile.svelte';
	import ItemRow from '#lib/components/ItemRow.svelte';
	import CheckedDrawer from '#lib/components/CheckedDrawer.svelte';
	import AddItemModal from '#lib/components/AddItemModal.svelte';
	import AddItemBar from '#lib/components/AddItemBar.svelte';
	import {
		generateClientId,
		queueItemCreate,
		queueItemUpdate,
		queueItemDelete,
		deleteOfflineItem,
		getOfflineFavorites,
		cacheFavorites,
		setFavoriteOffline,
		getPendingCreateItems,
		cacheItemsData,
		getOfflineItems,
		getOfflineListName,
		getCategoryOverrideForCreate,
		refreshCategoryPreferences,
		setCategoryPreferenceOffline,
		deleteCategoryPreferenceOffline
	} from '#lib/sync/manager';
	import { acquireWakeLock, releaseWakeLock } from '#lib/wakeLock';

	let wakeLockHeld = false;
	import { t, list_items_open } from '#lib/i18n.svelte';
	import { getCategoryKey } from '#lib/categories';
	import { getCategoryPreferenceAction } from '#lib/categoryPreferences';
	import { userSettings } from '#lib/userSettings.svelte';

	const LISTVIEW_HINT_KEY = 'groly_listview_hint_dismissed';
	const LOCATION_HINT_KEY = 'groly_location_hint_dismissed';
	let showListViewHint = $state(false);
	let showLocationHint = $state(false);

	let { data } = $props();

	type Item = { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number };

	type Favorite = { name: string; quantityInfo: string | null; categoryOverride: string | null };

	let listName = $state('');
	let items = $state<Item[]>([]);
	let favorites = $state<Favorite[]>([]);
	const favoriteNames = $derived(new Set(favorites.map(f => f.name.toLowerCase())));
	const activeItemNames = $derived(new Set(items.filter(i => !i.isChecked).map(i => i.name.toLowerCase())));
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let loading = $state(true);
	let editItem = $state<Item | null>(null);
	let suggestions = $state<string[]>([]);
	let userPermission = $state<'owner' | 'write' | 'read'>('write');
	let searchQuery = $state('');
	let searchOpen = $state(false);
	let keyboardOpen = $state(false);
	let scrollContainer = $state<HTMLDivElement | null>(null);
	let autoScannerOnOpen = $state(false);
	let autoFavoritesOnOpen = $state(false);
	let itemsLoadVersion = 0;

	// Pull-to-Refresh
	const PULL_THRESHOLD = 65;
	let pullStartY = 0;
	let pullDistance = $state(0);
	let isPulling = $state(false);
	let isRefreshing = $state(false);
	const pullIndicatorY = $derived(
		isRefreshing ? 8 : -40 + Math.min(pullDistance, PULL_THRESHOLD) / PULL_THRESHOLD * 48
	);
	const pullOpacity = $derived(Math.min(pullDistance / (PULL_THRESHOLD * 0.6), 1));
	const pullArrowRotation = $derived(Math.min(pullDistance / PULL_THRESHOLD, 1) * 180);

	const listId = $derived(page.params.id);
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
	const checkedItems = $derived.by(() => {
		const sorted = items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0));
		return userSettings.showAllCheckedItems ? sorted : sorted.slice(0, 16);
	});
	const openCount = $derived(openItems.length);
	const showSearch = $derived(openItems.length >= 5 || items.some(i => i.isChecked));
	const displayItems = $derived(
		searchQuery.trim()
			? openItems.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: openItems
	);
	const displayCheckedItems = $derived(
		searchQuery.trim()
			? items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0))
			       .filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
			: checkedItems
	);
	// Empty prefix slots so the grid fills bottom-up (empty slots at top-left)
	const gridPrefix = $derived(displayItems.length % 3 === 0 ? 0 : 3 - (displayItems.length % 3));
	const totalSearchResults = $derived(displayItems.length + (searchQuery.trim() ? displayCheckedItems.length : 0));
	const headerSubtitle = $derived(
		searchQuery.trim()
			? `${totalSearchResults} Ergebnis${totalSearchResults !== 1 ? 'se' : ''}`
			: list_items_open(openCount)
	);

	function openAddInput() {
		editItem = null;
		autoScannerOnOpen = false;
		autoFavoritesOnOpen = false;
		// Mount and focus the real input while the native click is still active.
		flushSync(() => { addModalOpen = true; });
		document.querySelector<HTMLInputElement>('[data-add-item-name]')?.focus({ preventScroll: true });
	}

	async function loadItems() {
		const targetListId = listId ?? '';
		const requestVersion = ++itemsLoadVersion;
		if (data.user?.id) {
			void refreshCategoryPreferences(data.user.id);
			const cachedFavorites = await getOfflineFavorites(data.user.id);
			if (requestVersion !== itemsLoadVersion) return;
			if (cachedFavorites) favorites = cachedFavorites;
		}

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
			const requestStartedAt = Date.now();
			const [listRes, itemsRes, suggestRes, favsRes] = await Promise.all([
				fetch(`/api/lists/${targetListId}`),
				fetch(`/api/lists/${targetListId}/items`),
				fetch('/api/suggestions'),
				fetch('/api/favorites')
			]);
			if (!listRes.ok || !itemsRes.ok) throw new Error();
			const listData = await listRes.json();
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			listName = listData.name;
			userPermission = listData.userPermission ?? 'write';
			const serverItems: Item[] = await itemsRes.json();
			const pendingItems = data.user?.id
				? await getPendingCreateItems(data.user.id, targetListId, requestStartedAt)
				: [];
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			const serverIds = new Set(serverItems.map((item) => item.id));
			const newItems: Item[] = [
				...serverItems,
				...pendingItems
					.filter((item) => !serverIds.has(item.id))
					.map((item) => ({ ...item, createdByUsername: data.user?.username ?? null }))
			];
			if (suggestRes.ok) suggestions = await suggestRes.json();
			if (favsRes.ok && data.user?.id) favorites = await cacheFavorites(data.user.id, await favsRes.json(), requestStartedAt);
			// Cache als plain objects (vor State-Zuweisung)
			const mergedItems = await cacheItemsData(newItems, data.user?.id, requestStartedAt);
			if (requestVersion !== itemsLoadVersion || targetListId !== (listId ?? '')) return;
			items = mergedItems;
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
		if (userPermission === 'read' || !data.user?.id) return;
		const isChecked = !item.isChecked;
		const checkedAt = isChecked ? Math.floor(Date.now() / 1000) : null;
		await queueItemUpdate(data.user.id, item.id, { isChecked, checkedAt });
		items = items.map(i => i.id === item.id ? { ...i, isChecked, checkedAt } : i);
	}

	async function addItem(name: string, quantityInfo: string, favoriteCategoryOverride?: string | null) {
		const targetListId = listId ?? '';
		const id = generateClientId();
		const categoryOverride = data.user?.id
			? await getCategoryOverrideForCreate(data.user.id, name, favoriteCategoryOverride)
			: null;
		const optimisticItem: Item = {
			id, listId: targetListId, name: name.trim(),
			quantityInfo: quantityInfo.trim() || null,
			isChecked: false, checkedAt: null, categoryOverride,
			createdByUsername: data.user?.username ?? null,
			updatedAt: Math.floor(Date.now() / 1000)
		};
		if (!data.user?.id) return;
		await queueItemCreate(data.user.id, optimisticItem, {
			id,
			listId: targetListId,
			name: optimisticItem.name,
			quantityInfo: quantityInfo.trim(),
			categoryOverride
		});
		if (targetListId !== (listId ?? '')) return;
		if (!items.some((item) => item.id === id)) items = [...items, optimisticItem];
		if (!suggestions.some((suggestion) => suggestion.toLowerCase() === optimisticItem.name.toLowerCase())) {
			suggestions = [optimisticItem.name, ...suggestions].slice(0, 30);
		}
	}

	async function searchItemSuggestions(query: string, signal: AbortSignal): Promise<string[]> {
		try {
			const response = await fetch(`/api/suggestions?q=${encodeURIComponent(query)}`, {
				cache: 'no-store',
				signal
			});
			if (!response.ok) return [];
			return await response.json() as string[];
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') return [];
			return [];
		}
	}

	async function saveEditItem(name: string, quantityInfo: string, categoryOverride: string | null, categoryPickerUsed: boolean) {
		if (!editItem) return;
		const id = editItem.id;
		editItem = null;
		addModalOpen = false;
		if (!data.user?.id) return;
		const itemUpdate = queueItemUpdate(data.user.id, id, { name, quantityInfo: quantityInfo || null, categoryOverride }).then(() => {
			items = items.map(i => i.id === id ? { ...i, name, quantityInfo: quantityInfo || null, categoryOverride } : i);
		});
		const preferenceAction = getCategoryPreferenceAction(categoryPickerUsed, categoryOverride);
		const preferenceUpdate = data.user?.id && preferenceAction.type === 'set'
			? setCategoryPreferenceOffline(data.user.id, name, preferenceAction.categoryOverride)
			: data.user?.id && preferenceAction.type === 'delete'
				? deleteCategoryPreferenceOffline(data.user.id, name)
				: Promise.resolve();
		await Promise.all([itemUpdate, preferenceUpdate]);
	}

	async function deleteItem(id: string) {
		if (!data.user?.id) return;
		await queueItemDelete(data.user.id, id);
		items = items.filter(i => i.id !== id);
	}

	async function addFavorite(name: string, quantityInfo: string) {
		if (!data.user?.id) return;
		favorites = await setFavoriteOffline(data.user.id, { name, quantityInfo: quantityInfo || null, categoryOverride: null });
	}

	async function editFavorite(previousName: string, name: string, quantityInfo: string, categoryOverride: string | null) {
		if (!data.user?.id) return;
		favorites = await setFavoriteOffline(data.user.id, { name, quantityInfo: quantityInfo || null, categoryOverride }, false, previousName);
	}

	async function toggleFavorite(name: string, makeFavorite: boolean) {
		if (!data.user?.id) return;
		const item = items.find(i => i.name === name);
		favorites = await setFavoriteOffline(data.user.id, { name, quantityInfo: item?.quantityInfo ?? null, categoryOverride: item?.categoryOverride ?? null }, !makeFavorite);
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

	function handlePullStart(e: TouchEvent) {
		if (scrollContainer && scrollContainer.scrollTop <= 0) {
			pullStartY = e.touches[0].clientY;
			isPulling = true;
		}
	}

	function handlePullMove(e: TouchEvent) {
		if (!isPulling || isRefreshing) return;
		const dy = e.touches[0].clientY - pullStartY;
		if (dy > 0) {
			pullDistance = Math.min(dy, PULL_THRESHOLD + 20);
		} else {
			pullDistance = 0;
			isPulling = false;
		}
	}

	function handlePullEnd() {
		if (!isPulling) return;
		isPulling = false;
		if (pullDistance >= PULL_THRESHOLD) {
			isRefreshing = true;
			pullDistance = PULL_THRESHOLD;
			void loadItems().finally(() => {
				isRefreshing = false;
				pullDistance = 0;
			});
		} else {
			pullDistance = 0;
		}
	}

	onMount(() => {
		void loadItems();
		const handleOnline = () => void loadItems();
		const handleVisibility = () => { if (document.visibilityState === 'visible') void loadItems(); };
		window.addEventListener('online', handleOnline);
		document.addEventListener('visibilitychange', handleVisibility);
		if (userSettings.wakeLockLists) { wakeLockHeld = true; void acquireWakeLock(); }

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

		if (scrollContainer) {
			scrollContainer.addEventListener('touchstart', handlePullStart, { passive: true });
			scrollContainer.addEventListener('touchmove', handlePullMove, { passive: true });
			scrollContainer.addEventListener('touchend', handlePullEnd, { passive: true });
		}

		if (window.visualViewport) {
			const onViewportResize = () => {
				keyboardOpen = (window.innerHeight - window.visualViewport!.height) > 100;
			};
			window.visualViewport.addEventListener('resize', onViewportResize);
			const removeViewport = () => window.visualViewport?.removeEventListener('resize', onViewportResize);
			const removeOnline = () => window.removeEventListener('online', handleOnline);
			const removeVisibility = () => document.removeEventListener('visibilitychange', handleVisibility);
			const removePull = () => {
				scrollContainer?.removeEventListener('touchstart', handlePullStart);
				scrollContainer?.removeEventListener('touchmove', handlePullMove);
				scrollContainer?.removeEventListener('touchend', handlePullEnd);
			};
			return () => { removeOnline(); removeViewport(); removeVisibility(); removePull(); };
		}

		const removeVisibility = () => document.removeEventListener('visibilitychange', handleVisibility);
		const removePull = () => {
			scrollContainer?.removeEventListener('touchstart', handlePullStart);
			scrollContainer?.removeEventListener('touchmove', handlePullMove);
			scrollContainer?.removeEventListener('touchend', handlePullEnd);
		};
		return () => { window.removeEventListener('online', handleOnline); removeVisibility(); removePull(); };
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
		on('item_added', async (ev) => {
			if (ev.listId !== listId) return;
			if (!items.some(i => i.id === (ev.item as Item).id)) {
				const [merged] = await cacheItemsData([ev.item as Item], data.user?.id);
				if (ev.listId === listId && merged && !items.some(i => i.id === merged.id)) items = [...items, merged];
			}
		}),
		on('item_updated', async (ev) => {
			if (ev.listId !== listId) return;
			const current = items.find(i => i.id === (ev.item as Item).id);
			if (!current) return;
			const [merged] = await cacheItemsData([{ ...current, ...(ev.item as Item) }], data.user?.id);
			if (ev.listId !== listId) return;
			items = merged ? items.map(i => i.id === merged.id ? merged : i) : items.filter(i => i.id !== current.id);
		}),
		on('item_deleted', (ev) => {
			if (ev.listId !== listId) return;
			items = items.filter(i => i.id !== ev.id);
			void deleteOfflineItem(ev.id as string);
		}),
	];

	onDestroy(() => {
		offHandlers.forEach(off => off());
		if (wakeLockHeld) void releaseWakeLock();
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={listName || t.list_default_name}
		subtitle={headerSubtitle}
		onMenuOpen={() => menuOpen = true}
		onSearch={showSearch && !searchOpen ? () => searchOpen = true : null}
	/>

	<!-- Suchleiste (fixiert unter dem Header, nur wenn aktiv) -->
	{#if searchOpen}
		<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto px-4 py-2"
		     style="top: calc(env(safe-area-inset-top) + 5.25rem); background-color: var(--color-bg)">
			<div class="flex items-center gap-2 rounded-xl px-3 py-2.5"
			     style="background-color: var(--modal-bg)">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-on-surface-variant)" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					autofocus
					type="text"
					placeholder={t.list_search_placeholder}
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Escape' && closeSearch()}
					class="flex-1 bg-transparent outline-none text-sm"
					style="color: var(--color-on-surface)"
				/>
				<button
					onclick={closeSearch}
					class="w-6 h-6 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label={t.a11y_close_search}
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
					aria-label={t.a11y_close_hint}
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
					aria-label={t.a11y_close_hint}
				>×</button>
			</div>
		</div>
	{/if}

	<!-- Pull-to-Refresh Indicator -->
	{#if pullDistance > 2 || isRefreshing}
		<div
			class="fixed left-0 right-0 z-30 flex justify-center pointer-events-none max-w-[430px] mx-auto"
			style="top: calc(env(safe-area-inset-top) + 5.25rem); transform: translateY({pullIndicatorY}px); opacity: {pullOpacity}; transition: {isPulling ? 'none' : 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease'}"
		>
			<div class="w-9 h-9 rounded-full flex items-center justify-center shadow-md"
			     style="background-color: var(--color-surface-elevated); border: 1px solid var(--color-outline-variant)">
				{#if isRefreshing}
					<div class="w-[15px] h-[15px] rounded-full border-2 animate-spin"
					     style="border-color: var(--color-primary); border-top-color: transparent"></div>
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-primary)" stroke-width="2.5"
					     stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({pullArrowRotation}deg); transition: {isPulling ? 'none' : 'transform 0.2s ease'}">
						<path d="M12 5v14M5 12l7 7 7-7"/>
					</svg>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Bottom-Anchored Content -->
	<div bind:this={scrollContainer} class="flex-1 overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + 5.25rem + {searchOpen ? '3.5rem' : '0px'} + {showListViewHint ? '3.5rem' : '0px'} + {showLocationHint ? '3.5rem' : '0px'}); padding-bottom: 5.5rem; overscroll-behavior: none">
		<div class="min-h-full flex flex-col" class:justify-end={!searchQuery.trim() || !keyboardOpen}>
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else}
			<!-- CheckedDrawer – direkt über den offenen Items -->
			{#if checkedItems.length > 0}
				<CheckedDrawer checkedItems={displayCheckedItems} totalChecked={items.filter(i => i.isChecked).length} onUncheck={toggleItem} layout={userSettings.itemLayout} />
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
					<div class="shopping-items-surface mt-2">
						{#each displayItems as item, index (item.id)}
							<div class:inset-row-divider={index < displayItems.length - 1}>
								<ItemRow
									{item}
									onTap={() => toggleItem(item)}
									onLongPress={userPermission !== 'read' ? () => { editItem = item; addModalOpen = true; } : () => {}}
									createdByUsername={item.createdByUsername}
									currentUsername={data.user?.username ?? null}
									isFavorite={favoriteNames.has(item.name.toLowerCase())}
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
							isFavorite={favoriteNames.has(item.name.toLowerCase())}
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
		<AppBottomNav
			activeTab="lists"
			onFabTap={openAddInput}
			fabLabel={t.add}
			onFavorites={() => { editItem = null; autoFavoritesOnOpen = true; addModalOpen = true; }}
		/>
	{/if}
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Persistente Eingabeleiste für neue Items -->
{#if addModalOpen && !editItem}
	<AddItemBar
		onAdd={addItem}
		onClose={() => { addModalOpen = false; autoScannerOnOpen = false; autoFavoritesOnOpen = false; }}
		{suggestions}
		autoOpenScanner={autoScannerOnOpen}
		autoOpenFavorites={autoFavoritesOnOpen}
		{favorites}
		{activeItemNames}
		onSearchSuggestions={searchItemSuggestions}
		onRemoveFavorite={(name) => toggleFavorite(name, false)}
		onAddFavorite={addFavorite}
		onEditFavorite={editFavorite}
	/>
{/if}

<!-- Modal nur für Bearbeiten -->
{#if addModalOpen && editItem}
	<AddItemModal
		item={editItem}
		onSave={saveEditItem}
		onClose={() => { addModalOpen = false; editItem = null; }}
		onDelete={() => { const id = editItem!.id; addModalOpen = false; editItem = null; void deleteItem(id); }}
		isFavorite={favoriteNames.has((editItem?.name ?? '').toLowerCase())}
		onToggleFavorite={toggleFavorite}
	/>
{/if}
