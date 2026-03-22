<script lang="ts">
	import { getCategoryForItem } from '$lib/categories';

	let { item, onTap, onLongPress, createdByUsername = null, currentUsername = null }: {
		item: { id: string; name: string; quantityInfo: string | null; categoryOverride?: string | null };
		onTap: () => void;
		onLongPress: () => void;
		createdByUsername?: string | null;
		currentUsername?: string | null;
	} = $props();

	const showCreator = $derived(!!createdByUsername && createdByUsername !== currentUsername);
	const displayCreator = $derived(
		createdByUsername
			? createdByUsername.length > 12
				? createdByUsername.slice(0, 12) + '…'
				: createdByUsername
			: ''
	);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = $state(false);

	const category = $derived(getCategoryForItem(item.name, item.categoryOverride));

	function startPress() {
		longFired = false;
		pressTimer = setTimeout(() => { longFired = true; onLongPress(); }, 500);
	}
	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleClick() {
		if (longFired) { longFired = false; return; }
		onTap();
	}
</script>

<div class="relative aspect-square" style="direction: ltr">
	<button
		onclick={handleClick}
		onpointerdown={startPress}
		onpointerup={endPress}
		onpointercancel={endPress}
		oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
		class="w-full h-full rounded-3xl relative overflow-hidden active:scale-95 transition-transform select-none"
		style="background-color: var(--color-surface-card)"
	>
		<!-- Menge Badge — top right -->
		{#if item.quantityInfo}
			<span class="absolute top-2.5 right-2.5 text-xs font-semibold leading-none"
			      style="color: {category.color}">{item.quantityInfo}</span>
		{/if}

		<!-- Icon — obere Hälfte zentriert -->
		<div class="absolute inset-0 flex items-start justify-center pt-6">
			<div class="w-[58px] h-[58px] rounded-full flex items-center justify-center"
			     style="background-color: color-mix(in srgb, {category.color} 22%, transparent)">
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
				     stroke={category.color} stroke-width="1.6"
				     stroke-linecap="round" stroke-linejoin="round">
					{@html category.svgContent}
				</svg>
			</div>
		</div>

		<!-- Name + Creator — feste Höhe, Name immer auf gleicher Y-Position -->
		<div class="absolute bottom-0 left-0 right-0 px-3 pb-2 flex flex-col items-center justify-end" style="height: 2.8rem">
			<span class="block text-sm font-bold leading-tight line-clamp-2 text-center w-full"
			      style="color: var(--color-on-surface)">{item.name}</span>
			<span class="block text-[10px] leading-tight text-center mt-0.5 truncate w-full"
			      style="color: var(--color-on-surface-variant); visibility: {showCreator ? 'visible' : 'hidden'}">
				({displayCreator})
			</span>
		</div>
	</button>
</div>
