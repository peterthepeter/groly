<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		accent,
		title,
		expanded = $bindable(false),
		expandable = false,
		headerMeta = null,
		body,
		details = null,
		onactivate,
		ontitleclick,
		inlineExpansion = false,
		oncollapse,
		ontoggle,
		anchorId,
		expandLabel = 'Aufklappen',
		collapseLabel = 'Einklappen',
		borderColor = 'var(--bubble-container-border)',
		order = null
	}: {
		accent: string;
		title: string;
		expanded?: boolean;
		expandable?: boolean;
		headerMeta?: Snippet | null;
		body: Snippet;
		details?: Snippet | null;
		onactivate?: () => void;
		ontitleclick?: () => void;
		inlineExpansion?: boolean;
		oncollapse?: () => void;
		ontoggle?: (expanded: boolean) => void;
		anchorId?: string;
		expandLabel?: string;
		collapseLabel?: string;
		borderColor?: string;
		order?: number | null;
	} = $props();
</script>

<!-- Shared compact coordinate system for tracker tiles in Today and Quick Log. -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	id={anchorId}
	class="tracker-tile rounded-3xl flex flex-col overflow-hidden {expanded ? 'is-expanded' : ''} {inlineExpansion ? 'is-inline-expansion' : ''} {onactivate ? 'cursor-pointer active:opacity-80' : ''}"
	style="--tracker-accent: {accent}; background-color: var(--bubble-container-bg); border: 1px solid {borderColor}; {order === null ? '' : `order: ${order}` }"
	onclick={onactivate}
>
	<header class="tracker-tile-header">
		<span class="tracker-tile-dot" aria-hidden="true"></span>
		{#if ontitleclick}
			<button type="button" class="tracker-tile-title active:opacity-70" onclick={(event) => { event.stopPropagation(); ontitleclick(); }}>{title}</button>
		{:else}
			<p class="tracker-tile-title">{title}</p>
		{/if}
		{#if headerMeta}<div class="tracker-tile-meta">{@render headerMeta()}</div>{/if}
		{#if expanded && inlineExpansion && oncollapse}
			<button
				type="button"
				onclick={(event) => { event.stopPropagation(); oncollapse(); }}
				class="tracker-tile-toggle active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={collapseLabel}
				aria-expanded="true"
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
			</button>
		{:else if expandable}
			<button
				type="button"
				onclick={(event) => { event.stopPropagation(); expanded = !expanded; ontoggle?.(expanded); }}
				class="tracker-tile-toggle active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? collapseLabel : expandLabel}
				aria-expanded={expanded}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)"><polyline points="9 6 15 12 9 18"/></svg>
			</button>
		{/if}
	</header>

	<div class="tracker-tile-body">{@render body()}</div>

	{#if expanded && details}
		<div class="tracker-tile-details">{@render details()}</div>
	{/if}
</div>

<style>
	.tracker-tile {
		--tracker-tile-height: 108px;
		--tracker-tile-padding-x: 12px;
		--tracker-tile-padding-y: 10px;
		--tracker-header-height: 28px;
		--tracker-body-height: 60px;
		height: var(--tracker-tile-height);
		padding: var(--tracker-tile-padding-y) var(--tracker-tile-padding-x);
	}

	.tracker-tile.is-expanded {
		height: auto;
		min-height: var(--tracker-tile-height);
	}

	.tracker-tile.is-expanded.is-inline-expansion {
		grid-column: 1 / -1;
	}

	.tracker-tile.is-expanded.is-inline-expansion .tracker-tile-body {
		height: auto;
		flex-basis: auto;
	}

	.tracker-tile-header {
		height: var(--tracker-header-height);
		flex: 0 0 var(--tracker-header-height);
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}

	.tracker-tile-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		background: var(--tracker-accent);
		flex: none;
	}

	.tracker-tile-title {
		min-width: 0;
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-align: left;
		font-size: 14px;
		font-weight: 600;
		line-height: 1.15;
		color: var(--color-on-surface);
	}

	.tracker-tile-meta {
		flex: none;
		font-size: 11px;
		line-height: 1;
		color: var(--color-on-surface-variant);
	}

	.tracker-tile-toggle {
		width: 28px;
		height: 28px;
		margin-left: -2px;
		margin-right: -7px;
		flex: none;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.tracker-tile-body {
		height: var(--tracker-body-height);
		flex: 0 0 var(--tracker-body-height);
		min-width: 0;
	}

	.tracker-tile-details {
		margin-top: 8px;
		padding-top: 8px;
		border-top: 1px solid var(--color-outline-variant);
		min-width: 0;
	}
</style>
