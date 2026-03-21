<script lang="ts">
	let { checkedItems, totalChecked, onUncheck }: {
		checkedItems: Array<{ id: string; name: string; quantityInfo: string | null }>;
		totalChecked: number;
		onUncheck: (item: { id: string; name: string; quantityInfo: string | null; isChecked: boolean; checkedAt: number | null; updatedAt: number }) => void;
	} = $props();

	let expanded = $state(false);
</script>

<div class="mb-3">
	<!-- Header Toggle -->
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-colors"
		style="background-color: var(--color-surface-container)"
	>
		<div class="flex items-center gap-2">
			<span class="text-xs font-bold tracking-widest uppercase" style="color: var(--color-primary)">Erledigt</span>
			<span class="text-xs" style="color: var(--color-on-surface-variant)">{totalChecked} erledigte {totalChecked === 1 ? 'Element' : 'Elemente'}</span>
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

	<!-- Checked Items Grid -->
	{#if expanded}
		<div class="grid grid-cols-3 gap-3 mt-3">
			{#each checkedItems as item (item.id)}
				<button
					onclick={() => onUncheck({ ...item, isChecked: true, checkedAt: null, updatedAt: 0 })}
					class="aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl p-3 opacity-50 transition-opacity active:opacity-30"
					style="background-color: var(--color-surface-card)"
				>
					<div class="w-10 h-10 rounded-full flex items-center justify-center"
					     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					</div>
					<div class="text-xs font-semibold text-center line-clamp-2 line-through" style="color: var(--color-on-surface-variant)">{item.name}</div>
				</button>
			{/each}
		</div>
	{/if}
</div>
