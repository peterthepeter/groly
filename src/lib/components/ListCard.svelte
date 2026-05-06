<script lang="ts">
	import { getListIcon } from '$lib/listIcons';
	import { list_items_open } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';

	// Fallback: konsistente Farbe aus dem Listennamen
	const COLORS = ['#006c54', '#2e6771', '#4d626c', '#5a4080', '#a0522d', '#1a6b3c'];
	function colorForName(name: string): string {
		let hash = 0;
		for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	let { list, onClick, onLongPress, onShare = null, showBorder = false }: {
		list: { id: string; name: string; description: string | null; openCount: number; iconId?: string | null; ownerUsername?: string | null; locationLat?: number | null };
		onClick: () => void;
		onLongPress: () => void;
		onShare?: (() => void) | null;
		showBorder?: boolean;
	} = $props();

	const showLocationBadge = $derived(
		userSettings.locationNavEnabled &&
		list.locationLat != null &&
		!userSettings.isListLocationDisabled(list.id)
	);

	const icon = $derived(getListIcon(list.iconId));
	const color = $derived(icon ? icon.color : colorForName(list.name));
	const initial = $derived(list.name[0]?.toUpperCase() ?? '?');

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = false;

	function startPress() {
		longFired = false;
		pressTimer = setTimeout(() => { longFired = true; pressTimer = null; onLongPress(); }, 500);
	}
	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleClick() {
		if (longFired) { longFired = false; return; }
		onClick();
	}
</script>

<button
	onclick={handleClick}
	onpointerdown={startPress}
	onpointerup={endPress}
	onpointerleave={endPress}
	onpointercancel={endPress}
	oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
	class="w-full flex items-center gap-3 px-3 py-2.5 transition-colors active:opacity-80 text-left select-none"
>
	<!-- Icon -->
	<div class="flex-shrink-0 w-7 h-7 rounded-xl flex items-center justify-center">
		{#if icon}
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
			     stroke={color} stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
				{@html icon.svgContent}
			</svg>
		{:else}
			<span class="font-bold text-base" style="color: {color}">{initial}</span>
		{/if}
	</div>

	<!-- Text -->
	<div class="flex-1 min-w-0">
		<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{list.name}</div>
		<div class="text-xs truncate mt-0.5" style="color: var(--color-on-surface-variant)">
			{list.description ? `${list.description} · ` : ''}{list_items_open(list.openCount)}
		</div>
	</div>

	{#if onShare}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			onclick={(e) => { e.stopPropagation(); onShare!(); }}
			onpointerdown={(e) => e.stopPropagation()}
			role="button"
			tabindex="-1"
			class="flex-shrink-0 p-1.5 -mr-1 rounded-lg active:opacity-60"
			aria-label="Liste teilen"
		>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
				<circle cx="9" cy="7" r="4"/>
				<line x1="19" y1="8" x2="19" y2="14"/>
				<line x1="22" y1="11" x2="16" y2="11"/>
			</svg>
		</div>
	{:else if list.ownerUsername}
		<div class="flex-shrink-0 p-1.5 -mr-1">
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
				<circle cx="9" cy="7" r="4"/>
				<path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
				<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
			</svg>
		</div>
	{/if}

	<!-- Location badge -->
	{#if showLocationBadge}
		<div class="flex-shrink-0 p-1.5 -mr-1">
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
				<circle cx="12" cy="10" r="3"/>
			</svg>
		</div>
	{/if}


</button>
