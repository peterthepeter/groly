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

	let { data } = $props();

	type Item = { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; updatedAt: number };

	let listName = $state('');
	let items = $state<Item[]>([]);
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let loading = $state(true);
	let editItem = $state<Item | null>(null);

	const listId = $derived($page.params.id);
	const openItems = $derived(items.filter(i => !i.isChecked));
	const checkedItems = $derived(
		items.filter(i => i.isChecked).sort((a, b) => (b.checkedAt ?? 0) - (a.checkedAt ?? 0)).slice(0, 6)
	);
	const openCount = $derived(openItems.length);

	async function loadItems() {
		const [listRes, itemsRes] = await Promise.all([
			fetch(`/api/lists/${listId}`),
			fetch(`/api/lists/${listId}/items`)
		]);
		if (listRes.ok) {
			const list = await listRes.json();
			listName = list.name;
		}
		if (itemsRes.ok) items = await itemsRes.json();
		loading = false;
	}

	async function toggleItem(item: Item) {
		const newChecked = !item.isChecked;
		// Optimistisch updaten
		items = items.map(i => i.id === item.id ? { ...i, isChecked: newChecked, checkedAt: newChecked ? Math.floor(Date.now() / 1000) : null } : i);
		await fetch(`/api/items/${item.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ isChecked: newChecked })
		});
	}

	async function saveItem(name: string, quantityInfo: string) {
		if (editItem) {
			items = items.map(i => i.id === editItem!.id ? { ...i, name, quantityInfo: quantityInfo || null } : i);
			await fetch(`/api/items/${editItem.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, quantityInfo })
			});
			editItem = null;
		} else {
			const res = await fetch(`/api/lists/${listId}/items`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, quantityInfo })
			});
			if (res.ok) {
				const newItem = await res.json();
				items = [...items, newItem];
			}
		}
		addModalOpen = false;
	}

	async function deleteItem(id: string) {
		items = items.filter(i => i.id !== id);
		await fetch(`/api/items/${id}`, { method: 'DELETE' });
	}

	onMount(loadItems);
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={listName || 'Liste'}
		subtitle="{openCount} {openCount === 1 ? 'Element' : 'Elemente'}"
		onMenuOpen={() => menuOpen = true}
	/>

	<!-- Bottom-Anchored Content -->
	<div class="flex-1 flex flex-col justify-end overflow-y-auto pt-24 pb-28 px-4 min-h-0">
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
					<p class="text-sm" style="color: var(--color-on-surface-variant)">Noch keine Items. Tippe + um eines hinzuzufügen.</p>
				</div>
			{:else if openItems.length > 0}
				<div class="grid grid-cols-3 gap-3 mt-3">
					{#each openItems as item (item.id)}
						<ItemTile
							{item}
							onTap={() => toggleItem(item)}
							onLongPress={() => { editItem = item; addModalOpen = true; }}
							onDelete={() => deleteItem(item.id)}
						/>
					{/each}
				</div>
			{/if}
		{/if}
	</div>

	<BottomNav onAdd={() => { editItem = null; addModalOpen = true; }} />
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

{#if addModalOpen}
	<AddItemModal
		item={editItem}
		onSave={saveItem}
		onClose={() => { addModalOpen = false; editItem = null; }}
	/>
{/if}
