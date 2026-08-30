<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		title,
		meta = null,
		trailing = null,
		imageUrl = null,
		fallback = '',
		leading = null,
		onactivate,
		onremove = null,
		removeLabel = 'Remove',
		compact = false
	}: {
		title: string;
		meta?: string | null;
		trailing?: string | null;
		imageUrl?: string | null;
		fallback?: string;
		leading?: Snippet | null;
		onactivate: () => void;
		onremove?: (() => void) | null;
		removeLabel?: string;
		compact?: boolean;
	} = $props();
</script>

<div class="nutrition-food-row" data-compact={compact}>
	<button type="button" class="nutrition-food-main" onclick={onactivate}>
		<span class="nutrition-food-leading" aria-hidden="true">
			{#if leading}
				{@render leading()}
			{:else if imageUrl}
				<img src={imageUrl} alt="" />
			{:else}
				<span class="nutrition-food-fallback">{fallback || title.slice(0, 1).toUpperCase()}</span>
			{/if}
		</span>
		<span class="nutrition-food-copy">
			<span class="nutrition-food-title">{title}</span>
			{#if meta}<span class="nutrition-food-meta">{meta}</span>{/if}
		</span>
		{#if trailing}<span class="nutrition-food-trailing">{trailing}</span>{/if}
	</button>
	{#if onremove}
		<button type="button" class="nutrition-food-remove" onclick={onremove} aria-label={removeLabel}>
			<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="3 6 5 6 21 6"/>
				<path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
			</svg>
		</button>
	{/if}
</div>

<style>
	.nutrition-food-row {
		display: flex;
		min-height: 52px;
		align-items: stretch;
	}

	.nutrition-food-main {
		display: flex;
		min-width: 0;
		flex: 1;
		align-items: center;
		gap: 10px;
		padding: 7px 11px;
		text-align: left;
		touch-action: manipulation;
		transition: opacity 140ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.nutrition-food-main:active { opacity: 0.68; }

	.nutrition-food-leading {
		display: flex;
		width: 34px;
		height: 34px;
		flex: none;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		border-radius: 9px;
	}

	.nutrition-food-leading img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.nutrition-food-fallback {
		display: flex;
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: center;
		background: color-mix(in srgb, #FB923C 8%, transparent);
		color: var(--color-on-surface-variant);
		font-size: 12px;
		font-weight: 650;
	}

	.nutrition-food-copy {
		display: grid;
		min-width: 0;
		flex: 1;
		gap: 2px;
	}

	.nutrition-food-title,
	.nutrition-food-meta {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.nutrition-food-title {
		color: var(--color-on-surface);
		font-size: 14px;
		font-weight: 600;
		line-height: 1.2;
	}

	.nutrition-food-meta,
	.nutrition-food-trailing {
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		line-height: 1.2;
	}

	.nutrition-food-trailing {
		max-width: 42%;
		flex: none;
		text-align: right;
	}

	.nutrition-food-remove {
		display: flex;
		width: 42px;
		min-height: 42px;
		flex: none;
		align-items: center;
		justify-content: center;
		color: var(--color-on-surface-variant);
		touch-action: manipulation;
	}

	.nutrition-food-remove:active { color: var(--color-error); }

	.nutrition-food-row[data-compact='true'] { min-height: 46px; }
	.nutrition-food-row[data-compact='true'] .nutrition-food-leading { width: 28px; height: 28px; border-radius: 7px; }
	.nutrition-food-row[data-compact='true'] .nutrition-food-main { padding-block: 6px; }
</style>
