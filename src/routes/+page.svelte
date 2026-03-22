<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { initSync, execute, cacheListsData, getOfflineLists, updateOfflineList, deleteOfflineList } from '$lib/sync/manager';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import ListCard from '$lib/components/ListCard.svelte';
	import AddListModal from '$lib/components/AddListModal.svelte';
	import ShareListModal from '$lib/components/ShareListModal.svelte';
	import { t, lists_active } from '$lib/i18n.svelte';

	let { data } = $props();

	type ListItem = { id: string; name: string; description: string | null; iconId: string | null; ownerId: string; openCount: number; memberCount: number; updatedAt: number; isOwner: boolean; ownerUsername: string | null };

	let lists = $state<ListItem[]>([]);
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let editList = $state<ListItem | null>(null);
	let shareList = $state<ListItem | null>(null);
	let loading = $state(true);

	const openCount = $derived(lists.length);

	async function loadLists() {
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) throw new Error();
			lists = await res.json();
			void cacheListsData(lists);
		} catch {
			lists = await getOfflineLists();
		}
		loading = false;
	}

	async function createList(name: string, description: string, iconId: string | null) {
		const res = await fetch('/api/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, iconId })
		});
		if (res.ok) {
			const newList = await res.json();
			lists = [...lists, { ...newList, openCount: 0 }];
			void cacheListsData(lists);
		}
		addModalOpen = false;
	}

	async function saveEditList(name: string, description: string, iconId: string | null) {
		if (!editList) return;
		const id = editList.id;
		editList = null;
		await execute(
			() => fetch(`/api/lists/${id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description, iconId })
			}).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'update_list', payload: { id, name, description, iconId }, createdAt: Date.now() },
			() => {
				lists = lists.map(l => l.id === id ? { ...l, name, description: description || null, iconId } : l);
				void updateOfflineList(id, { name, description: description || null });
			}
		);
	}

	async function deleteList(id: string) {
		editList = null;
		await execute(
			() => fetch(`/api/lists/${id}`, { method: 'DELETE' }).then(r => { if (!r.ok) throw new Error(); }),
			{ type: 'delete_list', payload: { id }, createdAt: Date.now() },
			() => {
				lists = lists.filter(l => l.id !== id);
				void deleteOfflineList(id);
			}
		);
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
		title={t.lists_title}
		subtitle={lists_active(openCount)}
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
		{:else if lists.length === 0}
			<div class="text-center py-12">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.lists_empty}</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#each lists as list (list.id)}
					<ListCard
						{list}
						onClick={() => goto(`/listen/${list.id}`)}
						onLongPress={() => { if (list.isOwner) editList = list; }}
						onShare={list.isOwner && list.memberCount > 0 ? () => { shareList = list; } : null}
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

{#if editList}
	<AddListModal
		list={editList}
		onSave={saveEditList}
		onDelete={() => deleteList(editList!.id)}
		onShare={() => { shareList = editList; editList = null; }}
		onClose={() => editList = null}
	/>
{/if}

{#if shareList}
	<ShareListModal
		listId={shareList.id}
		listName={shareList.name}
		onClose={() => shareList = null}
	/>
{/if}
