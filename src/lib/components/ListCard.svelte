<script lang="ts">
	// Zufällig konsistente Farbe aus dem Listenname
	const COLORS = ['#006c54', '#2e6771', '#4d626c', '#5a4080', '#a0522d', '#1a6b3c'];

	function colorForName(name: string): string {
		let hash = 0;
		for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	let { list, onClick, onDelete }: {
		list: { id: string; name: string; description: string | null; openCount: number };
		onClick: () => void;
		onDelete: () => void;
	} = $props();

	const color = $derived(colorForName(list.name));
	const initial = $derived(list.name[0]?.toUpperCase() ?? '?');

	let showDelete = $state(false);
</script>

<div class="relative">
	<!-- swipe-left to reveal delete (long press fallback) -->
	<button
		onclick={onClick}
		oncontextmenu={(e) => { e.preventDefault(); showDelete = !showDelete; }}
		class="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-colors active:opacity-80 text-left"
		style="background-color: var(--color-surface-card)"
	>
		<!-- Initial Icon -->
		<div class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base"
		     style="background-color: {color}20; color: {color}">
			{initial}
		</div>

		<!-- Text -->
		<div class="flex-1 min-w-0">
			<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{list.name}</div>
			<div class="text-xs truncate mt-0.5" style="color: var(--color-on-surface-variant)">
				{list.description ? `${list.description} · ` : ''}{list.openCount} {list.openCount === 1 ? 'Element' : 'Elemente'}
			</div>
		</div>

		<!-- Chevron -->
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>

	{#if showDelete}
		<button
			onclick={(e) => { e.stopPropagation(); onDelete(); showDelete = false; }}
			class="absolute right-4 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-medium"
			style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
		>
			Löschen
		</button>
	{/if}
</div>
