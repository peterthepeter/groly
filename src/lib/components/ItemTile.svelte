<script lang="ts">
	import { getCategoryForItem } from '$lib/categories';
	import { onMount } from 'svelte';
	import { userSettings } from '$lib/userSettings.svelte';

	let { item, onTap, onLongPress, createdByUsername = null, currentUsername = null, isFavorite = false }: {
		item: { id: string; name: string; quantityInfo: string | null; categoryOverride?: string | null };
		onTap: () => void;
		onLongPress: () => void;
		createdByUsername?: string | null;
		currentUsername?: string | null;
		isFavorite?: boolean;
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

	// Truncation detection
	let nameEl: HTMLElement | null = null;
	let isTruncated = $state(false);

	// Swipe gesture state (touch-based, zuverlässiger auf iOS)
	let touchStartX = 0;
	let touchStartY = 0;
	let swipeConsumed = false;

	// Overlay
	let showOverlay = $state(false);

	onMount(() => {
		checkTruncation();
	});

	$effect(() => {
		// Re-check if item name changes
		item.name;
		checkTruncation();
	});

	function checkTruncation() {
		if (nameEl) {
			isTruncated = nameEl.scrollHeight > nameEl.clientHeight || nameEl.scrollWidth > nameEl.clientWidth;
		}
	}

	// --- Tap / Long-press via Pointer Events ---
	function startPress(e: PointerEvent) {
		longFired = false;
		swipeConsumed = false;
		pressTimer = setTimeout(() => { longFired = true; onLongPress(); }, 500);
	}

	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	function handleClick() {
		if (longFired) { longFired = false; return; }
		if (swipeConsumed) { swipeConsumed = false; return; }
		onTap();
	}

	// --- Swipe-Erkennung via Touch Events (iOS-zuverlässig) ---
	function handleTouchStart(e: TouchEvent) {
		if (!isTruncated) return;
		const t = e.touches[0];
		touchStartX = t.clientX;
		touchStartY = t.clientY;
	}

	function handleTouchMove(e: TouchEvent) {
		if (swipeConsumed || !isTruncated) return;
		const t = e.touches[0];
		const dx = t.clientX - touchStartX;
		const dy = t.clientY - touchStartY;
		if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 18) {
			if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
			swipeConsumed = true;
			showOverlay = true;
		}
	}
</script>

<div class="relative aspect-square" style="direction: ltr">
	<button
		onclick={handleClick}
		onpointerdown={startPress}
		onpointerup={endPress}
		onpointerleave={endPress}
		onpointercancel={endPress}
		ontouchstart={handleTouchStart}
		ontouchmove={handleTouchMove}
		oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
		class="w-full h-full rounded-3xl relative overflow-hidden active:scale-95 transition-transform select-none"
		style="background-color: var(--color-surface-card); touch-action: pan-y;"
	>
		<!-- Favorite dot — top left -->
		{#if isFavorite && userSettings.showFavoriteIndicator}
			<span class="absolute top-3 left-3 w-2 h-2 rounded-full z-10"
			      style="background-color: var(--color-primary)" aria-hidden="true"></span>
		{/if}

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
			<span bind:this={nameEl}
			      class="text-xs font-bold leading-snug line-clamp-2 max-[374px]:line-clamp-1 text-center w-full"
			      style="color: var(--color-on-surface)">{item.name}</span>
			<span class="text-[10px] leading-tight text-center mt-0.5 truncate w-full"
			      style="color: {category.color}; visibility: {item.quantityInfo ? 'visible' : 'hidden'}">
				{item.quantityInfo || '\u00a0'}
			</span>
		</div>
	</button>
</div>

<!-- Full-name overlay – nur wenn Name abgeschnitten und Swipe ausgelöst -->
{#if showOverlay}
	<div
		role="button"
		tabindex="-1"
		class="fixed inset-0 z-50 flex items-center justify-center"
		onclick={() => showOverlay = false}
		onkeydown={(e) => { if (e.key === 'Escape') showOverlay = false; }}
	>
		<div class="absolute inset-0 bg-black/60 backdrop-blur-[2px]"></div>
		<div class="relative rounded-2xl px-6 py-5 mx-6 text-center shadow-2xl"
		     style="background-color: var(--color-surface-card); max-width: 80vw">
			<p class="text-sm font-bold leading-snug" style="color: var(--color-on-surface)">{item.name}</p>
			{#if item.quantityInfo}
				<p class="text-xs mt-1.5 font-medium" style="color: {category.color}">{item.quantityInfo}</p>
			{/if}
		</div>
	</div>
{/if}
