<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { on } from '$lib/sseStore.svelte';
	import { goto } from '$app/navigation';
	import { initSync, execute, cacheListsData, getOfflineLists, updateOfflineList, deleteOfflineList } from '$lib/sync/manager';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import ListCard from '$lib/components/ListCard.svelte';
	import AddListModal from '$lib/components/AddListModal.svelte';
	import ShareListModal from '$lib/components/ShareListModal.svelte';
	import InvitationCard from '$lib/components/InvitationCard.svelte';
	import MemberListModal from '$lib/components/MemberListModal.svelte';
	import { t, lists_active } from '$lib/i18n.svelte';
	import { getListIcon } from '$lib/listIcons';
	import { env as publicEnv } from '$env/dynamic/public';

	const PUBLIC_VAPID_KEY = publicEnv.PUBLIC_VAPID_PUBLIC_KEY ?? '';

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
	let showPushPrompt = $state(false);
	let pushPromptLoading = $state(false);

	const PUSH_PROMPT_KEY = 'groly_push_prompt_dismissed';

	function isPWA(): boolean {
		if (typeof window === 'undefined') return false;
		return window.matchMedia('(display-mode: standalone)').matches ||
			(navigator as { standalone?: boolean }).standalone === true;
	}

	async function checkPushPrompt() {
		if (!isPWA()) return;
		if (localStorage.getItem(PUSH_PROMPT_KEY)) return;
		if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return;
		if (Notification.permission !== 'default') return;
		// Small delay so the page settles first
		await new Promise(r => setTimeout(r, 1500));
		showPushPrompt = true;
	}

	function dismissPushPrompt() {
		localStorage.setItem(PUSH_PROMPT_KEY, '1');
		showPushPrompt = false;
	}

	function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		const buffer = new ArrayBuffer(rawData.length);
		const view = new Uint8Array(buffer);
		for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
		return view;
	}

	async function acceptPushPrompt() {
		if (!PUBLIC_VAPID_KEY) { dismissPushPrompt(); return; }
		pushPromptLoading = true;
		try {
			// iOS: requestPermission zuerst, solange User-Gesture-Kontext aktiv
			const perm = await Notification.requestPermission();
			if (perm === 'granted') {
				const reg = await navigator.serviceWorker.ready;
				const sub = await reg.pushManager.subscribe({
					userVisibleOnly: true,
					applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
				});
				const json = sub.toJSON();
				await fetch('/api/push/subscribe', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
				});
			}
		} catch { /* ignore */ }
		pushPromptLoading = false;
		dismissPushPrompt();
	}

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
		// Gecachte Daten sofort anzeigen (stale-while-revalidate)
		const cached = await getOfflineLists();
		if (cached.length > 0 && lists.length === 0) {
			lists = cached as unknown as ListItem[];
			loading = false;
		}

		try {
			const res = await fetch('/api/lists');
			if (!res.ok) throw new Error();
			const json = await res.json();
			const newLists: ListItem[] = (json && typeof json === 'object' && 'lists' in json) ? json.lists : json;
			const newInvitations = json?.pendingInvitations ?? [];
			// Cache als plain objects (vor State-Zuweisung, um Svelte-Proxy-Probleme mit IndexedDB zu vermeiden)
			void cacheListsData(newLists);
			lists = newLists;
			pendingInvitations = newInvitations;
		} catch {
			if (lists.length === 0) {
				lists = (await getOfflineLists()) as unknown as ListItem[];
				pendingInvitations = [];
			}
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

	// Long-press auf Listen-Tab → Sortier-Modus
	let listsTabPressTimer: ReturnType<typeof setTimeout> | null = null;
	let listsTabLongFired = false;

	function handleListsTabPointerDown() {
		listsTabLongFired = false;
		listsTabPressTimer = setTimeout(() => {
			listsTabLongFired = true;
			listsTabPressTimer = null;
			if (sortMode) exitSortMode(); else enterSortMode();
		}, 500);
	}
	function handleListsTabPointerUp() {
		if (listsTabPressTimer) { clearTimeout(listsTabPressTimer); listsTabPressTimer = null; }
	}
	function handleListsTabClick() {
		if (listsTabLongFired) { listsTabLongFired = false; return; }
		// short tap on lists tab: go to / (already there)
	}

	onMount(() => {
		loadCustomOrder();
		loadLists();
		initSync();
		if (data.user?.mustChangePassword) goto('/einstellungen?mustChange=1');
		else checkPushPrompt();

		const handleOnline = () => void loadLists();
		window.addEventListener('online', handleOnline);
		return () => window.removeEventListener('online', handleOnline);
	});

	// SSE-Handler: Live-Updates für die Übersicht
	const offHandlers = [
		on('sse_connected', () => void loadLists()),
		on('list_invitation', (ev) => {
			const inv = ev.invitation as PendingInvitation;
			if (!pendingInvitations.some(i => i.id === inv.id)) {
				pendingInvitations = [...pendingInvitations, inv];
			}
		}),
		on('list_member_count_changed', (ev) => {
			lists = lists.map(l => l.id === ev.listId ? { ...l, memberCount: ev.memberCount as number } : l);
		}),
		on('list_updated', (ev) => {
			const update = ev.list as Partial<ListItem>;
			lists = lists.map(l => l.id === ev.listId ? { ...l, ...update } : l);
		}),
		on('list_deleted', (ev) => {
			lists = lists.filter(l => l.id !== ev.listId);
			pendingInvitations = pendingInvitations.filter(i => i.id !== ev.listId);
			customOrder = customOrder.filter(id => id !== ev.listId);
		}),
		on('item_added', (ev) => {
			lists = lists.map(l => l.id === ev.listId ? { ...l, openCount: l.openCount + 1 } : l);
		}),
		on('item_updated', (ev) => {
			const delta = (ev.openCountDelta as number) ?? 0;
			if (delta !== 0) {
				lists = lists.map(l => l.id === ev.listId ? { ...l, openCount: Math.max(0, l.openCount + delta) } : l);
			}
		}),
		on('item_deleted', (ev) => {
			if (!ev.wasChecked) {
				lists = lists.map(l => l.id === ev.listId ? { ...l, openCount: Math.max(0, l.openCount - 1) } : l);
			}
		}),
	];

	onDestroy(() => offHandlers.forEach(off => off()));
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
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
	     style="padding-top: calc(env(safe-area-inset-top) + 4rem); padding-bottom: 5rem">
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

	<!-- Bottom Nav mit Rezepte-Tab -->
	<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
	     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
		<div class="flex items-center gap-3 pointer-events-auto">
			<!-- Listen Tab (active) -->
			<button
				onclick={handleListsTabClick}
				onpointerdown={handleListsTabPointerDown}
				onpointerup={handleListsTabPointerUp}
				onpointercancel={handleListsTabPointerUp}
				oncontextmenu={(e) => e.preventDefault()}
				class="flex items-center gap-2 px-6 h-14 rounded-full glass active:opacity-70 transition-opacity select-none"
				style="background-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-container)); outline: 1.5px solid color-mix(in srgb, var(--color-primary) 40%, transparent)"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
					<line x1="3" y1="6" x2="21" y2="6"/>
					<path d="M16 10a4 4 0 0 1-8 0"/>
				</svg>
				<span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-primary)">{t.nav_lists}</span>
			</button>

			<!-- FAB Add Button -->
			<button
				onclick={() => { if (!sortMode) addModalOpen = true; }}
				class="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
				style="background-color: var(--color-primary)"
				aria-label={t.add}
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
			</button>

			<!-- Rezepte Tab -->
			<button
				onclick={() => goto('/rezepte')}
				class="flex items-center gap-2 px-6 h-14 rounded-full glass active:opacity-70 transition-opacity select-none"
				style="background-color: color-mix(in srgb, var(--color-surface-container) 85%, transparent)"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
				</svg>
				<span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-on-surface-variant)">{t.nav_recipes}</span>
			</button>
		</div>
	</div>
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

<!-- Push Notification Prompt -->
{#if showPushPrompt}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={dismissPushPrompt}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-10 pt-4"
	     style="background-color: var(--color-surface-low)">
		<div class="flex justify-center mb-5">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		<!-- Icon -->
		<div class="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
		     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
			<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
				<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
			</svg>
		</div>

		<h2 class="text-lg font-bold mb-1" style="color: var(--color-on-surface)">{t.push_prompt_title}</h2>
		<p class="text-sm mb-6" style="color: var(--color-on-surface-variant)">{t.push_prompt_body}</p>

		<div class="flex gap-3">
			<button
				onclick={dismissPushPrompt}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>
				{t.push_prompt_decline}
			</button>
			<button
				onclick={acceptPushPrompt}
				disabled={pushPromptLoading}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-60"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{#if pushPromptLoading}
					<span class="inline-block w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></span>
				{:else}
					{t.push_prompt_accept}
				{/if}
			</button>
		</div>
	</div>
{/if}
