<script lang="ts">
	import type { Snippet } from 'svelte';

	let { onPrevious, onNext, previousLabel, nextLabel, nextDisabled = false, children }: {
		onPrevious: () => void;
		onNext: () => void;
		previousLabel: string;
		nextLabel: string;
		nextDisabled?: boolean;
		children: Snippet;
	} = $props();
</script>

<div class="tracker-date-nav">
	<button type="button" onclick={onPrevious} aria-label={previousLabel}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<polyline points="15 18 9 12 15 6" />
		</svg>
	</button>
	<div class="tracker-date-label">{@render children()}</div>
	<button type="button" onclick={onNext} aria-label={nextLabel} disabled={nextDisabled}>
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<polyline points="9 18 15 12 9 6" />
		</svg>
	</button>
</div>

<style>
	.tracker-date-nav { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 12px; min-height: 36px; }
	.tracker-date-label { min-width: 0; text-align: center; }
	button { display: flex; flex: none; align-items: center; justify-content: center; width: 36px; height: 36px; background: transparent; color: var(--color-on-surface-variant); }
	button:active { opacity: .5; }
	button:disabled { opacity: .25; }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; border-radius: var(--radius-sm); }
</style>
