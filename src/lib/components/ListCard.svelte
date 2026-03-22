<script lang="ts">
	import { getListIcon } from '$lib/listIcons';
	import { list_items_open } from '$lib/i18n.svelte';

	// Fallback: konsistente Farbe aus dem Listennamen
	const COLORS = ['#006c54', '#2e6771', '#4d626c', '#5a4080', '#a0522d', '#1a6b3c'];
	function colorForName(name: string): string {
		let hash = 0;
		for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	let { list, onClick, onLongPress, onShare = null }: {
		list: { id: string; name: string; description: string | null; openCount: number; iconId?: string | null };
		onClick: () => void;
		onLongPress: () => void;
		onShare?: (() => void) | null;
	} = $props();

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
	onpointercancel={endPress}
	oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
	class="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-colors active:opacity-80 text-left select-none"
	style="background-color: var(--color-surface-card)"
>
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
	{/if}

	<!-- Chevron -->
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
		<polyline points="9 18 15 12 9 6"/>
	</svg>
</button>
