<script lang="ts">
	import { onMount } from 'svelte';
	import { currentLang } from '$lib/i18n.svelte';
	import { watchVisualViewportBottomOffset } from '$lib/visualViewport';

	let { listId, listName, onClose }: {
		listId: string;
		listName: string;
		onClose: () => void;
	} = $props();

	type Member = { userId: string; username: string; permission: string; status: string };

	let members = $state<Member[]>([]);
	let newUsername = $state('');
	let newPermission = $state<'write' | 'read'>('write');
	let error = $state('');
	let loading = $state(true);
	let adding = $state(false);
	let bottomOffset = $state(0);

	const lang = $derived(currentLang());
	const t = $derived({
		title: lang === 'en' ? 'Share list' : 'Liste teilen',
		members: lang === 'en' ? 'Shared with' : 'Geteilt mit',
		placeholder: lang === 'en' ? 'Username' : 'Benutzername',
		add: lang === 'en' ? 'Add' : 'Hinzufügen',
		remove: lang === 'en' ? 'Remove' : 'Entfernen',
		done: lang === 'en' ? 'Done' : 'Fertig',
		empty: lang === 'en' ? 'Not shared with anyone yet.' : 'Noch mit niemandem geteilt.',
		notFound: lang === 'en' ? 'User not found.' : 'Benutzer nicht gefunden.',
		selfShare: lang === 'en' ? 'Cannot share with yourself.' : 'Du kannst die Liste nicht mit dir selbst teilen.',
		alreadyShared: lang === 'en' ? 'Already shared with this user.' : 'Bereits mit diesem Benutzer geteilt.'
	});

	async function loadMembers() {
		loading = true;
		const res = await fetch(`/api/lists/${listId}/members`);
		if (res.ok) members = await res.json();
		loading = false;
	}

	async function addMember() {
		const username = newUsername.trim();
		if (!username) return;
		error = '';
		adding = true;
		const res = await fetch(`/api/lists/${listId}/members`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, permission: newPermission })
		});
		if (res.ok) {
			const member = await res.json();
			members = [...members, member];
			newUsername = '';
		} else {
			const data = await res.json();
			if (res.status === 404) error = t.notFound;
			else if (data.error?.includes('selbst') || data.error?.includes('yourself')) error = t.selfShare;
			else error = data.error ?? t.notFound;
		}
		adding = false;
	}

	async function removeMember(userId: string) {
		const res = await fetch(`/api/lists/${listId}/members/${userId}`, { method: 'DELETE' });
		if (res.ok) {
			members = members.filter(m => m.userId !== userId);
		}
	}

	onMount(() => {
		void loadMembers();
		return watchVisualViewportBottomOffset((offset) => {
			bottomOffset = offset;
		});
	});
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-4 pt-3"
     style="background-color: var(--color-surface-low); bottom: {bottomOffset}px">
	<div class="flex justify-center mb-2">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<div class="flex items-baseline gap-2 mb-3">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{t.title}</h2>
		<span class="text-sm truncate" style="color: var(--color-on-surface-variant)">· {listName}</span>
	</div>

	<!-- Mitgliederliste -->
	<div class="mb-3">
		{#if loading}
			<div class="flex justify-center py-3">
				<div class="w-5 h-5 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if members.length === 0}
			<p class="text-sm py-2" style="color: var(--color-on-surface-variant)">{t.empty}</p>
		{:else}
			<div class="rounded-2xl overflow-hidden mb-3" style="background-color: var(--color-surface-container)">
				{#each members as member (member.userId)}
					<div class="flex items-center gap-3 px-3 py-2.5">
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
							<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
							<circle cx="12" cy="7" r="4"/>
						</svg>
						<span class="flex-1 text-sm font-medium" style="color: var(--color-on-surface)">{member.username}</span>
						{#if member.status === 'pending'}
							<span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
							      style="background-color: color-mix(in srgb, #f59e0b 15%, transparent); color: #f59e0b">
								{lang === 'en' ? 'Pending' : 'Ausstehend'}
							</span>
						{:else if member.permission === 'read'}
							<span class="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
							      style="background-color: color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent); color: var(--color-on-surface-variant)">
								{lang === 'en' ? 'View' : 'Lesen'}
							</span>
						{/if}
						<button onclick={() => removeMember(member.userId)}
							class="p-1 rounded-lg" style="color: var(--color-error)" aria-label={t.remove}>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Neues Mitglied hinzufügen -->
	<div class="rounded-2xl overflow-hidden mb-3" style="background-color: var(--color-surface-container)">
		<div class="flex items-center gap-2 px-3" style="height: 44px">
			<input
				type="text"
				placeholder={t.placeholder}
				bind:value={newUsername}
				onkeydown={(e) => e.key === 'Enter' && addMember()}
				class="flex-1 bg-transparent outline-none text-sm"
				style="color: var(--color-on-surface); font-size: 16px"
			/>
			<button
				onclick={() => newPermission = newPermission === 'write' ? 'read' : 'write'}
				class="p-2 rounded-xl flex items-center justify-center transition-colors flex-shrink-0"
				style="color: {newPermission === 'write' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				title={newPermission === 'write' ? (lang === 'en' ? 'Write access' : 'Schreibzugriff') : (lang === 'en' ? 'Read only' : 'Nur lesen')}
			>
				{#if newPermission === 'write'}
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				{:else}
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
						<circle cx="12" cy="12" r="3"/>
					</svg>
				{/if}
			</button>
			<button onclick={addMember} disabled={adding || !newUsername.trim()}
				class="px-4 h-8 rounded-xl text-sm font-semibold disabled:opacity-40 transition-opacity flex-shrink-0"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
				{adding ? '...' : t.add}
			</button>
		</div>
	</div>

	{#if error}
		<div class="rounded-xl px-4 py-2 mb-3 text-xs"
		     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
			{error}
		</div>
	{/if}

	<button onclick={onClose} class="w-full py-3 rounded-full text-sm font-semibold"
		style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
		{t.done}
	</button>
</div>
