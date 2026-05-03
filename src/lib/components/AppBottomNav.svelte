<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import FabWithShortcuts from './FabWithShortcuts.svelte';

	let {
		activeTab,
		onFabTap = null,
		fabLabel = '',
		showFab = true,
		fabVariant = 'add',
		fabColor = 'var(--color-primary)'
	}: {
		activeTab: 'lists' | 'supplements' | 'recipes' | 'none';
		onFabTap?: (() => void) | null;
		fabLabel?: string;
		showFab?: boolean;
		fabVariant?: 'add' | 'edit';
		fabColor?: string;
	} = $props();

	const activeOut = '1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent)';
</script>

<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
	<div class="flex items-center gap-3 pointer-events-auto">

		<!-- Left pill -->
		<div class="flex items-center rounded-full gap-0.5" style="height: 52px; padding-left: 1.5px; padding-right: 1.5px; background-color: var(--color-surface-card)"
		>

			<!-- Lists -->
			<button
				onclick={() => goto('/')}
				class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'lists' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
				style="background-color: transparent; {activeTab === 'lists' ? `outline: ${activeOut}` : ''}"
				aria-label={t.nav_lists}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
				     stroke={activeTab === 'lists' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
					<line x1="3" y1="6" x2="21" y2="6"/>
					<path d="M16 10a4 4 0 0 1-8 0"/>
				</svg>
				{#if activeTab === 'lists'}
					<span class="text-sm font-medium whitespace-nowrap"
					      style="color: var(--color-primary)">{t.nav_lists}</span>
				{/if}
			</button>

			<!-- Supplements -->
			{#if userSettings.showSupplementTracker}
				<button
					onclick={() => {
					if (activeTab === 'supplements' && $page.url.pathname === '/supplements') {
						const isHistory = $page.url.searchParams.get('tab') === 'history';
						goto(isHistory ? '/supplements' : '/supplements?tab=history', { noScroll: true, keepFocus: true });
					} else {
						goto('/supplements');
					}
				}}
					class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'supplements' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
					style="background-color: transparent; {activeTab === 'supplements' ? `outline: ${activeOut}` : ''}"
					aria-label={t.nav_supplements}
				>
					<svg width="26" height="26" viewBox="0 0 24 24" fill="none"
					     stroke={activeTab === 'supplements' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
					     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
						<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
					</svg>
					{#if activeTab === 'supplements'}
						<span class="text-sm font-medium whitespace-nowrap"
						      style="color: var(--color-primary)">{t.supplement_title}</span>
					{/if}
				</button>
			{/if}

			<!-- Recipes -->
			{#if userSettings.showRecipes}
				<button
					onclick={() => {
					if (activeTab === 'recipes' && $page.url.pathname === '/rezepte') {
						const isMealplan = $page.url.searchParams.get('tab') === 'mealplan';
						goto(isMealplan ? '/rezepte' : '/rezepte?tab=mealplan', { noScroll: true, keepFocus: true });
					} else {
						goto('/rezepte');
					}
				}}
					class="flex items-center rounded-full transition-all duration-200 active:opacity-70 select-none {activeTab === 'recipes' ? 'gap-2 px-4 h-full' : 'h-11 w-11 justify-center'}"
					style="background-color: transparent; {activeTab === 'recipes' ? `outline: ${activeOut}` : ''}"
					aria-label={t.nav_recipes}
				>
					<svg width="23" height="23" viewBox="0 0 24 24" fill="none"
					     stroke={activeTab === 'recipes' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
					</svg>
					{#if activeTab === 'recipes'}
						<span class="text-sm font-medium whitespace-nowrap"
						      style="color: var(--color-primary)">{t.nav_recipes}</span>
					{/if}
				</button>
			{/if}
		</div>

		<!-- FAB -->
		{#if showFab && onFabTap}
			{#if fabVariant === 'edit'}
				<button
					onclick={onFabTap}
					class="rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
					style="width: 48px; height: 48px; background-color: {fabColor}"
					aria-label={fabLabel}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
			{:else}
				<FabWithShortcuts onTap={onFabTap} label={fabLabel} color={fabColor} />
			{/if}
		{/if}

	</div>
</div>
