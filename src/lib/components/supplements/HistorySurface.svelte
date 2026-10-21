<script lang="ts">
	import type { Snippet } from 'svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="history-surface">
	{@render children()}
</div>

<style>
	/* Mood loads independently and may render no section at all. Only actual
	   sections create the surface and participate in the inset dividers. */
	.history-surface:has(> :global(.history-section)) {
		--history-section-title-size: 15px;
		--history-section-title-weight: 650;
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--radius-xl);
		background: var(--bubble-container-bg);
	}

	.history-surface > :global(.history-section) {
		position: relative;
		min-width: 0;
	}

	.history-surface :global(.history-section-header) {
		padding: 16px 16px 12px;
	}

	.history-surface :global(.history-section-title) {
		color: var(--color-on-surface);
		font-size: var(--history-section-title-size);
		font-weight: var(--history-section-title-weight);
		line-height: 1.35;
	}

	.history-surface :global(.history-section-content) {
		padding: 0 16px 16px;
	}

	.history-surface > :global(.history-section ~ .history-section)::before {
		content: '';
		position: absolute;
		inset-inline: 16px;
		top: 0;
		height: 1px;
		background: var(--bubble-container-border);
		pointer-events: none;
	}
</style>
