<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import FabWithShortcuts from './FabWithShortcuts.svelte';

	let { onAdd, onListsPress = null, onFavorites = null }: {
		onAdd: () => void;
		onListsPress?: (() => void) | null;
		onFavorites?: (() => void) | null;
	} = $props();

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = false;

	function startListsPress() {
		if (!onListsPress) return;
		longFired = false;
		pressTimer = setTimeout(() => {
			longFired = true;
			pressTimer = null;
			onListsPress!();
		}, 500);
	}
	function endListsPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleListsClick() {
		if (longFired) { longFired = false; return; }
		if (!onListsPress) goto('/');
	}

	const activeOut = '1.5px solid color-mix(in srgb, var(--color-primary) 55%, transparent)';
</script>

<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
	<div class="flex items-center gap-3 pointer-events-auto">

		<!-- Left pill: Lists + Supplements + Recipes -->
		<div class="flex items-center rounded-full gap-0.5" style="height: 52px; padding-left: 1.5px; padding-right: 1.5px; background-color: var(--color-surface-card)">

			<!-- Lists (always active in list view) -->
			<button
				onclick={handleListsClick}
				onpointerdown={startListsPress}
				onpointerup={endListsPress}
				onpointerleave={endListsPress}
				onpointercancel={endListsPress}
				oncontextmenu={(e) => { if (onListsPress) { e.preventDefault(); } }}
				class="h-full gap-2 px-4 rounded-full flex items-center active:opacity-70 transition-opacity select-none"
				style="background-color: transparent; outline: {activeOut}"
				aria-label={t.nav_lists}
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-primary)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
					<line x1="3" y1="6" x2="21" y2="6"/>
					<path d="M16 10a4 4 0 0 1-8 0"/>
				</svg>
				<span class="text-sm font-medium whitespace-nowrap" style="color: var(--color-primary)">{t.nav_lists}</span>
			</button>

			<!-- Supplements -->
			{#if userSettings.showSupplementTracker}
				<button
					onclick={() => goto('/supplements')}
					class="h-11 w-11 rounded-full flex items-center justify-center active:opacity-70 transition-opacity select-none"
					style="background-color: transparent"
					aria-label={t.nav_supplements}
				>
					<svg width="26" height="26" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-on-surface-variant)"
					     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
						<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
					</svg>
				</button>
			{/if}

			<!-- Recipes -->
			{#if userSettings.showRecipes}
				<button
					onclick={() => goto('/rezepte')}
					class="h-11 w-11 rounded-full flex items-center justify-center active:opacity-70 transition-opacity select-none"
					style="background-color: transparent"
					aria-label={t.nav_recipes}
				>
					<svg width="23" height="23" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-on-surface-variant)"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
					</svg>
				</button>
			{/if}
		</div>

		<!-- FAB -->
		<FabWithShortcuts onTap={onAdd} label={t.add} />

		<!-- Favorites button -->
		{#if onFavorites}
			<button
				onclick={onFavorites}
				class="rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform select-none"
				style="width: 48px; height: 48px; background-color: var(--color-surface-card)"
				aria-label="Favourites"
			>
				<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-primary)"
				     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
				</svg>
			</button>
		{/if}

	</div>
</div>
