<script lang="ts">
	import { t } from '#lib/i18n.svelte';
	import { MANUAL_CATEGORIES, CATEGORY_LABELS, getCategoryForItem } from '#lib/categories';
	import ItemEditSheet from './ItemEditSheet.svelte';
	import { userSettings } from '#lib/userSettings.svelte';

	let { item = null, onSave, onClose, onDelete = null, isFavorite = false, onToggleFavorite = null, title, deleteLabel, saving = false, error = null }: {
		title?: string;
		deleteLabel?: string;
		saving?: boolean;
		error?: string | null;
		item?: { name: string; quantityInfo: string | null; categoryOverride?: string | null } | null;
		onSave: (name: string, quantityInfo: string, categoryOverride: string | null, categoryPickerUsed: boolean) => void;
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
	let categoryPickerUsed = $state(false);
	let categoryOpen = $state(false);

	const lang = $derived(userSettings.lang === 'en' ? 'en' : 'de');
	const effectiveCategory = $derived(getCategoryForItem(name || item?.name || '', categoryOverride));
	const categoryLabel = $derived(
		categoryOverride ? CATEGORY_LABELS[categoryOverride]?.[lang] ?? categoryOverride : (lang === 'en' ? 'Automatic' : 'Automatisch')
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
		categoryPickerUsed = true;
		categoryOpen = false;
	}
</script>

<ItemEditSheet
	title={title ?? (item ? t.item_edit_title : t.items_add)}
	saveLabel={item ? t.item_save : t.add}
	saveDisabled={!name.trim() || saving}
	{onClose}
	{error}
	{deleteLabel}
	onDelete={item ? onDelete : null}
	onSave={() => name.trim() && onSave(name.trim(), quantityInfo.trim(), categoryOverride, categoryPickerUsed)}
	isFavorite={favState}
	onToggleFavorite={onToggleFavorite ? () => {
		favState = !favState;
		onToggleFavorite?.(name.trim() || item?.name || '', favState);
	} : null}
>
	{#snippet fields()}
		<!-- Kategorie-Picker -->
		<button
			onclick={() => categoryOpen = !categoryOpen}
			class="w-full flex items-center justify-between gap-3 px-4"
			style="height: 44px"
		>
			<div class="flex items-center gap-2.5 min-w-0">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
				     stroke={effectiveCategory.color} stroke-width="1.8"
				     stroke-linecap="round" stroke-linejoin="round"
				     style="flex-shrink: 0; color: {effectiveCategory.color}">
					{@html effectiveCategory.svgContent}
				</svg>
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
			<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
			<div class="p-3 grid grid-cols-3 gap-2">
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

				{#each MANUAL_CATEGORIES as cat}
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

		<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>

		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="text"
			placeholder={t.item_name_label}
			bind:value={name}
			autofocus
			onfocus={(e) => { const el = e.currentTarget; el.setSelectionRange(el.value.length, el.value.length); }}
			class="w-full px-4 bg-transparent outline-none text-base font-medium"
			style="color: var(--color-on-surface); height: 44px"
		/>

		<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>

		<div class="flex items-center gap-2 px-4" style="height: 44px">
			<input
				type="text"
				placeholder={t.item_quantity_placeholder}
				bind:value={quantityInfo}
				class="flex-1 bg-transparent outline-none text-sm min-w-0"
				style="color: var(--color-on-surface)"
			/>
			<button
				onclick={decrement}
				disabled={!isNumeric || quantityInfo.trim() === ''}
				class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
				style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
			>−</button>
			<button
				onclick={increment}
				disabled={!isNumeric}
				class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
				style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
			>+</button>
		</div>
	{/snippet}
</ItemEditSheet>
