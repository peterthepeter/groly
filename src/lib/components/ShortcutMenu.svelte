<script lang="ts">
	import { goto } from '$app/navigation';
	import type { Shortcut, ShortcutAction } from '$lib/shortcuts.svelte';

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
		const params = sc.action !== 'go' ? `?action=${sc.action}` : '';
		if (sc.action === 'add') {
			(document.getElementById('ios-keyboard-bridge') as HTMLInputElement | null)?.focus();
		}
		goto(`/listen/${sc.listId}${params}`);
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
	{#each shortcuts.slice(0, 4) as sc, i (sc.id)}
		<button
			data-shortcut-id={sc.id}
			onclick={() => execute(sc)}
			class="shortcut-btn flex flex-col items-center justify-start gap-1.5 pt-3 pb-2.5 px-3 rounded-2xl shadow-lg"
			style="background-color: var(--color-surface-container);
			       min-width: 72px;
			       max-width: 92px;
			       --arc-y: {offsets[i] ?? 0}px;
			       transform: translateY({offsets[i] ?? 0}px);
			       animation-delay: {i * 40}ms"
		>
			{@render actionIcon(sc.action)}
			<span
				class="text-xs font-semibold text-center leading-snug"
				style="color: var(--color-on-surface); word-break: break-word; overflow-wrap: break-word; width: 100%"
			>{sc.name}</span>
		</button>
	{/each}
</div>

{#snippet actionIcon(action: ShortcutAction)}
	{#if action === 'scanner'}
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
			<path d="M3 9V6a2 2 0 0 1 2-2h2"/>
			<path d="M3 15v3a2 2 0 0 0 2 2h2"/>
			<path d="M21 9V6a2 2 0 0 0-2-2h-2"/>
			<path d="M21 15v3a2 2 0 0 1-2 2h-2"/>
			<line x1="10" y1="9" x2="10" y2="15"/>
			<line x1="13" y1="9" x2="13" y2="15"/>
			<line x1="16" y1="9" x2="16" y2="15"/>
		</svg>
	{:else if action === 'add'}
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" class="flex-shrink-0">
			<line x1="12" y1="5" x2="12" y2="19"/>
			<line x1="5" y1="12" x2="19" y2="12"/>
		</svg>
	{:else}
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	{/if}
{/snippet}

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
