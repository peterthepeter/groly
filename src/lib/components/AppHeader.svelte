<script lang="ts">
	import { networkStore } from '$lib/stores/online.svelte';
	import { t, sync_pending } from '$lib/i18n.svelte';

	import type { Snippet } from 'svelte';

	let { title = 'Meine Listen', subtitle = '', onMenuOpen, onSearch = null, actions = null }: {
		title?: string;
		subtitle?: string;
		onMenuOpen: () => void;
		onSearch?: (() => void) | null;
		actions?: Snippet | null;
	} = $props();
</script>

<header class="fixed top-0 left-0 right-0 z-40 max-w-[430px] mx-auto px-4 pb-2"
        style="padding-top: calc(env(safe-area-inset-top) + 1rem); background: color-mix(in srgb, var(--color-bg) 60%, transparent); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px)">
	<div class="flex items-center justify-between rounded-2xl px-4 py-3"
	     style="background-color: var(--color-surface-low)">
		<!-- Left: Hamburger + App Name -->
		<div class="flex items-center gap-3 min-w-0">
			<button
				onclick={onMenuOpen}
				class="flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60 transition-opacity"
				style="background-color: var(--color-surface-high)"
				aria-label={t.menu_open}
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
						<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">{t.sync_offline}</span>
					</div>
				{:else if networkStore.pendingCount > 0}
					<div class="flex items-center gap-1 mt-0.5">
						<span class="w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: var(--color-primary)"></span>
						<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">{sync_pending(networkStore.pendingCount)}</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- Right: optional Suche + Page Context -->
		<div class="flex items-center gap-2 flex-shrink-0 ml-2">
			{#if actions}
				{@render actions()}
			{/if}
			{#if onSearch}
				<button
					onclick={onSearch}
					class="w-9 h-9 flex-shrink-0 flex items-center justify-center active:opacity-60 transition-opacity"
					aria-label="Suchen"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-on-surface)" stroke-width="2"
					     stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
					</svg>
				</button>
			{/if}
			<div class="text-right">
				<div class="text-sm font-semibold truncate max-w-28" style="color: var(--color-on-surface)">{title}</div>
				{#if subtitle}
					<div class="text-xs truncate max-w-28" style="color: var(--color-on-surface-variant)">{subtitle}</div>
				{/if}
			</div>
		</div>
	</div>
</header>
