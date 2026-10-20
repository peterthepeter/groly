<script lang="ts">
	import { goto } from '$app/navigation';
	import { executeShortcut, type Shortcut } from '#lib/shortcuts.svelte';
	import ShortcutActionIcon from '#lib/components/ShortcutActionIcon.svelte';
	import * as m from '#lib/paraglide/messages';

	let { shortcuts, onClose }: { shortcuts: Shortcut[]; onClose: () => void } = $props();

	// Fan arc: center items sit highest, outer items dip down slightly
	const arcOffsets: Record<number, number[]> = {
		1: [0],
		2: [3, 3],
		3: [5, 0, 5],
		4: [8, 3, 3, 8]
	};
	const offsets = $derived(arcOffsets[shortcuts.slice(0, 4).length] ?? [0]);

	function execute(sc: Shortcut) {
		onClose();
		executeShortcut(sc);
	}

	function goToSettings() {
		onClose();
		goto('/einstellungen/schnellzugriff');
	}
</script>

<!-- Backdrop -->
<div class="fixed inset-0 z-40"
     role="presentation"
     onclick={onClose}
     onkeydown={() => {}}
></div>

<!-- Fan: horizontal row, spreading from center, all aligned above FAB -->
<div
	class="fixed z-50 flex items-end justify-center gap-2"
	style="bottom: calc(env(safe-area-inset-bottom, 0px) + 82px); left: 50%; transform: translateX(-50%)"
>
	{#if shortcuts.length === 0}
		<button
			data-shortcut-id="__settings__"
			onclick={goToSettings}
			class="shortcut-btn flex flex-col items-center justify-start gap-1.5 pt-3 pb-2.5 px-3 rounded-2xl shadow-lg"
			style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); min-width: 72px; max-width: 92px; --arc-y: 0px; transform: translateY(0px);"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
				<circle cx="12" cy="12" r="3"/>
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
			</svg>
			<span
				class="text-xs font-semibold text-center leading-snug"
				style="color: var(--color-on-surface); word-break: break-word; overflow-wrap: break-word; width: 100%"
			>{m.shortcut_setup_hint()}</span>
		</button>
	{:else}
		{#each shortcuts.slice(0, 4) as sc, i (sc.id)}
			<button
				data-shortcut-id={sc.id}
				onclick={() => execute(sc)}
				class="shortcut-btn flex flex-col items-center justify-start gap-1.5 pt-3 pb-2.5 px-3 rounded-2xl shadow-lg"
				style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border);				       min-width: 72px;
				       max-width: 92px;
				       --arc-y: {offsets[i] ?? 0}px;
				       transform: translateY({offsets[i] ?? 0}px);
				       animation-delay: {i * 40}ms"
			>
				<ShortcutActionIcon action={sc.action} color="var(--color-primary)" />
				<span
					class="text-xs font-semibold text-center leading-snug"
					style="color: var(--color-on-surface); word-break: break-word; overflow-wrap: break-word; width: 100%"
				>{sc.name}</span>
			</button>
		{/each}
	{/if}
</div>

<style>
	.shortcut-btn {
		animation: shortcutIn 0.18s ease-out both;
	}

	@keyframes shortcutIn {
		from {
			opacity: 0;
			transform: translateY(10px) scale(0.9);
		}
		to {
			opacity: 1;
			/* final translateY comes from inline style (arc offset) */
			transform: translateY(var(--arc-y, 0px)) scale(1);
		}
	}
</style>
