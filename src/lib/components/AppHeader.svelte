<script lang="ts">
	import { networkStore } from '$lib/stores/online.svelte';

	let { title = 'Meine Listen', subtitle = '', onMenuOpen }: {
		title?: string;
		subtitle?: string;
		onMenuOpen: () => void;
	} = $props();
</script>

<header class="fixed top-0 left-0 right-0 z-40 px-4 pt-safe-top pt-4 pb-2">
	<div class="flex items-center justify-between rounded-2xl px-4 py-3 glass"
	     style="background-color: color-mix(in srgb, var(--color-surface-container) 80%, transparent)">
		<!-- Left: Hamburger + App Name -->
		<div class="flex items-center gap-3 min-w-0">
			<button
				onclick={onMenuOpen}
				class="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60 transition-opacity"
				style="background-color: var(--color-surface-high)"
				aria-label="Menü öffnen"
			>
				<svg width="16" height="14" viewBox="0 0 16 14" fill="none">
					<rect width="16" height="2" rx="1" fill="var(--color-on-surface)"/>
					<rect y="6" width="16" height="2" rx="1" fill="var(--color-on-surface)"/>
					<rect y="12" width="16" height="2" rx="1" fill="var(--color-on-surface)"/>
				</svg>
			</button>
			<div class="min-w-0">
				<span class="text-xl font-bold" style="color: var(--color-primary); font-family: 'Plus Jakarta Sans', sans-serif">Groly</span>
				{#if !networkStore.online}
					<div class="flex items-center gap-1 mt-0.5">
						<span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
						<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">Offline</span>
					</div>
				{:else if networkStore.pendingCount > 0}
					<div class="flex items-center gap-1 mt-0.5">
						<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: var(--color-primary)"></span>
						<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">{networkStore.pendingCount} Sync offen</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Right: Page Context -->
		<div class="text-right flex-shrink-0 ml-2">
			<div class="text-sm font-semibold truncate max-w-32" style="color: var(--color-on-surface)">{title}</div>
			{#if subtitle}
				<div class="text-xs truncate max-w-32" style="color: var(--color-on-surface-variant)">{subtitle}</div>
			{/if}
		</div>
	</div>
</header>
