<script lang="ts">
	import { t, items_checked_count } from '$lib/i18n.svelte';

	let { checkedItems, totalChecked, onUncheck }: {
		checkedItems: Array<{ id: string; name: string; quantityInfo: string | null }>;
		totalChecked: number;
		onUncheck: (item: { id: string; listId: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; updatedAt: number }) => void;
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
				<button
					onclick={() => onUncheck({ ...item, listId: '', isChecked: true, checkedAt: null, updatedAt: 0 })}
					class="w-full aspect-square rounded-3xl relative overflow-hidden opacity-45 active:opacity-30 transition-opacity"
					style="background-color: var(--color-surface-card)"
				>
					{#if item.quantityInfo}
						<span class="absolute top-2.5 right-2.5 text-xs font-semibold line-through leading-none"
						      style="color: var(--color-primary)">{item.quantityInfo}</span>
					{/if}
					<div class="absolute inset-0 flex items-start justify-center pt-6">
						<div class="w-[58px] h-[58px] rounded-full flex items-center justify-center"
						     style="background-color: color-mix(in srgb, var(--color-primary) 22%, transparent)">
							<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						</div>
					</div>
					<div class="absolute bottom-0 left-0 right-0 px-3 pb-3">
						<span class="block text-sm font-bold leading-tight line-clamp-2 text-center line-through"
						      style="color: var(--color-on-surface-variant)">{item.name}</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
