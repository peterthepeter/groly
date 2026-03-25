<script lang="ts">
	import { t, items_checked_count } from '$lib/i18n.svelte';
	import { getCategoryForItem } from '$lib/categories';

	let { checkedItems, totalChecked, onUncheck }: {
		checkedItems: Array<{ id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number }>;
		totalChecked: number;
		onUncheck: (item: { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; categoryOverride: string | null; createdByUsername: string | null; updatedAt: number }) => void;
	} = $props();

	let expanded = $state(false);
</script>

<div class="mb-3">
	<!-- Header Toggle -->
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center justify-between px-4 py-3 rounded-2xl"
		style="background-color: var(--color-surface-container)"
	>
		<div class="flex items-center gap-2">
			<span class="text-xs font-bold tracking-widest uppercase" style="color: var(--color-primary)">{t.items_checked_label}</span>
		</div>
		<svg
			width="16" height="16" viewBox="0 0 24 24" fill="none"
			stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
			class="transition-transform duration-200"
			style="transform: rotate({expanded ? '180deg' : '0deg'})"
		>
			<polyline points="6 9 12 15 18 9"/>
		</svg>
	</button>

	<!-- Checked Items – gleiche Kachelgröße wie offene Items -->
	{#if expanded}
		<div class="grid grid-cols-3 gap-3 mt-3">
			{#each checkedItems as item (item.id)}
				{@const category = getCategoryForItem(item.name, item.categoryOverride)}
				<button
					onclick={() => onUncheck(item)}
					class="w-full aspect-square rounded-3xl relative overflow-hidden opacity-40 active:opacity-25 transition-opacity"
					style="background-color: var(--color-surface-card)"
				>
					<!-- Kategorie-Icon (gedimmt) -->
					<div class="absolute inset-0 flex items-start justify-center pt-[30px]">
						<svg width="44" height="44" viewBox="0 0 24 24" fill="none"
						     stroke="var(--color-on-surface-variant)" stroke-width="1.3"
						     stroke-linecap="round" stroke-linejoin="round">
							{@html category.svgContent}
						</svg>
					</div>
					<!-- Name + Menge (durchgestrichen) -->
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
</div>
