<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';

	let { children, bottomAligned = false }: { children: Snippet; bottomAligned?: boolean } = $props();
	let form: HTMLElement;

	onMount(() => {
		let previousHeight = document.documentElement.clientHeight;
		return watchVisualViewportBottomOffset((_offset, viewport) => {
			if (!viewport) return;
			const { pageTop, height } = viewport;
			form.style.setProperty('--recipe-form-top', `${pageTop}px`);
			form.style.setProperty('--recipe-form-height', `${height}px`);
			form.style.setProperty('--recipe-form-bottom-inset', Math.round(height) < document.documentElement.clientHeight ? '0px' : 'env(safe-area-inset-bottom, 0px)');
			if (height < previousHeight) {
				const focused = document.activeElement;
				if (focused instanceof HTMLElement && form.contains(focused) && focused.matches('input, textarea')) {
					focused.scrollIntoView({ block: 'nearest', inline: 'nearest' });
				}
			}
			previousHeight = height;
		});
	});
</script>

<div bind:this={form} class="recipe-form-viewport" class:bottom-aligned={bottomAligned}>
	{@render children()}
</div>

<style>
	.recipe-form-viewport {
		/* Page coordinates keep the form aligned when iOS pans the visual viewport. */
		position: absolute;
		inset-inline: 0;
		top: var(--recipe-form-top, 0px);
		height: var(--recipe-form-height, 100dvh);
		--recipe-form-bottom-inset: env(safe-area-inset-bottom, 0px);
		display: flex;
		flex-direction: column;
		background: var(--color-bg);
	}
	.recipe-form-viewport.bottom-aligned { justify-content: flex-end; }
</style>
