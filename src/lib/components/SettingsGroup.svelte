<script lang="ts">
	import type { Snippet } from 'svelte';
	let { id, label, icon, children, open = $bindable(false) }: {
		id: string;
		label: string;
		icon: Snippet;
		children: Snippet;
		open?: boolean;
	} = $props();
</script>

<section class="settings-group" aria-labelledby={`${id}-title`} data-settings-group={id}>
	<h2 id={`${id}-title`}>
		<button type="button" class="settings-group-header" aria-expanded={open} aria-controls={`${id}-options`} onclick={() => open = !open}>
			<span class="settings-group-icon" aria-hidden="true">{@render icon()}</span>
			<span class="settings-group-label">{label}</span>
			<svg class="settings-group-arrow" class:expanded={open} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6" /></svg>
		</button>
	</h2>
	<div id={`${id}-options`} class="settings-group-content" hidden={!open}>
		{@render children()}
	</div>
</section>

<style>
	.settings-group { border-top: 1px solid var(--bubble-container-border); }
	.settings-group:first-child { border-top: 0; }
	h2 { margin: 0; }
	.settings-group-header { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 52px; padding: 14px 16px; text-align: left; color: var(--color-on-surface); }
	.settings-group-icon { display: flex; flex: none; color: var(--color-primary); }
	.settings-group-label { flex: 1; min-width: 0; font-size: 14px; line-height: 20px; font-weight: 600; }
	.settings-group-arrow { flex: none; color: var(--color-on-surface-variant); transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
	.settings-group-arrow.expanded { transform: rotate(180deg); }
	.settings-group-content { padding: 0 12px 12px; }
	.settings-group-header:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-group-header:active { background: var(--bubble-interactive-bg); }
	@media (prefers-reduced-motion: reduce) { .settings-group-arrow { transition: none; } }
</style>
