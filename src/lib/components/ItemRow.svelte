<script lang="ts">
	import { getCategoryForItem } from '$lib/categories';

	let { item, onTap, onLongPress, createdByUsername = null, currentUsername = null }: {
		item: { id: string; name: string; quantityInfo: string | null; categoryOverride?: string | null };
		onTap: () => void;
		onLongPress: () => void;
		createdByUsername?: string | null;
		currentUsername?: string | null;
	} = $props();

	const category = $derived(getCategoryForItem(item.name, item.categoryOverride));
	const showCreator = $derived(!!createdByUsername && createdByUsername !== currentUsername);
	const displayCreator = $derived(
		createdByUsername
			? '(' + (createdByUsername.length > 10 ? createdByUsername.slice(0, 10) + '…' : createdByUsername) + ')'
			: ''
	);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = $state(false);

	function startPress() {
		longFired = false;
		pressTimer = setTimeout(() => { longFired = true; pressTimer = null; onLongPress(); }, 500);
	}
	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleClick() {
		if (longFired) { longFired = false; return; }
		onTap();
	}
</script>

<button
	onclick={handleClick}
	onpointerdown={startPress}
	onpointerup={endPress}
	onpointercancel={endPress}
	oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
	class="w-full flex items-center h-[54px] px-3.5 gap-2.5 active:opacity-70 transition-opacity select-none text-left"
	style="background-color: var(--color-surface-card); touch-action: pan-y;"
>
	<!-- Category icon — no background, same as tile -->
	<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
	     stroke={category.color} stroke-width="1.3"
	     stroke-linecap="round" stroke-linejoin="round"
	     class="flex-shrink-0">
		{@html category.svgContent}
	</svg>

	<!-- Name + quantity -->
	<div class="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
		<span class="text-sm font-bold leading-none truncate flex-shrink-1"
		      style="color: var(--color-on-surface)">{item.name}</span>
		{#if item.quantityInfo}
			<span class="text-[10px] font-semibold leading-none flex-shrink-0"
			      style="color: {category.color}">{item.quantityInfo}</span>
		{/if}
	</div>

	<!-- Right: creator label -->
	{#if showCreator}
		<span class="text-[10px] font-semibold flex-shrink-0"
		      style="color: var(--color-on-surface-variant)">{displayCreator}</span>
	{/if}
</button>
