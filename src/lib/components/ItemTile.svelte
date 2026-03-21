<script lang="ts">
	let { item, onTap, onLongPress, onDelete }: {
		item: { id: string; name: string; quantityInfo: string | null };
		onTap: () => void;
		onLongPress: () => void;
		onDelete: () => void;
	} = $props();

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let showDelete = $state(false);

	function startPress() {
		pressTimer = setTimeout(() => {
			showDelete = true;
		}, 500);
	}

	function endPress() {
		if (pressTimer) {
			clearTimeout(pressTimer);
			pressTimer = null;
		}
	}

	function handleClick() {
		if (showDelete) {
			showDelete = false;
			return;
		}
		onTap();
	}
</script>

<div class="relative">
	<button
		onclick={handleClick}
		onpointerdown={startPress}
		onpointerup={endPress}
		onpointercancel={endPress}
		oncontextmenu={(e) => { e.preventDefault(); showDelete = !showDelete; }}
		class="w-full aspect-square flex flex-col items-center justify-center gap-2 rounded-2xl transition-all active:scale-95 p-3"
		style="background-color: var(--color-surface-card)"
	>
		<!-- Icon Circle -->
		<div class="w-10 h-10 rounded-full flex items-center justify-center"
		     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
				<circle cx="12" cy="10" r="3"/>
			</svg>
		</div>

		<!-- Name -->
		<div class="text-center">
			<div class="text-xs font-semibold leading-tight line-clamp-2" style="color: var(--color-on-surface)">{item.name}</div>
			{#if item.quantityInfo}
				<div class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">{item.quantityInfo}</div>
			{/if}
		</div>
	</button>

	{#if showDelete}
		<div class="absolute inset-0 rounded-2xl flex items-center justify-center gap-2 z-10"
		     style="background-color: color-mix(in srgb, var(--color-surface-card) 95%, transparent)">
			<button
				onclick={(e) => { e.stopPropagation(); onLongPress(); showDelete = false; }}
				class="p-2 rounded-lg"
				style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)"
				aria-label="Bearbeiten"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
			</button>
			<button
				onclick={(e) => { e.stopPropagation(); onDelete(); showDelete = false; }}
				class="p-2 rounded-lg"
				style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent)"
				aria-label="Löschen"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"/>
					<path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
				</svg>
			</button>
		</div>
	{/if}
</div>
