<script lang="ts">
	import { tick, onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { watchVisualViewportBottomOffset } from '$lib/visualViewport';
	import { getCategoryForItem, getCategoryKey, CATEGORIES } from '$lib/categories';
	import BarcodeScanner from './BarcodeScanner.svelte';

	let { onAdd, onClose, suggestions = [], autoOpenScanner = false, autoOpenFavorites = false, favorites = [], activeItemNames = new Set<string>(), onRemoveFavorite = null, onAddFavorite = null }: {
		onAdd: (name: string, quantityInfo: string) => Promise<void>;
		onClose: () => void;
		suggestions?: string[];
		autoOpenScanner?: boolean;
		autoOpenFavorites?: boolean;
		favorites?: Array<{ name: string; quantityInfo: string | null; categoryOverride: string | null }>;
		activeItemNames?: Set<string>;
		onRemoveFavorite?: ((name: string) => void) | null;
		onAddFavorite?: ((name: string, quantityInfo: string) => void) | null;
	} = $props();

	let name = $state('');
	let quantityInfo = $state('');
	let adding = $state(false);
	let nameInput: HTMLInputElement;
	let showSuggestions = $state(false);
	let bottomOffset = $state(0);
	let scannerOpen = $state(false);
	let favoritesOpen = $state(false);
	let addedName = $state<string | null>(null);
	let removeTarget = $state<string | null>(null);
	let addFavOpen = $state(false);
	let newFavName = $state('');
	let newFavQty = $state('');
	let favAddedFeedback = $state(false);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let favScrollEl: HTMLElement | null = $state(null);

	// Sort favorites by category order
	const CATEGORY_ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.key, i]));
	const sortedFavorites = $derived(
		[...favorites].sort((a, b) => {
			const aIdx = CATEGORY_ORDER.get(getCategoryKey(a.name, a.categoryOverride)) ?? CATEGORIES.length;
			const bIdx = CATEGORY_ORDER.get(getCategoryKey(b.name, b.categoryOverride)) ?? CATEGORIES.length;
			return aIdx - bIdx;
		})
	);

	// Scroll to bottom when favorites panel opens
	$effect(() => {
		if (favoritesOpen) {
			tick().then(() => {
				if (favScrollEl) favScrollEl.scrollTop = favScrollEl.scrollHeight;
			});
		}
	});

	function submitNewFavorite() {
		if (!newFavName.trim()) return;
		onAddFavorite?.(newFavName.trim(), newFavQty.trim());
		newFavName = '';
		newFavQty = '';
		favAddedFeedback = true;
		setTimeout(() => { favAddedFeedback = false; }, 1200);
	}

	function startLongPress(name: string) {
		pressTimer = setTimeout(() => { pressTimer = null; removeTarget = name; }, 500);
	}
	function endLongPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	async function handleFavAdd(fav: { name: string; quantityInfo: string | null }) {
		addedName = fav.name;
		await onAdd(fav.name, fav.quantityInfo ?? '');
		setTimeout(() => { if (addedName === fav.name) addedName = null; }, 1000);
	}
	onMount(() => {
		if (autoOpenScanner) {
			scannerOpen = true;
		} else if (autoOpenFavorites) {
			favoritesOpen = true;
		} else {
			nameInput?.focus();
		}

		return watchVisualViewportBottomOffset((offset) => {
			bottomOffset = offset;
		});
	});

	const isNumeric = $derived(/^\d+$/.test(quantityInfo.trim()) || quantityInfo.trim() === '');

	function increment() {
		const n = quantityInfo.trim() === '' ? 0 : parseInt(quantityInfo.trim());
		quantityInfo = String(n + 1);
	}

	function decrement() {
		const n = parseInt(quantityInfo.trim());
		if (isNaN(n) || n <= 1) quantityInfo = '';
		else quantityInfo = String(n - 1);
	}

	// Quick capture: comma-separated multi-item input
	const UNIT_RE = /^(\d+(?:[.,]\d+)?\s*(?:x|g|kg|mg|ml|l|el|tl|stk\.?|stück|pck\.?|pkg\.?|dose|flasche|becher|tüte|bund|zehe|scheibe)?)(?:\s+)(.+)$/i;

	function parseQuickItem(token: string): { name: string; quantityInfo: string } {
		const trimmed = token.trim();
		const match = trimmed.match(UNIT_RE);
		if (match?.[2]) return { quantityInfo: match[1].trim(), name: match[2].trim() };
		return { name: trimmed, quantityInfo: '' };
	}

	const isMultiItem = $derived(name.includes(','));
	const parsedItems = $derived(
		isMultiItem
			? name.split(',').map(t => t.trim()).filter(t => t.length > 0).map(parseQuickItem)
			: []
	);

	const filtered = $derived(
		name.length >= 1
			? suggestions.filter(s => s.toLowerCase().includes(name.toLowerCase()) && s.toLowerCase() !== name.toLowerCase()).slice(0, 5)
			: []
	);

	async function handleAdd() {
		if (!name.trim() || adding) return;
		adding = true;
		showSuggestions = false;

		if (isMultiItem) {
			for (const item of parsedItems) {
				if (item.name) await onAdd(item.name, item.quantityInfo);
			}
		} else {
			await onAdd(name.trim(), quantityInfo.trim());
		}

		name = '';
		quantityInfo = '';
		adding = false;
		await tick();
		nameInput?.focus();
	}

	async function pickSuggestion(s: string) {
		showSuggestions = false;
		name = '';
		quantityInfo = '';
		await onAdd(s, '');
		await tick();
		nameInput?.focus();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') handleAdd();
		if (e.key === 'Escape') onClose();
	}

	function handleBarcodeFound(productName: string) {
		void onAdd(productName, '');
		// Scanner bleibt offen für weitere Scans
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0" style="z-index: 50; background-color: rgba(0,0,0,0.5)"></div>

<!-- Bottom sheet -->
<div class="fixed left-0 right-0 z-[60] max-w-[430px] mx-auto" style="bottom: {bottomOffset}px">
	<div class="rounded-t-3xl px-4 pb-6 pt-3 shadow-2xl"
	     style="background-color: var(--color-surface-low)">

		<!-- Handle -->
		<div class="flex justify-center mb-4">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		{#if favoritesOpen}
			<!-- === Favoriten-Modus: nur Grid + Add Item + Close === -->
			<div class="fav-scroll overflow-y-auto mb-3" style="max-height: calc(80vh - 140px)" bind:this={favScrollEl}>
				{#if sortedFavorites.length === 0}
					<p class="text-sm text-center py-8" style="color: var(--color-on-surface-variant)">{t.favorites_empty}</p>
				{:else}
					{@const gridPrefix = sortedFavorites.length % 3 === 0 ? 0 : 3 - (sortedFavorites.length % 3)}
					<div class="grid grid-cols-3 gap-2" style="direction: rtl">
						{#each { length: gridPrefix } as _}
							<div class="aspect-square"></div>
						{/each}
						{#each sortedFavorites as fav}
							{@const cat = getCategoryForItem(fav.name, fav.categoryOverride)}
							<div class="relative aspect-square">
								<button
									type="button"
									onpointerdown={(e) => { e.preventDefault(); startLongPress(fav.name); }}
									onpointerup={endLongPress}
									onpointerleave={endLongPress}
									onpointercancel={endLongPress}
									oncontextmenu={(e) => { e.preventDefault(); removeTarget = fav.name; }}
									onclick={() => handleFavAdd(fav)}
									class="w-full h-full rounded-3xl relative overflow-hidden active:scale-95 transition-transform select-none"
									style="background-color: var(--color-surface-card); touch-action: pan-y;"
								>
									{#if activeItemNames.has(fav.name.toLowerCase())}
										<span class="absolute top-2.5 left-2.5 w-2 h-2 rounded-full z-10"
										      style="background-color: var(--color-primary)" aria-hidden="true"></span>
									{/if}
									<div class="absolute inset-0 flex items-start justify-center pt-[30px] max-[374px]:pt-[22px]">
										<svg class="w-11 h-11 max-[374px]:w-9 max-[374px]:h-9" viewBox="0 0 24 24" fill="none"
										     stroke={cat.color} stroke-width="1.3"
										     stroke-linecap="round" stroke-linejoin="round">
											{@html cat.svgContent}
										</svg>
									</div>
									<div class="absolute bottom-0 left-0 right-0 px-2.5 pb-2 flex flex-col items-center justify-end h-[3.6rem] max-[374px]:h-[2.6rem]">
										<span class="text-xs font-bold leading-snug line-clamp-2 max-[374px]:line-clamp-1 text-center w-full"
										      style="color: var(--color-on-surface)">{fav.name}</span>
										<span class="text-[10px] leading-tight text-center mt-0.5 truncate w-full"
										      style="color: {cat.color}; visibility: {fav.quantityInfo ? 'visible' : 'hidden'}">
											{fav.quantityInfo || '\u00a0'}
										</span>
									</div>
									{#if addedName === fav.name}
										<div class="absolute inset-0 flex items-center justify-center rounded-3xl"
										     style="background-color: color-mix(in srgb, var(--color-primary) 88%, transparent)">
											<svg width="36" height="36" viewBox="0 0 24 24" fill="none"
											     stroke="white" stroke-width="2.5"
											     stroke-linecap="round" stroke-linejoin="round">
												<polyline points="20 6 9 17 4 12"/>
											</svg>
										</div>
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex gap-2">
				<!-- Add Item (= neuen Favoriten hinzufügen) -->
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => { addFavOpen = true; newFavName = ''; newFavQty = ''; }}
					class="flex-1 h-12 rounded-full flex items-center justify-center gap-1.5 text-sm font-semibold"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{t.favorites_new}
				</button>
				<!-- Close -->
				<button
					onclick={onClose}
					class="flex-1 h-12 rounded-full text-sm font-semibold"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>
					{t.close}
				</button>
			</div>

			<!-- Long-Press Remove-Dialog -->
			{#if removeTarget}
				<div class="fixed inset-0 z-[70] flex items-end justify-center pb-6 px-4"
				     style="background-color: rgba(0,0,0,0.5)"
				     role="dialog" aria-modal="true">
					<div class="w-full max-w-[400px] rounded-3xl overflow-hidden shadow-2xl"
					     style="background-color: var(--color-surface-low)">
						<div class="px-5 pt-5 pb-2 text-center">
							<p class="text-sm font-semibold" style="color: var(--color-on-surface)">{removeTarget}</p>
						</div>
						<div class="flex flex-col gap-1 p-3">
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={() => { onRemoveFavorite?.(removeTarget!); removeTarget = null; }}
								class="w-full py-3.5 rounded-2xl text-sm font-semibold"
								style="background-color: color-mix(in srgb, #ef4444 15%, transparent); color: #ef4444"
							>
								{t.favorites_remove}
							</button>
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={() => removeTarget = null}
								class="w-full py-3.5 rounded-2xl text-sm font-semibold"
								style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
							>
								{t.item_cancel}
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Neuer-Favorit-Dialog -->
			{#if addFavOpen}
				<div class="fixed inset-0 z-[70] flex items-end justify-center pb-6 px-4"
				     style="background-color: rgba(0,0,0,0.5)"
				     role="dialog" aria-modal="true">
					<div class="w-full max-w-[400px] rounded-3xl shadow-2xl"
					     style="background-color: var(--color-surface-low)">
						<div class="px-5 pt-5 pb-3">
							<p class="text-base font-bold mb-4" style="color: var(--color-on-surface)">{t.favorites_new}</p>
							<div class="space-y-2">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									placeholder={t.item_name_label}
									bind:value={newFavName}
									autofocus
									autocomplete="off"
									onkeydown={(e) => { if (e.key === 'Enter') submitNewFavorite(); if (e.key === 'Escape') addFavOpen = false; }}
									class="w-full rounded-xl px-4 py-3 text-base font-medium outline-none"
									style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
								/>
								<input
									type="text"
									placeholder={t.item_quantity_placeholder}
									bind:value={newFavQty}
									autocomplete="off"
									onkeydown={(e) => { if (e.key === 'Enter') submitNewFavorite(); if (e.key === 'Escape') addFavOpen = false; }}
									class="w-full rounded-xl px-4 py-3 text-base outline-none"
									style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
								/>
							</div>
							<!-- Hinzugefügt-Feedback -->
							{#if favAddedFeedback}
								<div class="flex items-center gap-2 mt-3 px-1">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
									     stroke="var(--color-primary)" stroke-width="2.5"
									     stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"/>
									</svg>
									<span class="text-sm font-medium" style="color: var(--color-primary)">{t.favorites_add}</span>
								</div>
							{/if}
						</div>
						<div class="flex gap-2 p-3 pt-0">
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={() => addFavOpen = false}
								class="flex-1 py-3.5 rounded-full text-sm font-semibold"
								style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
							>{t.close}</button>
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={submitNewFavorite}
								disabled={!newFavName.trim()}
								class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40"
								style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
							>{t.add}</button>
						</div>
					</div>
				</div>
			{/if}

		{:else}
			<!-- === Normal-Modus === -->

			<!-- Suggestions -->
			{#if filtered.length > 0 && showSuggestions}
				<div class="flex gap-2 flex-wrap mb-3">
					{#each filtered as s}
						<button
							onpointerdown={(e) => e.preventDefault()}
							onclick={() => pickSuggestion(s)}
							class="px-3 py-1.5 rounded-full text-xs font-medium"
							style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)"
						>
							{s}
						</button>
					{/each}
				</div>
			{/if}

			<!-- Eingabefelder -->
			<div class="space-y-2 mb-3">
				{#if !isMultiItem}
					<div class="flex items-center gap-2 rounded-xl px-4"
					     style="background-color: var(--color-surface-card); height: 52px">
						<input
							type="text"
							placeholder={t.item_quantity_placeholder}
							bind:value={quantityInfo}
							onkeydown={handleKeydown}
							autocomplete="off"
							class="flex-1 bg-transparent outline-none text-base min-w-0"
							style="color: var(--color-on-surface)"
						/>
						<button
							onpointerdown={(e) => e.preventDefault()}
							onclick={decrement}
							disabled={!isNumeric || quantityInfo.trim() === ''}
							tabindex="-1"
							class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
							style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
						>−</button>
						<button
							onpointerdown={(e) => e.preventDefault()}
							onclick={increment}
							disabled={!isNumeric}
							tabindex="-1"
							class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
							style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
						>+</button>
					</div>
				{/if}

				<!-- svelte-ignore a11y_autofocus -->
				<input
					bind:this={nameInput}
					type="text"
					placeholder={t.item_name_label}
					bind:value={name}
					oninput={() => showSuggestions = true}
					onkeydown={handleKeydown}
					autofocus={!autoOpenScanner}
					autocomplete="off"
					class="w-full rounded-xl px-4 text-base font-medium outline-none"
					style="background-color: var(--color-surface-card); color: var(--color-on-surface); height: 52px"
				/>

				<!-- Multi-item preview chips -->
				{#if isMultiItem && parsedItems.length > 0}
					<div class="flex gap-1.5 flex-wrap px-1">
						{#each parsedItems as item}
							{#if item.name}
								<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
								      style="background-color: color-mix(in srgb, var(--color-primary) 13%, transparent); color: var(--color-primary)">
									{#if item.quantityInfo}<span class="font-bold">{item.quantityInfo}</span><span style="opacity:0.5">·</span>{/if}{item.name}
								</span>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Aktionen: Icon-Buttons + Schließen + Hinzufügen -->
			<div class="flex gap-2">
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => { (document.activeElement as HTMLElement)?.blur(); favoritesOpen = true; }}
					class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label={t.favorites_panel_toggle}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
					</svg>
				</button>
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => { (document.activeElement as HTMLElement)?.blur(); scannerOpen = true; }}
					class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label={t.barcode_scan}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
						<path d="M3 9V6a2 2 0 0 1 2-2h2"/>
						<path d="M3 15v3a2 2 0 0 0 2 2h2"/>
						<path d="M21 9V6a2 2 0 0 0-2-2h-2"/>
						<path d="M21 15v3a2 2 0 0 1-2 2h-2"/>
						<line x1="10" y1="9" x2="10" y2="15"/>
						<line x1="13" y1="9" x2="13" y2="15"/>
						<line x1="16" y1="9" x2="16" y2="15"/>
					</svg>
				</button>
				<button
					onclick={onClose}
					class="flex-1 h-12 rounded-full text-sm font-semibold"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>
					{t.close}
				</button>
				<button
					onpointerdown={(e) => e.preventDefault()}
					onclick={handleAdd}
					disabled={!name.trim() || adding}
					class="h-12 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
					style="flex: 2; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{#if isMultiItem && parsedItems.filter(i => i.name).length > 1}
						{parsedItems.filter(i => i.name).length}× {t.add}
					{:else}
						{t.add}
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

{#if scannerOpen}
	<BarcodeScanner
		onFound={handleBarcodeFound}
		onClose={() => { scannerOpen = false; onClose(); }}
	/>
{/if}

<style>
	.fav-scroll {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.fav-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
