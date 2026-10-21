<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '#lib/i18n.svelte';
	import type { ListSortOrder } from '#lib/listSorting';

	let { value, onselect, onclose }: { value: ListSortOrder; onselect: (value: ListSortOrder) => void; onclose: () => void } = $props();
	let dialog: HTMLDialogElement;
	const options = $derived<{ value: ListSortOrder; label: string }[]>([
		{ value: 'az', label: 'A→Z' }, { value: 'za', label: 'Z→A' },
		{ value: 'updated', label: t.lists_sort_updated }, { value: 'manual', label: t.lists_sort_manual }
	]);
	onMount(() => { dialog.showModal(); });
</script>

<dialog bind:this={dialog} aria-label={t.sort_mode_title} onclose={onclose} onclick={(event) => { if (event.target === dialog) dialog.close(); }}>
	<div class="sort-sheet-content">
		<div class="handle" aria-hidden="true"><span></span></div>
		<header><h2>{t.sort_mode_title}</h2><button type="button" aria-label={t.close} onclick={() => dialog.close()}>×</button></header>
		<div class="options" role="group" aria-label={t.sort_mode_title}>
			{#each options as option}
				<button type="button" aria-pressed={value === option.value} onclick={() => { dialog.close(); onselect(option.value); }}>
					<span>{option.label}</span>
					{#if value === option.value}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m5 12 4 4L19 6" /></svg>{/if}
				</button>
			{/each}
		</div>
	</div>
</dialog>

<style>
	dialog { position: fixed; inset: auto 0 0; margin: 0 auto; width: 100%; max-width: 430px; max-height: 85dvh; overflow-y: auto; padding: 0; border: 0; border-radius: 24px 24px 0 0; color: var(--color-on-surface); background: var(--modal-bg); }
	dialog::backdrop { background: rgba(0, 0, 0, 0.52); }
	.sort-sheet-content { padding: 0 20px max(16px, env(safe-area-inset-bottom)); }
	.handle { display: flex; justify-content: center; align-items: center; height: 24px; }
	.handle span { width: 40px; height: 4px; border-radius: 999px; background: var(--color-surface-high); }
	header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 8px; }
	h2 { font-size: 16px; font-weight: 650; }
	header button { width: 44px; height: 44px; font-size: 24px; color: var(--color-on-surface-variant); }
	.options { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.options button { display: flex; align-items: center; justify-content: space-between; width: 100%; min-height: 48px; padding: 10px 16px; text-align: left; font-size: 14px; }
	.options button + button { border-top: 1px solid var(--bubble-container-border); }
	.options button[aria-pressed="true"] { color: var(--color-primary); }
	button:active { background: var(--bubble-interactive-bg); }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
</style>
