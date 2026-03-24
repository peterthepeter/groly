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
	import InvitationCard from '$lib/components/InvitationCard.svelte';
	import MemberListModal from '$lib/components/MemberListModal.svelte';
	import { t, lists_active } from '$lib/i18n.svelte';
	import { getListIcon } from '$lib/listIcons';

	let { data } = $props();

	type ListItem = { id: string; name: string; description: string | null; iconId: string | null; ownerId: string; openCount: number; memberCount: number; updatedAt: number; isOwner: boolean; ownerUsername: string | null };
	type PendingInvitation = { id: string; name: string; description: string | null; iconId: string | null; ownerId: string; ownerUsername: string | null; openCount: number; updatedAt: number };

	const STORAGE_KEY = 'groly_list_order';

	let lists = $state<ListItem[]>([]);
	let pendingInvitations = $state<PendingInvitation[]>([]);
	let menuOpen = $state(false);
	let addModalOpen = $state(false);
	let editList = $state<ListItem | null>(null);
	let shareList = $state<ListItem | null>(null);
	let memberOptions = $state<ListItem | null>(null);
	let loading = $state(true);
	let sortMode = $state(false);
	let customOrder = $state<string[]>([]);

	const openCount = $derived(lists.length);

	// Sortierte Listen: entweder custom oder API-Reihenfolge
	const displayedLists = $derived(
		customOrder.length > 0
			? (() => {
				const mapped = customOrder.map(id => lists.find(l => l.id === id)).filter(Boolean) as ListItem[];
				// Neu hinzugekommene Listen ans Ende
				const missing = lists.filter(l => !customOrder.includes(l.id));
				return [...mapped, ...missing];
			})()
			: lists
	);

	function loadCustomOrder() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			customOrder = stored ? JSON.parse(stored) : [];
		} catch { customOrder = []; }
	}

	function saveCustomOrder() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(customOrder));
	}

	function enterSortMode() {
		// Startet mit aktueller Reihenfolge
		customOrder = displayedLists.map(l => l.id);
		sortMode = true;
	}

	function exitSortMode() {
		saveCustomOrder();
		sortMode = false;
	}

	function moveUp(index: number) {
		if (index === 0) return;
		const next = [...customOrder];
		[next[index - 1], next[index]] = [next[index], next[index - 1]];
		customOrder = next;
	}

	function moveDown(index: number) {
		if (index === customOrder.length - 1) return;
		const next = [...customOrder];
		[next[index], next[index + 1]] = [next[index + 1], next[index]];
		customOrder = next;
	}

	async function loadLists() {
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) throw new Error();
			const json = await res.json();
			if (json && typeof json === 'object' && 'lists' in json) {
				lists = json.lists;
				pendingInvitations = json.pendingInvitations ?? [];
				void cacheListsData(lists);
			} else {
				lists = json;
				void cacheListsData(lists);
			}
		} catch {
			lists = (await getOfflineLists()) as unknown as ListItem[];
			pendingInvitations = [];
		}
		loading = false;
	}

	async function createList(name: string, description: string, iconId: string | null, shareAfterCreate?: boolean) {
		const res = await fetch('/api/lists', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ name, description, iconId })
		});
		if (res.ok) {
			const newList = await res.json();
			const listWithCount = { ...newList, openCount: 0 };
			lists = [...lists, listWithCount];
			void cacheListsData(lists);
			if (shareAfterCreate) {
				shareList = listWithCount;
			}
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
				customOrder = customOrder.filter(oid => oid !== id);
				void deleteOfflineList(id);
			}
		);
	}

	async function acceptInvitation(listId: string, userId: string, enableNotifications: boolean) {
		if (!enableNotifications) {
			await fetch(`/api/lists/${listId}/notifications`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ enabled: false })
			});
		}
		const res = await fetch(`/api/lists/${listId}/members/${userId}/accept`, { method: 'POST' });
		if (res.ok) await loadLists();
	}

	async function leaveList(listId: string) {
		const res = await fetch(`/api/lists/${listId}/members/${data.user?.id}`, { method: 'DELETE' });
		if (res.ok) {
			lists = lists.filter(l => l.id !== listId);
			customOrder = customOrder.filter(id => id !== listId);
		}
	}

	async function declineInvitation(listId: string, userId: string) {
		const res = await fetch(`/api/lists/${listId}/members/${userId}`, { method: 'DELETE' });
		if (res.ok) pendingInvitations = pendingInvitations.filter(i => i.id !== listId);
	}

	onMount(() => {
		loadCustomOrder();
		loadLists();
		initSync();
		if (data.user?.mustChangePassword) goto('/einstellungen?mustChange=1');
	});
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={sortMode ? 'Sortierung' : t.lists_title}
		subtitle={sortMode ? 'Reihenfolge anpassen' : lists_active(openCount)}
		onMenuOpen={() => { if (!sortMode) menuOpen = true; }}
	>
		{#snippet actions()}
			{#if sortMode}
				<button
					onclick={exitSortMode}
					class="px-4 py-1.5 rounded-full text-sm font-semibold"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					Fertig
				</button>
			{/if}
		{/snippet}
	</AppHeader>

	<!-- Bottom-Anchored Content -->
	<div class="flex-1 flex flex-col justify-end overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + 4rem); padding-bottom: 6.5rem">
		{#if loading}
			<div class="flex justify-center py-8">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if lists.length === 0 && pendingInvitations.length === 0}
			<div class="text-center py-12">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.lists_empty}</p>
			</div>
		{:else}
			<div class="space-y-3">
				{#if sortMode}
					{#each displayedLists as list, i (list.id)}
						<div class="flex items-center gap-2">
							<!-- Sort controls -->
							<div class="flex flex-col gap-0.5 flex-shrink-0">
								<button
									onclick={() => moveUp(i)}
									disabled={i === 0}
									class="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-20 active:opacity-60"
									style="color: var(--color-on-surface-variant)"
									aria-label="Nach oben"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="18 15 12 9 6 15"/>
									</svg>
								</button>
								<button
									onclick={() => moveDown(i)}
									disabled={i === displayedLists.length - 1}
									class="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-20 active:opacity-60"
									style="color: var(--color-on-surface-variant)"
									aria-label="Nach unten"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="6 9 12 15 18 9"/>
									</svg>
								</button>
							</div>

							<!-- Card (nicht navigierbar im Sort-Modus) -->
							<div class="flex-1 flex items-center gap-4 px-4 py-4 rounded-2xl"
							     style="background-color: var(--color-surface-card)">
								{#if getListIcon(list.iconId)}
									{@const icon = getListIcon(list.iconId)!}
									<svg class="flex-shrink-0" width="28" height="28" viewBox="0 0 24 24" fill="none"
									     stroke={icon.color} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
										{@html icon.svgContent}
									</svg>
								{:else}
									<span class="flex-shrink-0 w-7 h-7 flex items-center justify-center font-bold text-xl"
									      style="color: var(--color-primary)">
										{list.name[0]?.toUpperCase() ?? '?'}
									</span>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{list.name}</div>
									{#if list.description}
										<div class="text-xs truncate mt-0.5" style="color: var(--color-on-surface-variant)">{list.description}</div>
									{/if}
								</div>
								<!-- Drag indicator -->
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
									<line x1="3" y1="8" x2="21" y2="8"/>
									<line x1="3" y1="16" x2="21" y2="16"/>
								</svg>
							</div>
						</div>
					{/each}
				{:else}
					{#each displayedLists as list (list.id)}
						<ListCard
							{list}
							onClick={() => goto(`/listen/${list.id}`)}
							onLongPress={list.isOwner ? () => { editList = list; } : () => { memberOptions = list; }}
							onShare={list.isOwner && list.memberCount > 0 ? () => { shareList = list; } : null}
						/>
					{/each}
					{#each pendingInvitations as invitation (invitation.id)}
						<InvitationCard
							{invitation}
							currentUserId={data.user?.id ?? ''}
							onAccept={(enableNotif) => acceptInvitation(invitation.id, data.user?.id ?? '', enableNotif)}
							onDecline={() => declineInvitation(invitation.id, data.user?.id ?? '')}
						/>
					{/each}
				{/if}
			</div>
		{/if}
	</div>

	<BottomNav
		onAdd={() => { if (!sortMode) addModalOpen = true; }}
		onListsPress={() => { if (sortMode) exitSortMode(); else enterSortMode(); }}
	/>
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
		memberCount={editList.memberCount}
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

{#if memberOptions}
	<MemberListModal
		list={memberOptions}
		currentUserId={data.user?.id ?? ''}
		onLeave={() => leaveList(memberOptions!.id)}
		onClose={() => memberOptions = null}
	/>
{/if}
