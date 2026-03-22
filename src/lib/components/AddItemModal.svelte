<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { CATEGORIES, CATEGORY_LABELS, getCategoryForItem } from '$lib/categories';
	import { userSettings } from '$lib/userSettings.svelte';

	let { item = null, onSave, onClose }: {
		item?: { name: string; quantityInfo: string | null; categoryOverride?: string | null } | null;
		onSave: (name: string, quantityInfo: string, categoryOverride: string | null) => void;
		onClose: () => void;
	} = $props();

	let name = $state(item?.name ?? '');
	let quantityInfo = $state(item?.quantityInfo ?? '');
	let categoryOverride = $state<string | null>(item?.categoryOverride ?? null);
	let categoryOpen = $state(false);

	const lang = $derived(userSettings.lang === 'en' ? 'en' : 'de');
	const effectiveCategory = $derived(getCategoryForItem(name || item?.name || '', categoryOverride));
	const categoryLabel = $derived(
		categoryOverride ? CATEGORY_LABELS[categoryOverride][lang] : (lang === 'en' ? 'Automatic' : 'Automatisch')
	);

	function selectCategory(key: string | null) {
		categoryOverride = key;
		categoryOpen = false;
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low)">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<h2 class="text-lg font-bold mb-5" style="color: var(--color-on-surface)">{item ? t.item_edit_title : t.items_add}</h2>

	<div class="space-y-3 mb-6">
		<!-- Kategorie-Picker -->
		<button
			onclick={() => categoryOpen = !categoryOpen}
			class="w-full rounded-xl px-4 py-3 flex items-center justify-between gap-3"
			style="background-color: var(--color-surface-container)"
		>
			<div class="flex items-center gap-2.5 min-w-0">
				<div class="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center"
				     style="background-color: color-mix(in srgb, {effectiveCategory.color} 22%, transparent)">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
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
						<div class="w-8 h-8 rounded-full flex items-center justify-center"
						     style="background-color: color-mix(in srgb, {cat.category.color} 22%, transparent)">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
							     stroke={cat.category.color} stroke-width="1.8"
							     stroke-linecap="round" stroke-linejoin="round">
								{@html cat.category.svgContent}
							</svg>
						</div>
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
				class="w-full bg-transparent outline-none text-base font-medium"
				style="color: var(--color-on-surface)"
			/>
		</div>

		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<input
				type="text"
				placeholder={t.item_quantity_placeholder}
				bind:value={quantityInfo}
				class="w-full bg-transparent outline-none text-base"
				style="color: var(--color-on-surface)"
			/>
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
