<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';
	import FabWithShortcuts from './FabWithShortcuts.svelte';

	let { onAdd, onListsPress = null, onFavorites = null }: { onAdd: () => void; onListsPress?: (() => void) | null; onFavorites?: (() => void) | null } = $props();

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
</script>

<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
	<div class="flex items-center gap-3 pointer-events-auto">
		<!-- Lists Tab Pill -->
		<button
			onclick={handleListsClick}
			onpointerdown={startListsPress}
			onpointerup={endListsPress}
			onpointerleave={endListsPress}
			onpointercancel={endListsPress}
			oncontextmenu={(e) => { if (onListsPress) { e.preventDefault(); } }}
			class="flex items-center justify-center gap-2 px-6 h-14 rounded-full glass active:opacity-70 transition-opacity select-none flex-1"
			style="background-color: color-mix(in srgb, var(--color-surface-container) 85%, transparent)"
		>
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
				<line x1="3" y1="6" x2="21" y2="6"/>
				<path d="M16 10a4 4 0 0 1-8 0"/>
			</svg>
			<span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-on-surface)">{t.nav_lists}</span>
		</button>

		<!-- Favourites Button (nur in Einkaufsliste) -->
		{#if onFavorites}
			<button
				onclick={onFavorites}
				class="w-14 h-14 rounded-full flex items-center justify-center active:scale-95 transition-transform"
				style="background-color: color-mix(in srgb, var(--color-surface-container) 85%, transparent)"
				aria-label="Favourites"
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
				</svg>
			</button>
		{/if}

		<!-- FAB Add Button -->
		<FabWithShortcuts onTap={onAdd} label={t.add} />
	</div>
</div>
