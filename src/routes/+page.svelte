<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { initSync } from '$lib/sync/manager';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ListCard from '$lib/components/ListCard.svelte';
	import AddListModal from '$lib/components/AddListModal.svelte';

	let { data } = $props();

	type ListItem = { id: string; name: string; description: string | null; openCount: number; updatedAt: number };

	let lists = $state<ListItem[]>([]);
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let loading = $state(true);

	const openCount = $derived(lists.length);

	async function loadLists() {
		const res = await fetch('/api/lists');
		if (res.ok) lists = await res.json();
		loading = false;
	}

	async function createList(name: string, description: string) {
		const res = await fetch('/api/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description })
		});
		if (res.ok) {
			const newList = await res.json();
			lists = [...lists, { ...newList, openCount: 0 }];
		}
		addModalOpen = false;
	}

	async function deleteList(id: string) {
		lists = lists.filter(l => l.id !== id);
		await fetch(`/api/lists/${id}`, { method: 'DELETE' });
	}

	onMount(() => {
		loadLists();
		initSync();

		if (data.user?.mustChangePassword) {
			goto('/einstellungen?mustChange=1');
		}
	});
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title="Meine Listen"
		subtitle="{openCount} aktive {openCount === 1 ? 'Liste' : 'Listen'}"
		onMenuOpen={() => menuOpen = true}
	/>

	<!-- Bottom-Anchored Content -->
	<div class="flex-1 flex flex-col justify-end overflow-y-auto pt-24 pb-28 px-4 min-h-0">
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if lists.length === 0}
			<div class="text-center py-12">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">Noch keine Listen. Tippe + um eine zu erstellen.</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each lists as list (list.id)}
					<ListCard
						{list}
						onClick={() => goto(`/listen/${list.id}`)}
						onDelete={() => deleteList(list.id)}
					/>
				{/each}
			</div>
		{/if}
	</div>

	<BottomNav onAdd={() => addModalOpen = true} />
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

{#if addModalOpen}
	<AddListModal
		onSave={createList}
		onClose={() => addModalOpen = false}
	/>
{/if}
