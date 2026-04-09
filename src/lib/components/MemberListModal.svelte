<script lang="ts">
	import { onMount } from 'svelte';
	import { currentLang } from '$lib/i18n.svelte';
	import { watchVisualViewportBottomOffset } from '$lib/visualViewport';

	let { list, currentUserId, onLeave, onClose }: {
		list: { id: string; name: string; ownerUsername?: string | null };
		currentUserId: string;
		onLeave: () => void;
		onClose: () => void;
	} = $props();

	const lang = $derived(currentLang());
	let notificationsEnabled = $state(true);
	let notifLoading = $state(false);
	let bottomOffset = $state(0);

	onMount(() => {
		fetch(`/api/lists/${list.id}/notifications`)
			.then(r => r.json())
			.then(d => { notificationsEnabled = d.enabled ?? true; })
			.catch(() => {});
		return watchVisualViewportBottomOffset((offset) => {
			bottomOffset = offset;
		});
	});

	async function toggleNotifications() {
		if (notifLoading) return;
		notifLoading = true;
		const next = !notificationsEnabled;
		await fetch(`/api/lists/${list.id}/notifications`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: next })
		}).catch(() => {});
		notificationsEnabled = next;
		notifLoading = false;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low); bottom: {bottomOffset}px">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<h2 class="text-lg font-bold mb-1" style="color: var(--color-on-surface)">{list.name}</h2>
	<p class="text-sm mb-5" style="color: var(--color-on-surface-variant)">
		{#if list.ownerUsername}
			{lang === 'en' ? `Shared by ${list.ownerUsername}` : `Von ${list.ownerUsername} geteilt`}
		{:else}
			{lang === 'en' ? 'Shared with you' : 'Mit dir geteilt'}
		{/if}
	</p>

	<!-- Notification Toggle -->
	<button
		type="button"
		onclick={toggleNotifications}
		disabled={notifLoading}
		class="w-full flex items-center gap-3 px-4 py-3 rounded-xl mb-4 active:opacity-70 transition-opacity"
		style="background-color: var(--color-surface-container)"
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
		     stroke={notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}
		     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
			{#if notificationsEnabled}
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
				<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
			{:else}
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
				<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				<line x1="1" y1="1" x2="23" y2="23"/>
			{/if}
		</svg>
		<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
			{lang === 'en' ? 'Notifications' : 'Benachrichtigungen'}
		</span>
		<span class="text-xs font-medium" style="color: {notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}">
			{notificationsEnabled ? (lang === 'en' ? 'On' : 'An') : (lang === 'en' ? 'Off' : 'Aus')}
		</span>
	</button>

	<div class="flex gap-3">
		<button
			onclick={onClose}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{lang === 'en' ? 'Cancel' : 'Abbrechen'}
		</button>
		<button
			onclick={() => { if (confirm(lang === 'en' ? 'Leave this list?' : 'Liste verlassen?')) { onLeave(); onClose(); } }}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
		>
			{lang === 'en' ? 'Leave list' : 'Liste verlassen'}
		</button>
	</div>
</div>
