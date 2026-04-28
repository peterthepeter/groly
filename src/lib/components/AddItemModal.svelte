<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { CATEGORIES, CATEGORY_LABELS, getCategoryForItem } from '$lib/categories';
	import { userSettings } from '$lib/userSettings.svelte';

	let { item = null, onSave, onClose, onDelete = null, isFavorite = false, onToggleFavorite = null }: {
		item?: { name: string; quantityInfo: string | null; categoryOverride?: string | null } | null;
		onSave: (name: string, quantityInfo: string, categoryOverride: string | null) => void;
		onClose: () => void;
		onDelete?: (() => void) | null;
		isFavorite?: boolean;
		onToggleFavorite?: ((name: string, isFav: boolean) => void) | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let favState = $state(isFavorite);
	$effect(() => { favState = isFavorite; });

	// svelte-ignore state_referenced_locally
	let name = $state(item?.name ?? '');
	// svelte-ignore state_referenced_locally
	let quantityInfo = $state(item?.quantityInfo ?? '');
	// svelte-ignore state_referenced_locally
	let categoryOverride = $state<string | null>(item?.categoryOverride ?? null);
	let categoryOpen = $state(false);

	const lang = $derived(userSettings.lang === 'en' ? 'en' : 'de');
	const effectiveCategory = $derived(getCategoryForItem(name || item?.name || '', categoryOverride));
	const categoryLabel = $derived(
		categoryOverride ? CATEGORY_LABELS[categoryOverride][lang] : (lang === 'en' ? 'Automatic' : 'Automatisch')
	);

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

	function selectCategory(key: string | null) {
		categoryOverride = key;
		categoryOpen = false;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<div class="fixed bottom-0 left-0 right-0 z-[60] max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low)">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<div class="flex items-center justify-between mb-5">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{item ? t.item_edit_title : t.items_add}</h2>
		{#if item && onDelete}
			<button
				type="button"
				onclick={onDelete}
				class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors active:scale-95"
				style="color: #ef4444"
				aria-label="Item löschen"
			>
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
				     stroke="currentColor" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"/>
					<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
					<path d="M10 11v6M14 11v6"/>
					<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="space-y-3 mb-6">
		<!-- Kategorie-Picker -->
		<button
			onclick={() => categoryOpen = !categoryOpen}
			class="w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3"
			style="background-color: var(--color-surface-container)"
		>
			<div class="flex items-center gap-2.5 min-w-0">
				<div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
					     stroke={effectiveCategory.color} stroke-width="1.8"
					     stroke-linecap="round" stroke-linejoin="round">
						{@html effectiveCategory.svgContent}
					</svg>
				</div>
				<span class="text-sm truncate" style="color: var(--color-on-surface-variant)">{categoryLabel}</span>
			</div>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
			     stroke="var(--color-on-surface-variant)" stroke-width="2"
			     stroke-linecap="round" stroke-linejoin="round"
			     style="flex-shrink: 0; transition: transform 0.2s; transform: rotate({categoryOpen ? 180 : 0}deg)">
				<polyline points="6 9 12 15 18 9"/>
			</svg>
		</button>

		{#if categoryOpen}
			<div class="rounded-xl p-3 grid grid-cols-3 gap-2"
			     style="background-color: var(--color-surface-container)">
				<!-- Automatisch -->
				<button
					onclick={() => selectCategory(null)}
					class="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1"
					style="background-color: {categoryOverride === null ? 'color-mix(in srgb, var(--color-on-surface-variant) 12%, transparent)' : 'transparent'};
					       box-shadow: {categoryOverride === null ? 'inset 0 0 0 2px var(--color-on-surface-variant)' : 'none'};"
				>
					<div class="w-8 h-8 rounded-full flex items-center justify-center"
					     style="background-color: color-mix(in srgb, var(--color-on-surface-variant) 15%, transparent)">
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
						     stroke="var(--color-on-surface-variant)" stroke-width="2"
						     stroke-linecap="round" stroke-linejoin="round">
							<circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
						</svg>
					</div>
					<span class="text-[10px] leading-tight text-center font-medium"
					      style="color: var(--color-on-surface-variant)">Auto</span>
				</button>

				{#each CATEGORIES as cat}
					<button
						onclick={() => selectCategory(cat.key)}
						class="flex flex-col items-center gap-1.5 rounded-xl py-2.5 px-1"
						style="background-color: {categoryOverride === cat.key ? 'color-mix(in srgb, ' + cat.category.color + ' 15%, transparent)' : 'transparent'};
						       box-shadow: {categoryOverride === cat.key ? 'inset 0 0 0 2px ' + cat.category.color : 'none'};"
					>
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
						     stroke={cat.category.color} stroke-width="1.6"
						     stroke-linecap="round" stroke-linejoin="round">
							{@html cat.category.svgContent}
						</svg>
						<span class="text-[10px] leading-tight text-center font-medium"
						      style="color: {categoryOverride === cat.key ? cat.category.color : 'var(--color-on-surface-variant)'}">
							{CATEGORY_LABELS[cat.key][lang]}
						</span>
					</button>
				{/each}
			</div>
		{/if}

		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				placeholder={t.item_name_label}
				bind:value={name}
				autofocus
				onfocus={(e) => { const el = e.target as HTMLInputElement; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); }}
				class="w-full bg-transparent outline-none text-base font-medium"
				style="color: var(--color-on-surface)"
			/>
		</div>

		<div class="flex items-stretch gap-2">
			{#if onToggleFavorite}
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => { favState = !favState; onToggleFavorite!(name.trim() || item?.name || '', favState); }}
					class="rounded-xl px-4 flex items-center justify-center flex-shrink-0 transition-colors"
					style="background-color: {favState ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'var(--color-surface-container)'};
					       color: {favState ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'};
					       box-shadow: {favState ? 'inset 0 0 0 1.5px var(--color-primary)' : 'none'}"
					aria-label={favState ? t.favorites_remove : t.favorites_add}
				>
					<svg width="20" height="20" viewBox="0 0 24 24"
					     fill={favState ? 'currentColor' : 'none'}
					     stroke="currentColor" stroke-width="1.8"
					     stroke-linecap="round" stroke-linejoin="round">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
					</svg>
				</button>
			{/if}
			<div class="flex-1 rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
				<div class="flex items-center gap-2">
					<input
						type="text"
						placeholder={t.item_quantity_placeholder}
						bind:value={quantityInfo}
						class="flex-1 bg-transparent outline-none text-base min-w-0"
						style="color: var(--color-on-surface)"
					/>
					<button
						onclick={decrement}
						disabled={!isNumeric || quantityInfo.trim() === ''}
						class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
						style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					>−</button>
					<button
						onclick={increment}
						disabled={!isNumeric}
						class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
						style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					>+</button>
				</div>
			</div>
		</div>
	</div>

	<div class="flex gap-3">
		<button
			onclick={onClose}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{t.item_cancel}
		</button>
		<button
			onclick={() => name.trim() && onSave(name.trim(), quantityInfo.trim(), categoryOverride)}
			disabled={!name.trim()}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{item ? t.item_save : t.add}
		</button>
	</div>
</div>
