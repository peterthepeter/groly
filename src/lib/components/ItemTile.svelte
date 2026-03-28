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
		<!-- Creator — top right -->
		<span class="absolute top-2.5 right-2.5 text-[10px] font-semibold leading-none"
		      style="color: var(--color-on-surface-variant); visibility: {showCreator ? 'visible' : 'hidden'}">
			({displayCreator})
		</span>

		<!-- Icon — obere Hälfte zentriert -->
		<div class="absolute inset-0 flex items-start justify-center pt-[30px] max-[374px]:pt-[22px]">
			<svg class="w-11 h-11 max-[374px]:w-9 max-[374px]:h-9" viewBox="0 0 24 24" fill="none"
			     stroke={category.color} stroke-width="1.3"
			     stroke-linecap="round" stroke-linejoin="round">
				{@html category.svgContent}
			</svg>
		</div>

		<!-- Name + Menge — feste Höhe, Name immer auf gleicher Y-Position -->
		<div class="absolute bottom-0 left-0 right-0 px-2.5 pb-2 flex flex-col items-center justify-end h-[3.6rem] max-[374px]:h-[2.6rem]">
			<span class="text-xs font-bold leading-snug line-clamp-2 max-[374px]:line-clamp-1 text-center w-full"
			      style="color: var(--color-on-surface)">{item.name}</span>
			<span class="text-[10px] leading-tight text-center mt-0.5 truncate w-full"
			      style="color: {category.color}; visibility: {item.quantityInfo ? 'visible' : 'hidden'}">
				{item.quantityInfo || '\u00a0'}
			</span>
		</div>
	</button>
</div>
