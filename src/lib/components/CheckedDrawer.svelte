<script lang="ts">
	import { tick } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { getCategoryForItem } from '$lib/categories';

	type Item = { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number };

	let { checkedItems, totalChecked, onUncheck, layout = 'grid' }: {
		checkedItems: Item[];
		totalChecked: number;
		onUncheck: (item: Item) => void;
		layout?: 'grid' | 'list';
	} = $props();

	let expanded = $state(false);
	let toggleBtn = $state<HTMLButtonElement | null>(null);

	// Deduplicate by name+quantity — keep most recent (first, sorted desc) as representative
	const dedupedItems = $derived.by(() => {
		const map = new Map<string, { item: Item; count: number }>();
		for (const item of checkedItems) {
			const key = item.name.toLowerCase() + '|' + (item.quantityInfo ?? '');
			if (!map.has(key)) {
				map.set(key, { item, count: 1 });
			} else {
				map.get(key)!.count++;
			}
		}
		return [...map.values()];
	});
	// checkedItems is sorted newest-first → dedupedItems is newest-first
	// flex-wrap-reverse fills rows from bottom: newest item → bottom-left, empty slots → top-right

	async function toggle() {
		expanded = !expanded;
		if (expanded) {
			await tick();
			toggleBtn?.scrollIntoView({ block: 'end', behavior: 'smooth' });
		}
	}
</script>

<div class="mb-3">
	{#if expanded}
		{#if layout === 'list'}
			<div class="mb-1">
				{#each dedupedItems as { item } (item.id)}
					{@const category = getCategoryForItem(item.name, item.categoryOverride)}
					<button
						onclick={() => onUncheck(item)}
						class="w-full flex items-center h-[50px] px-3.5 gap-2.5 opacity-40 active:opacity-25 transition-opacity select-none border-t"
						style="background-color: var(--color-surface-card); border-color: var(--color-outline-variant)"
					>
						<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
						     stroke={category.color} stroke-width="1.3"
						     stroke-linecap="round" stroke-linejoin="round"
						     class="flex-shrink-0">
							{@html category.svgContent}
						</svg>
						<div class="flex-1 min-w-0 flex items-baseline gap-1.5 overflow-hidden">
							<span class="text-sm font-bold leading-none truncate line-through"
							      style="color: var(--color-on-surface)">{item.name}</span>
							{#if item.quantityInfo}
								<span class="text-[10px] font-semibold leading-none flex-shrink-0 line-through"
								      style="color: {category.color}">{item.quantityInfo}</span>
							{/if}
						</div>
					</button>
				{/each}
			</div>
		{:else}
			<!--
				flex-wrap: wrap-reverse → rows stack bottom-up.
				Newest item (index 0) → bottom-left.
				Each new item pushes existing ones right/up.
				Empty slots always end up at top-right.
				Item width: (100% - 2 gaps) / 3 columns.
			-->
			<div class="mb-3" style="display: flex; flex-wrap: wrap-reverse; gap: 0.75rem;">
				{#each dedupedItems as { item } (item.id)}
					{@const category = getCategoryForItem(item.name, item.categoryOverride)}
					<button
						onclick={() => onUncheck(item)}
						class="rounded-3xl relative overflow-hidden opacity-40 active:opacity-25 transition-opacity flex-shrink-0"
						style="width: calc((100% - 1.5rem) / 3); aspect-ratio: 1 / 1; background-color: var(--color-surface-card)"
					>
						<div class="absolute inset-0 flex items-start justify-center pt-[30px]">
							<svg width="44" height="44" viewBox="0 0 24 24" fill="none"
							     stroke="var(--color-on-surface-variant)" stroke-width="1.3"
							     stroke-linecap="round" stroke-linejoin="round">
								{@html category.svgContent}
							</svg>
						</div>
						<div class="absolute bottom-0 left-0 right-0 px-3 pb-2 flex flex-col items-center justify-end" style="height: 2.8rem">
							<span class="block text-sm font-bold leading-tight line-clamp-2 text-center line-through w-full"
							      style="color: var(--color-on-surface-variant)">{item.name}</span>
							<span class="block text-[10px] leading-tight text-center mt-0.5 truncate line-through w-full"
							      style="color: var(--color-on-surface-variant); visibility: {item.quantityInfo ? 'visible' : 'hidden'}">
								{item.quantityInfo || '\u00a0'}
							</span>
						</div>
					</button>
				{/each}
			</div>
		{/if}
	{/if}

	<button
		bind:this={toggleBtn}
		onclick={toggle}
		class="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
		style="background-color: var(--color-surface-container)"
	>
		<span class="text-xs font-bold tracking-widest uppercase" style="color: var(--color-primary)">{t.items_checked_label}</span>
		<svg
			width="16" height="16" viewBox="0 0 24 24" fill="none"
			stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
			class="transition-transform duration-200"
			style="transform: rotate({expanded ? '180deg' : '-90deg'})"
		>
			<polyline points="6 9 12 15 18 9"/>
		</svg>
	</button>
</div>
