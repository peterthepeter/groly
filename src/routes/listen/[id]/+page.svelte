<script lang="ts">
	import { flushSync, onMount, onDestroy, tick } from 'svelte';
	import { SquarePen, Check } from '@lucide/svelte';
	import { on } from '#lib/sseStore.svelte';
	import { goto, afterNavigate } from '$app/navigation';
	import { page } from '$app/state';
	import { clearMissingChecklistSection, orderChecklistRows, type ChecklistSectionChoice, type ChecklistEntryEdit, type ChecklistEntryFields, type ChecklistSection, type ChecklistSettings, type ListKind } from '#lib/checklists';
	import type { OfflineList } from '#lib/sync/db';
	import ChecklistManageSheet from '#lib/components/ChecklistManageSheet.svelte';
	import ChecklistItems from '#lib/components/ChecklistItems.svelte';
	import ChecklistEntrySheet from '#lib/components/ChecklistEntrySheet.svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import ItemTile from '#lib/components/ItemTile.svelte';
	import ItemRow from '#lib/components/ItemRow.svelte';
	import CheckedDrawer from '#lib/components/CheckedDrawer.svelte';
	import AddItemModal from '#lib/components/AddItemModal.svelte';
	import AddItemBar from '#lib/components/AddItemBar.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import {
		generateClientId,
		queueItemCreate,
		queueItemUpdate,
		queueItemDelete,
		queueItemDeletes,
		undoChecklistDelete,
		queueChecklistOrder,
		queueChecklistSections,
		setChecklistDefault,
		deleteOfflineItem,
		getOfflineFavorites,
		cacheFavorites,
		setFavoriteOffline,
		getPendingCreateItems,
		cacheItemsData,
		getOfflineItems,
		getOfflineList,
		updateOfflineList,
		cacheListsData,
		getCategoryOverrideForCreate,
		refreshCategoryPreferences,
		setCategoryPreferenceOffline,
		deleteCategoryPreferenceOffline,
		resetChecklist
	} from '#lib/sync/manager';
	import { acquireWakeLock, releaseWakeLock } from '#lib/wakeLock';

	let wakeLockHeld = false;
	import { checklistProgress, checklistDeleteLabel, currentLang, t, list_items_open } from '#lib/i18n.svelte';
	import { getCategoryKey } from '#lib/categories';
	import { getCategoryPreferenceAction } from '#lib/categoryPreferences';
	import { userSettings } from '#lib/userSettings.svelte';
	import { resolveShoppingItemSortMode } from '#lib/userSettingsTypes';

	const LISTVIEW_HINT_KEY = 'groly_listview_hint_dismissed';
	const LOCATION_HINT_KEY = 'groly_location_hint_dismissed';
	let showListViewHint = $state(false);
	let showLocationHint = $state(false);

	let { data } = $props();

	type Item = ChecklistEntryFields & { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number };

	type Favorite = { name: string; quantityInfo: string | null; categoryOverride: string | null };

	let listName = $state('');
	let kind = $state<ListKind>('shopping');
	let sections = $state<ChecklistSection[]>([]);
	let defaultSectionId = $state<string | null>(null);
	let pushAvailable = $state<boolean | null>(null);
	let highlightedId = $state<string | null>(null);
	const isChecklist = $derived(kind === 'checklist');
	let checklistError = $state('');
	let manageMode = $state<'sort' | 'delete' | null>(null);
	let manageMenuOpen = $state(false);
	const managing = $derived(manageMode !== null);
	let selectedIds = $state(new Set<string>());
	let undoItem = $state<Item | null>(null);
	let undoTimer: ReturnType<typeof setTimeout>;
	let checklistResetError = $state(false);
	let resettingChecklistId = $state<string | null>(null);
	let items = $state<Item[]>([]);
	let userPermission = $state<'owner' | 'write' | 'read'>('write');
	let onlyOpen = $state(false);
	const hasChecklistFooter = $derived(isChecklist && (userPermission !== 'read' || items.length > 0));
	const filterActive = $derived(onlyOpen && !managing && items.length > 0);
	const checklistViewOptions = $derived([{ value: 'all', label: t.checklist_view_all }, { value: 'open', label: t.checklist_view_open }]);
	const selection = $derived(new Set(items.filter(item => selectedIds.has(item.id)).map(item => item.id)));
	let favorites = $state<Favorite[]>([]);
	const favoriteNames = $derived(new Set(favorites.map(f => f.name.toLowerCase())));
	const activeItemNames = $derived(new Set(items.filter(i => !i.isChecked).map(i => i.name.toLowerCase())));
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let loading = $state(true);
	let editItem = $state<Item | null>(null);
	let suggestions = $state<string[]>([]);
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
	const listCategorySettings = $derived(listId ? userSettings.getListCategorySettings(listId) : null);
	const itemSortMode = $derived(listCategorySettings === null ? userSettings.shoppingItemSortMode
		: resolveShoppingItemSortMode(listCategorySettings.enabled, listCategorySettings.itemSortDirection));
	const alphabeticalSort = $derived(itemSortMode === 'az' || itemSortMode === 'za');
	// Preserve the grid's existing placement for the category and off modes.
	const reverseShoppingGrid = $derived(!alphabeticalSort && userSettings.categorySortEnabled);
	const openItems = $derived.by(() => {
		const unchecked = items.filter(i => !i.isChecked);
		if (isChecklist || itemSortMode === 'off') return unchecked;
		if (alphabeticalSort) {
			const collator = new Intl.Collator(currentLang(), { numeric: true, sensitivity: 'base' });
			const direction = itemSortMode === 'za' ? -1 : 1;
			return unchecked.sort((a, b) => direction * collator.compare(a.name, b.name));
		}
		const order = listCategorySettings?.order ?? userSettings.categoryOrder;
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
	const canResetChecklist = $derived(isChecklist && userPermission === 'owner' && !searchOpen && openCount < items.length);
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
		isChecklist ? '' : searchQuery.trim()
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

	function applyList(list: Pick<OfflineList, 'name' | 'kind' | 'checklistSections' | 'defaultSectionId' | 'userPermission' | 'ownerId'>) {
		listName = list.name;
		kind = list.kind ?? 'shopping';
		sections = list.checklistSections ?? [];
		defaultSectionId = list.defaultSectionId ?? null;
		userPermission = list.userPermission ?? (list.ownerId === data.user?.id ? 'owner' : kind === 'checklist' ? 'read' : 'write');
		if (userPermission === 'read') { manageMode = null; manageMenuOpen = false; selectedIds = new Set(); }
	}

	async function revealHighlightedEntry() {
		await tick();
		const targetId = highlightedId;
		if (!targetId) return;
		const entry = scrollContainer?.querySelector(`[data-checklist-entry="${CSS.escape(targetId)}"]`);
		entry?.scrollIntoView({ block: 'nearest' });
	}

	async function loadItems() {
		const targetListId = listId ?? '';
		const requestVersion = ++itemsLoadVersion;
		const userId = data.user?.id;
		const stillCurrent = () => requestVersion === itemsLoadVersion && targetListId === (listId ?? '');
		const cached = await getOfflineList(targetListId);
		if (!stillCurrent()) return;
		if (cached && !listName) applyList(cached);
		if (userId) {
			if (!isChecklist) void refreshCategoryPreferences(userId);
			const cachedFavorites = await getOfflineFavorites(userId, kind);
			if (!stillCurrent()) return;
			if (cachedFavorites) favorites = cachedFavorites;
		}
		if (!items.length) {
			const cachedItems = await getOfflineItems(targetListId);
			if (!stillCurrent()) return;
			// Older caches can establish completeness when their snapshot matches the catalog total.
			if (userId && cached?.kind === 'checklist' && !cached.checklistItemsCached && cached.totalCount === cachedItems.length) {
				await updateOfflineList(targetListId, { checklistItemsCached: true }, userId);
				if (!stillCurrent()) return;
			}
			if (cached || cachedItems.length) {
				items = cachedItems.map(item => ({ ...item, createdByUsername: null }));
				loading = false;
			}
		}

		try {
			const requestStartedAt = Date.now();
			const [listRes, itemsRes] = await Promise.all([
				fetch(`/api/lists/${targetListId}`),
				fetch(`/api/lists/${targetListId}/items`)
			]);
			if (!listRes.ok || !itemsRes.ok) {
				if (listRes.status === 404 || itemsRes.status === 404) {
					if (stillCurrent()) { items = []; listName = ''; userPermission = 'read'; }
				}
				throw new Error();
			}
			const listData: OfflineList & { pushAvailable?: boolean } = await listRes.json();
			const serverItems: Item[] = await itemsRes.json();
			if (!stillCurrent()) return;
			if (!userId) applyList(listData);
			pushAvailable = listData.pushAvailable ?? null;
			const pendingItems = userId ? await getPendingCreateItems(userId, targetListId, requestStartedAt) : [];
			const serverIds = new Set(serverItems.map(item => item.id));
			const newItems = [...serverItems, ...pendingItems.filter(item => !serverIds.has(item.id))
				.map(item => ({ ...item, createdByUsername: data.user?.username ?? null }))];
			const merged = await cacheItemsData(newItems, userId, requestStartedAt, listData.kind === 'checklist' ? targetListId : undefined);
			if (!stillCurrent()) return;
			items = merged;
			loading = false;
			if (userId) {
				const { pushAvailable: _pushAvailable, ...metadata } = listData;
				await cacheListsData([{ ...cached, ...metadata, checklistItemsCached: listData.kind === 'checklist',
					totalCount: merged.length, openCount: merged.filter(item => !item.isChecked).length }], userId);
				const effectiveList = await getOfflineList(targetListId);
				if (!stillCurrent()) return;
				applyList(effectiveList ?? listData);
				const currentKind = kind;
				const tasks = [
					fetch(currentKind === 'checklist' ? '/api/favorites?kind=checklist' : '/api/favorites').then(async res => {
						if (!res.ok || !stillCurrent()) return;
						const next = await cacheFavorites(userId, await res.json(), requestStartedAt, currentKind);
						if (stillCurrent()) favorites = next;
					})
				];
				if (currentKind === 'shopping') tasks.push(fetch('/api/suggestions').then(async res => {
					if (!res.ok) return;
					const next = await res.json();
					if (stillCurrent()) suggestions = next;
				}));
				void Promise.allSettled(tasks);
			}
		} catch { /* The account cache remains usable if the server is unreachable. */ }
		if (!stillCurrent()) return;
		loading = false;
		if (highlightedId) void revealHighlightedEntry();
		else if (!isChecklist) {
			await tick();
			scrollContainer?.scrollTo({ top: scrollContainer.scrollHeight });
		}
	}

	async function toggleItem(item: Item) {
		if (userPermission === 'read' || !data.user?.id || resettingChecklistId === item.listId) return;
		const isChecked = !item.isChecked;
		const checkedAt = isChecked ? Math.floor(Date.now() / 1000) : null;
		const changes = { isChecked, checkedAt, ...(isChecklist && isChecked ? { remindAt: null, reminderStatus: null } : {}) };
		try {
			await queueItemUpdate(data.user.id, item.id, changes);
			items = items.map(i => i.id === item.id ? { ...i, ...changes } : i);
			checklistError = '';
		} catch {
			if (isChecklist) checklistError = t.checklist_edit_error;
		}
	}

	function openManageMenu() {
		closeSearch();
		manageMode = null;
		manageMenuOpen = true;
		checklistResetError = false;
		selectedIds = new Set();
	}

	function selectEntry(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		selectedIds = next;
	}

	async function setDefaultSection(sectionId: string | null) {
		const target = listId;
		if (!target || !data.user?.id || userPermission !== 'owner') throw new Error('Cannot change default section');
		await setChecklistDefault(data.user.id, target, sectionId);
		if (target === listId) defaultSectionId = sectionId;
	}

	async function saveChecklistSections(settings: ChecklistSettings) {
		const target = listId;
		const userId = data.user?.id;
		if (!target || !userId || userPermission !== 'owner') throw new Error('Cannot update checklist sections');
		await queueChecklistSections(userId, target, settings);
		if (target !== listId) return;
		sections = settings.checklistSections;
		defaultSectionId = settings.defaultSectionId;
		const sectionIds = new Set(sections.map(section => section.id));
		items = items.map(item => clearMissingChecklistSection(item, sectionIds));
	}

	async function reorderChecklist(ids: string[], sectionId?: string | null) {
		const target = listId;
		if (!target || !data.user?.id) return;
		try {
			await queueChecklistOrder(data.user.id, target, ids, sectionId);
			if (listId !== target) return;
			if (sectionId === undefined) sections = orderChecklistRows(sections, ids);
			else {
				const positions = new Map(ids.map((id, index) => [id, index]));
				items = items.map(item => positions.has(item.id) && (item.sectionId ?? null) === sectionId
					? { ...item, checklistPosition: positions.get(item.id) } : item);
			}
		} catch { if (listId === target) checklistError = t.checklist_edit_error; }
	}

	async function removeChecklistEntries(ids: string[], offerUndo = false) {
		const target = listId;
		if (!ids.length || !data.user?.id || !target) return;
		if (!offerUndo && !confirm(checklistDeleteLabel(ids.length) + '?')) return;
		const entry = offerUndo ? items.find(item => item.id === ids[0]) : null;
		const deadline = Date.now() + 7000;
		try {
			await queueItemDeletes(data.user.id, ids, offerUndo ? deadline : undefined, target);
			if (listId !== target) return;
			const removed = new Set(ids);
			items = items.filter(item => !removed.has(item.id));
			if (!offerUndo && manageMode === 'delete') openManageMenu();
			if (entry) {
				undoItem = entry;
				clearTimeout(undoTimer);
				undoTimer = setTimeout(() => undoItem = null, Math.max(0, deadline - Date.now()));
			}
		} catch { if (listId === target) checklistError = t.checklist_edit_error; }
	}

	async function undoDelete() {
		const entry = undoItem;
		if (!entry || !data.user?.id) return;
		try {
			const restored = await undoChecklistDelete(data.user.id, entry);
			if (restored && listId === entry.listId && !items.some(item => item.id === entry.id)) items = [...items, entry];
			if (undoItem?.id === entry.id) undoItem = null;
		} catch { checklistError = t.checklist_edit_error; }
	}

	async function resetCurrentChecklist() {
		const targetListId = listId;
		const userId = data.user?.id;
		if (!canResetChecklist || resettingChecklistId || !targetListId || !userId) return;
		if (!confirm(t.checklist_reset_confirm)) return;
		resettingChecklistId = targetListId;
		checklistResetError = false;
		try {
			await resetChecklist(userId, targetListId);
			if (listId === targetListId) await loadItems();
		} catch {
			if (listId === targetListId) checklistResetError = true;
		} finally {
			resettingChecklistId = null;
		}
	}

	async function addItem(name: string, quantityInfo: string, favoriteCategoryOverride?: string | null, sectionId?: string | null, choice?: ChecklistSectionChoice, checklistNote?: string | null) {
		const targetListId = listId ?? '';
		const id = generateClientId();
		const checklist = isChecklist;
		const categoryOverride = !checklist && data.user?.id
			? await getCategoryOverrideForCreate(data.user.id, name, favoriteCategoryOverride)
			: null;
		const optimisticItem: Item = {
			id, listId: targetListId, name: name.trim(),
			quantityInfo: quantityInfo.trim() || null,
			isChecked: false, checkedAt: null, categoryOverride,
			...(checklist ? { sectionId: sectionId ?? null, checklistNote: checklistNote ?? null, createdAt: Date.now() } : {}),
			createdByUsername: data.user?.username ?? null,
			updatedAt: checklist ? Date.now() : Math.floor(Date.now() / 1000)
		};
		if (!data.user?.id) return;
		await queueItemCreate(data.user.id, optimisticItem, {
			id,
			listId: targetListId,
			name: optimisticItem.name,
			quantityInfo: quantityInfo.trim(),
			categoryOverride,
			...(checklist ? { kind: 'checklist' as const, sectionId: sectionId ?? null, checklistNote: checklistNote ?? null, ...choice } : {})
		});
		if (targetListId !== (listId ?? '')) return;
		if (choice?.newSection && !sections.some(section => section.id === choice.newSection!.id)) sections = [...sections, choice.newSection];
		if (choice?.setDefault) defaultSectionId = sectionId ?? null;
		if (!items.some((item) => item.id === id)) items = [...items, optimisticItem];
		if (!checklist && !suggestions.some((suggestion) => suggestion.toLowerCase() === optimisticItem.name.toLowerCase())) {
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

	async function saveChecklistItem(changes: ChecklistEntryEdit) {
		const id = editItem?.id;
		const userId = data.user?.id;
		if (!id || !userId) return;
		const patch = { ...changes, ...(changes.sectionId !== (editItem?.sectionId ?? null) ? { checklistPosition: null } : {}), ...('remindAt' in changes ? { reminderStatus: changes.remindAt ? 'syncing' as const : null } : {}) };
		await queueItemUpdate(userId, id, patch);
		items = items.map(item => item.id === id ? { ...item, ...patch } : item);
		closeChecklistEditor();
	}

	async function saveChecklistFavorite(name: string, remove: boolean) {
		const userId = data.user?.id;
		if (!userId) return;
		favorites = await setFavoriteOffline(userId, { name, quantityInfo: null, categoryOverride: null }, remove, undefined, 'checklist');
	}

	function closeChecklistEditor() {
		addModalOpen = false;
		editItem = null;
		autoFavoritesOnOpen = false;
	}

	function editChecklistEntry(id: string) {
		const item = items.find(item => item.id === id);
		if (!item || (userPermission === 'read' && !item.checklistNote)) return;
		editItem = item;
		autoFavoritesOnOpen = false;
		addModalOpen = Boolean(editItem);
	}

	afterNavigate(({ to, from }) => {
		const fromId = from?.params?.id;
		const toId = to?.params?.id;

		// When navigating between different lists (component is reused by SvelteKit),
		// reset state so we don't briefly show the old list's items.
		if (fromId && toId && fromId !== toId) {
			manageMode = null; manageMenuOpen = false;
			onlyOpen = false;
			selectedIds = new Set();
			undoItem = null;
			clearTimeout(undoTimer);
			closeSearch();
			items = [];
			loading = true;
			listName = '';
			kind = 'shopping';
			sections = [];
			favorites = [];
			defaultSectionId = null;
			pushAvailable = null;
			checklistError = '';
			checklistResetError = false;
			addModalOpen = false;
			editItem = null;
			void loadItems();
		}

		// Handle shortcut ?action param — fires on every navigation incl. same-route
		highlightedId = to?.url.searchParams.get('entry') ?? null;
		if (highlightedId) void revealHighlightedEntry();
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
		if (!managing && scrollContainer && scrollContainer.scrollTop <= 0) {
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
		on('checklist_refreshed', ev => { if (ev.listId === listId && isChecklist) void loadItems(); }),
		on('checklist_sync_error', ev => {
			if (ev.listId === listId && isChecklist) {
				checklistError = t.checklist_edit_error;
				void loadItems();
			}
		}),
		on('list_updated', ev => { if (ev.listId === listId && isChecklist) void loadItems(); }),
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
			const incoming = ev.item as Item;
			const reminder = isChecklist && incoming.isChecked ? { remindAt: null, reminderStatus: null } : {};
			const [merged] = await cacheItemsData([{ ...current, ...incoming, ...reminder }], data.user?.id);
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
		clearTimeout(undoTimer);
		offHandlers.forEach(off => off());
		if (wakeLockHeld) void releaseWakeLock();
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	{#snippet checklistHeader()}
		<div class="checklist-header-actions">
			{#if userPermission !== 'read'}
				<button type="button" class:active={managing} aria-haspopup="dialog" aria-expanded={manageMenuOpen} onclick={openManageMenu}>
					{#if managing}<Check size={14} />{t.sort_mode_done}{:else}<SquarePen size={14} />{t.supplement_manage}{/if}
				</button>
			{/if}
			{#if items.length && !managing}
				<div class="checklist-view">
					<SettingsSelectRow label={t.checklist_view} value={onlyOpen ? 'open' : 'all'}
						options={checklistViewOptions} onchange={value => onlyOpen = value === 'open'} compact>
						{#snippet display()}
							<span class="checklist-progress">{checklistProgress(items.length - openCount, items.length)}</span>
							{#if filterActive}<span class="checklist-active-filter">{t.checklist_view_open_short}</span>{/if}
						{/snippet}
					</SettingsSelectRow>
				</div>
			{:else if items.length}
				<span class="checklist-progress">{checklistProgress(items.length - openCount, items.length)}</span>
			{/if}
		</div>
	{/snippet}
	<AppHeader
		title={listName || t.list_default_name}
		subtitle={headerSubtitle}
		onMenuOpen={() => menuOpen = true}
		footer={hasChecklistFooter ? checklistHeader : null}
		onSearch={showSearch && !managing && !searchOpen ? () => searchOpen = true : null}
	/>

	<!-- Suchleiste (fixiert unter dem Header, nur wenn aktiv) -->
	{#if searchOpen}
		<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto px-4 py-2"
		     style="top: calc(env(safe-area-inset-top) + 5.25rem + {hasChecklistFooter ? '44px' : '0px'}); background-color: var(--color-bg)">
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
	{#if !isChecklist && showListViewHint}
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
	{#if !isChecklist && showLocationHint}
		<div class="fixed left-0 right-0 z-20 max-w-[430px] mx-auto px-4 pointer-events-none"
		     style="top: calc(env(safe-area-inset-top) + 5.5rem + {!isChecklist && showListViewHint ? '3.5rem' : '0px'})">
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
	     style="padding-top: calc(env(safe-area-inset-top) + 5.25rem + {hasChecklistFooter ? '44px' : '0px'} + {searchOpen ? '3.5rem' : '0px'} + {!isChecklist && showListViewHint ? '3.5rem' : '0px'} + {!isChecklist && showLocationHint ? '3.5rem' : '0px'}); padding-bottom: {manageMode === 'delete' ? 'calc(7rem + env(safe-area-inset-bottom))' : manageMode === 'sort' ? 'calc(1rem + env(safe-area-inset-bottom))' : '5.5rem'}; overscroll-behavior: none">
		<div class="min-h-full flex flex-col" class:justify-end={!searchQuery.trim() || !keyboardOpen}>
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if isChecklist}
			{#if checklistError}<p class="text-sm px-2 pb-2" role="alert" style="color: var(--color-error)">{checklistError}</p>{/if}
			<ChecklistItems entries={items} {sections} readOnly={userPermission === 'read'} onlyOpen={filterActive} query={searchQuery} {highlightedId}
				ontoggle={id => { const item = items.find(entry => entry.id === id); if (item) void toggleItem(item); }}
				onedit={editChecklistEntry} mode={manageMode} canOrderSections={userPermission === 'owner'} selected={selection}
				onselect={selectEntry} onorder={reorderChecklist} ondelete={id => removeChecklistEntries([id], true)} />
			{#if checklistResetError && !manageMenuOpen}<p role="alert" class="text-sm text-center" style="color: var(--color-error)">{t.checklist_edit_error}</p>{/if}
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
				<div class="grid grid-cols-3 gap-2 mt-3" style={reverseShoppingGrid ? 'direction: rtl' : ''}>
					{#if reverseShoppingGrid}
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
					{#if !reverseShoppingGrid}
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

	{#if undoItem && !addModalOpen}
		<div class="checklist-undo"><span role="status">{t.checklist_deleted}</span><button type="button" onclick={undoDelete}>{t.checklist_undo}</button></div>
	{/if}
	{#if manageMode === 'delete' && isChecklist && userPermission !== 'read'}
		<div class="checklist-tools">
			<button type="button" disabled={openCount === items.length} onclick={() => selectedIds = new Set(items.filter(item => item.isChecked).map(item => item.id))}>{t.checklist_select_checked}</button>
			{#if selection.size}<button type="button" class="delete-selected" onclick={() => removeChecklistEntries([...selection])}>{checklistDeleteLabel(selection.size)}</button>{/if}
		</div>
	{:else if !managing && !addModalOpen && userPermission !== 'read'}
		<AppBottomNav
			activeTab="lists"
			onFabTap={openAddInput}
			fabLabel={isChecklist ? t.checklist_entry_add : t.add}
			onFavorites={() => { editItem = null; autoFavoritesOnOpen = true; addModalOpen = true; }}
		/>
	{/if}
</div>

{#if manageMenuOpen && isChecklist && userPermission !== 'read'}
	<ChecklistManageSheet owner={userPermission === 'owner'} canReset={canResetChecklist && resettingChecklistId === null} resetError={checklistResetError}
		settings={{ checklistSections: sections, defaultSectionId }} onsavesettings={saveChecklistSections}
		onmode={mode => { manageMode = mode; selectedIds = new Set(); manageMenuOpen = false; }}
		onreset={resetCurrentChecklist} onclose={() => manageMenuOpen = false} />
{/if}

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Persistente Eingabeleiste für neue Items -->
{#if addModalOpen && isChecklist && editItem}
	{#key editItem.id}
		<ChecklistEntrySheet {sections} item={editItem} {favorites} {pushAvailable} readOnly={userPermission === 'read'} onedit={saveChecklistItem}
			ondelete={async () => { if (editItem) await deleteItem(editItem.id); closeChecklistEditor(); }}
			onfavorite={saveChecklistFavorite} onclose={closeChecklistEditor} />
	{/key}
{/if}

{#if addModalOpen && !editItem && userPermission !== 'read'}
	<AddItemBar
		onAdd={addItem}
		onClose={() => { addModalOpen = false; autoScannerOnOpen = false; autoFavoritesOnOpen = false; }}
		checklist={isChecklist ? { sections, defaultSectionId, canManageSections: userPermission === 'owner', onSetDefault: setDefaultSection } : undefined}
		{suggestions}
		autoOpenScanner={autoScannerOnOpen}
		autoOpenFavorites={autoFavoritesOnOpen}
		{favorites}
		{activeItemNames}
		onSearchSuggestions={isChecklist ? null : searchItemSuggestions}
		onRemoveFavorite={(name) => isChecklist ? saveChecklistFavorite(name, true) : toggleFavorite(name, false)}
		onAddFavorite={isChecklist ? (name) => saveChecklistFavorite(name, false) : addFavorite}
		onEditFavorite={isChecklist ? null : editFavorite}
	/>
{/if}

<!-- Modal nur für Bearbeiten -->
{#if addModalOpen && editItem && !isChecklist}
	<AddItemModal
		item={editItem}
		onSave={saveEditItem}
		onClose={() => { addModalOpen = false; editItem = null; }}
		onDelete={() => { const id = editItem!.id; addModalOpen = false; editItem = null; void deleteItem(id); }}
		isFavorite={favoriteNames.has((editItem?.name ?? '').toLowerCase())}
		onToggleFavorite={toggleFavorite}
	/>
{/if}

<style>
	.checklist-header-actions { display: flex; min-height: 44px; color: var(--color-on-surface-variant); font-size: 13px; font-weight: 550; }
	.checklist-header-actions > * { display: flex; flex: 1; align-items: center; justify-content: center; gap: 7px; }
	.checklist-view :global(.settings-select-row) { justify-content: center; width: 100%; padding: 4px 6px; }
	.checklist-view :global(.settings-select-value) { gap: 4px; font-size: inherit; text-align: center; }
	.checklist-progress { color: var(--color-on-surface); font-variant-numeric: tabular-nums; }
	.checklist-active-filter { display: block; color: var(--color-primary); font-size: 11px; line-height: 1.15; }
	.checklist-header-actions button.active { color: var(--color-primary); }
	.checklist-tools, .checklist-undo { position: fixed; z-index: 31; left: 50%; transform: translateX(-50%); background: var(--modal-bg); }
	.checklist-tools { bottom: 0; display: flex; flex-wrap: wrap; width: 100%; max-width: 430px; padding: 4px 12px calc(6px + env(safe-area-inset-bottom)); border-top: 1px solid var(--bubble-container-border); }
	.checklist-tools button, .checklist-undo button { display: flex; align-items: center; justify-content: center; gap: 5px; min-height: 44px; padding: 2px 6px; font-size: 13px; font-weight: 600; flex: 1; }
	.checklist-tools button:disabled { opacity: .45; }
	.checklist-tools .delete-selected { flex-basis: 100%; color: var(--color-error); border-top: 1px solid var(--bubble-container-border); }
	.checklist-undo { bottom: calc(7rem + env(safe-area-inset-bottom)); display: flex; align-items: center; gap: 12px; padding: 0 12px; border: 1px solid var(--bubble-container-border); border-radius: 12px; white-space: nowrap; font-size: 14px; }
	.checklist-undo button { color: var(--color-primary); }
</style>
