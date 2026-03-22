<script lang="ts">
	import { onMount } from 'svelte';
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
	// Empty prefix slots so the grid fills bottom-up (empty slots at top-left)
	const gridPrefix = $derived(openItems.length % 3 === 0 ? 0 : 3 - (openItems.length % 3));

	async function loadItems() {
		try {
			const [listRes, itemsRes, suggestRes] = await Promise.all([
				fetch(`/api/lists/${listId}`),
				fetch(`/api/lists/${listId}/items`),
				fetch('/api/suggestions')
			]);
			if (!listRes.ok || !itemsRes.ok) throw new Error();
			listName = (await listRes.json()).name;
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
		const newChecked = !item.isChecked;
		const newCheckedAt = newChecked ? Math.floor(Date.now() / 1000) : null;
		await execute(
			() => fetch(`/api/items/${item.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ isChecked: newChecked })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'update_item', payload: { id: item.id, isChecked: newChecked }, createdAt: Date.now() },
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
		editItem = null;
		addModalOpen = false;
		await execute(
			() => fetch(`/api/items/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, quantityInfo, categoryOverride })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'update_item', payload: { id, name, quantityInfo, categoryOverride }, createdAt: Date.now() },
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
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={listName || 'Liste'}
		subtitle={list_items_open(openCount)}
		onMenuOpen={() => menuOpen = true}
	/>

	<!-- Bottom-Anchored Content -->
	<div class="flex-1 flex flex-col justify-end overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + 4rem); padding-bottom: 6.5rem">
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
			{:else if openItems.length > 0}
				<div class="grid grid-cols-3 gap-3 mt-3" style={userSettings.categorySortEnabled ? 'direction: rtl' : ''}>
					{#each { length: gridPrefix } as _}
						<div class="aspect-square"></div>
					{/each}
					{#each openItems as item (item.id)}
						<ItemTile
							{item}
							onTap={() => toggleItem(item)}
							onLongPress={() => { editItem = item; addModalOpen = true; }}
							createdByUsername={item.createdByUsername}
							currentUsername={data.user?.username ?? null}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	{#if !addModalOpen}
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
