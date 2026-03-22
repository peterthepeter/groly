<script lang="ts">
	import { getCategoryForItem } from '$lib/categories';

	let { item, onTap, onLongPress }: {
		item: { id: string; name: string; quantityInfo: string | null; categoryOverride?: string | null };
		onTap: () => void;
		onLongPress: () => void;
	} = $props();

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
		class="w-full h-full rounded-3xl relative overflow-hidden active:scale-95 transition-transform"
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

		<!-- Name — unten zentriert -->
		<div class="absolute bottom-0 left-0 right-0 px-3 pb-3">
			<span class="block text-sm font-bold leading-tight line-clamp-2 text-center"
			      style="color: var(--color-on-surface)">{item.name}</span>
		</div>
	</button>
</div>
