<script lang="ts">
	import { getListIcon } from '$lib/listIcons';

	const COLORS = ['#006c54', '#2e6771', '#4d626c', '#5a4080', '#a0522d', '#1a6b3c'];
	function colorForName(name: string): string {
		let hash = 0;
		for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	let { invitation, currentUserId, onAccept, onDecline }: {
		invitation: { id: string; name: string; description: string | null; iconId: string | null; ownerUsername: string | null };
		currentUserId: string;
		onAccept: (enableNotifications: boolean) => void;
		onDecline: () => void;
	} = $props();

	let notificationsEnabled = $state(true);

	const icon = $derived(getListIcon(invitation.iconId));
	const color = $derived(icon ? icon.color : colorForName(invitation.name));
	const initial = $derived(invitation.name[0]?.toUpperCase() ?? '?');
</script>

<div class="w-full flex items-center gap-4 px-4 py-4 rounded-2xl text-left"
     style="background-color: var(--color-surface-card)">

	<!-- Icon -->
	{#if icon}
		<svg class="flex-shrink-0" width="28" height="28" viewBox="0 0 24 24" fill="none"
		     stroke={color} stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">
			{@html icon.svgContent}
		</svg>
	{:else}
		<span class="flex-shrink-0 w-7 h-7 flex items-center justify-center font-bold text-xl"
		      style="color: {color}">
			{initial}
		</span>
	{/if}

	<!-- Text -->
	<div class="flex-1 min-w-0">
		<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{invitation.name}</div>
		<div class="text-xs truncate mt-0.5" style="color: var(--color-on-surface-variant)">
			{invitation.ownerUsername ?? 'Jemand'} möchte teilen
		</div>
	</div>

	<!-- Actions -->
	<div class="flex items-center gap-1 flex-shrink-0">
		<!-- Bell toggle -->
		<button
			onclick={() => notificationsEnabled = !notificationsEnabled}
			class="p-2 rounded-lg active:opacity-60"
			aria-label={notificationsEnabled ? 'Benachrichtigungen deaktivieren' : 'Benachrichtigungen aktivieren'}
		>
			{#if notificationsEnabled}
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
			{:else}
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					<line x1="1" y1="1" x2="23" y2="23"/>
				</svg>
			{/if}
		</button>

		<!-- Ablehnen -->
		<button
			onclick={onDecline}
			class="px-3 py-2 rounded-full text-xs font-semibold active:opacity-60"
			style="color: var(--color-error)"
		>
			Nein
		</button>

		<!-- Annehmen -->
		<button
			onclick={() => onAccept(notificationsEnabled)}
			class="px-3 py-2 rounded-full text-xs font-semibold active:opacity-80"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			Ja
		</button>
	</div>
</div>
