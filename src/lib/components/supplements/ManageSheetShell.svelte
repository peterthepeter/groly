<script lang="ts">
	import type { Snippet } from 'svelte';

	let {
		accent,
		title,
		subtitle = null,
		onclose,
		body,
		footer = null,
		showFooter = true,
		density = 'compact',
		maxHeight = '90dvh',
		bottom = '0px',
		zIndex = 50
	}: {
		accent: string;
		title: string;
		subtitle?: string | null;
		onclose: () => void;
		body: Snippet;
		footer?: Snippet | null;
		showFooter?: boolean;
		density?: 'compact' | 'comfortable';
		maxHeight?: string;
		bottom?: string;
		zIndex?: number;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 manage-sheet-backdrop" style="z-index: {zIndex - 10}" onclick={onclose}></div>
<section
	class="fixed left-0 right-0 mx-auto flex max-w-[430px] flex-col overflow-hidden rounded-t-3xl manage-sheet-shell"
	data-density={density}
	style="--manage-accent: {accent}; --manage-control-height: {density === 'compact' ? '40px' : '48px'}; --manage-section-padding: {density === 'compact' ? '9px' : '12px'}; --manage-stack-gap: {density === 'compact' ? '8px' : '12px'}; --manage-chip-height: {density === 'compact' ? '32px' : '36px'}; --manage-radius: {density === 'compact' ? '14px' : '18px'}; z-index: {zIndex}; bottom: {bottom}; max-height: {maxHeight}; background-color: var(--modal-bg)"
>
	<div class="manage-sheet-handle" aria-hidden="true"><span></span></div>
	<header class="manage-sheet-header">
		<span class="manage-sheet-dot" aria-hidden="true"></span>
		<div class="min-w-0">
			<h2>{title}</h2>
			{#if subtitle}<p>{subtitle}</p>{/if}
		</div>
	</header>
	<div class="manage-sheet-body">{@render body()}</div>
	{#if footer && showFooter}<footer class="manage-sheet-footer">{@render footer()}</footer>{/if}
</section>

<style>
	.manage-sheet-backdrop {
		background: rgba(0, 0, 0, 0.52);
		animation: manage-fade 180ms cubic-bezier(0.2, 0, 0, 1);
	}

	.manage-sheet-shell {
		animation: manage-rise 220ms cubic-bezier(0.2, 0, 0, 1);
	}

	.manage-sheet-handle {
		display: flex;
		height: 24px;
		flex: none;
		align-items: center;
		justify-content: center;
	}

	.manage-sheet-handle span {
		width: 40px;
		height: 4px;
		border-radius: 999px;
		background: var(--color-surface-high);
	}

	.manage-sheet-header {
		display: flex;
		min-height: 44px;
		flex: none;
		align-items: center;
		gap: 9px;
		padding: 0 20px 8px;
	}

	.manage-sheet-dot {
		width: 6px;
		height: 6px;
		flex: none;
		border-radius: 999px;
		background: var(--manage-accent);
	}

	.manage-sheet-header h2 {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		font-size: 16px;
		font-weight: 650;
		line-height: 1.2;
		color: var(--color-on-surface);
	}

	.manage-sheet-header p {
		margin-top: 2px;
		font-size: 11px;
		font-weight: 550;
		line-height: 1.2;
		color: var(--manage-accent);
	}

	.manage-sheet-body {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		padding: 3px 20px 10px;
	}

	.manage-sheet-footer {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		flex: none;
		gap: 8px;
		padding: 9px 20px max(12px, env(safe-area-inset-bottom));
		border-top: 1px solid var(--bubble-container-border);
		background: var(--modal-bg);
	}

	:global(.manage-stack) {
		display: flex;
		flex-direction: column;
		gap: var(--manage-stack-gap);
	}

	:global(.manage-section) {
		padding: var(--manage-section-padding);
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--manage-radius);
		background: var(--bubble-container-bg);
	}

	:global(.manage-section-title),
	:global(.manage-label) {
		display: block;
		margin: 0 0 5px 2px;
		font-size: 11px;
		font-weight: 600;
		line-height: 1.15;
		color: var(--color-on-surface-variant);
	}

	:global(.manage-section-title) {
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	:global(.manage-input),
	:global(.manage-select),
	:global(.manage-control) {
		height: var(--manage-control-height);
		min-width: 0;
		border: 1px solid var(--bubble-container-border);
		border-radius: calc(var(--manage-radius) - 2px);
		background: var(--color-surface-container);
		color: var(--color-on-surface);
		font-size: 16px;
		outline: none;
	}

	:global(.manage-input),
	:global(.manage-select) {
		width: 100%;
		padding-inline: 13px;
	}

	:global(.manage-input[type='number']) {
		appearance: textfield;
	}

	:global(.manage-input[type='number']::-webkit-inner-spin-button),
	:global(.manage-input[type='number']::-webkit-outer-spin-button) {
		margin: 0;
		appearance: none;
	}

	:global(.manage-input:focus-visible),
	:global(.manage-select:focus-visible) {
		border-color: var(--manage-accent);
		box-shadow: 0 0 0 2px color-mix(in srgb, var(--manage-accent) 16%, transparent);
	}

	:global(.manage-chip-grid) {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
		gap: 5px;
	}

	:global(.manage-chip) {
		min-height: var(--manage-chip-height);
		padding-inline: 8px;
		border: 1px solid var(--bubble-container-border);
		border-radius: 10px;
		background: transparent;
		color: var(--color-on-surface-variant);
		font-size: 12px;
		font-weight: 650;
		touch-action: manipulation;
	}

	:global(.manage-chip[data-selected='true']) {
		border-color: color-mix(in srgb, var(--manage-accent) 55%, transparent);
		background: color-mix(in srgb, var(--manage-accent) 14%, transparent);
		color: var(--manage-accent);
	}

	:global(.manage-row) {
		display: flex;
		min-height: var(--manage-control-height);
		align-items: center;
		gap: 10px;
	}

	:global(.manage-toggle) {
		position: relative;
		width: 44px;
		height: 24px;
		flex: none;
		border-radius: 999px;
		background: var(--color-surface-high);
		transition: background-color 160ms cubic-bezier(0.2, 0, 0, 1);
	}

	:global(.manage-toggle span) {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 18px;
		height: 18px;
		border-radius: 999px;
		background: white;
		transition: transform 160ms cubic-bezier(0.2, 0, 0, 1);
	}

	:global(.manage-toggle[data-active='true']) {
		background: var(--manage-accent);
	}

	:global(.manage-toggle[data-active='true'] span) {
		transform: translateX(20px);
	}

	:global(.manage-toggle-small) {
		width: 36px;
		height: 20px;
	}

	:global(.manage-toggle-small span) {
		top: 3px;
		left: 3px;
		width: 14px;
		height: 14px;
	}

	:global(.manage-toggle-small[data-active='true'] span) {
		transform: translateX(16px);
	}

	:global(.manage-primary),
	:global(.manage-secondary),
	:global(.manage-danger),
	:global(.manage-icon-button) {
		display: flex;
		height: var(--manage-control-height);
		align-items: center;
		justify-content: center;
		border-radius: 16px;
		font-size: 14px;
		font-weight: 650;
		touch-action: manipulation;
	}

	:global(.manage-primary) {
		background: var(--manage-accent);
		color: white;
	}

	:global(.manage-secondary) {
		border: 1px solid var(--bubble-container-border);
		background: transparent;
		color: var(--color-on-surface-variant);
	}

	:global(.manage-danger) {
		gap: 6px;
		background: transparent;
		color: var(--color-error);
	}

	:global(.manage-icon-button) {
		width: var(--manage-control-height);
		flex: none;
		border: 1px solid var(--bubble-container-border);
		background: transparent;
		color: var(--color-error);
	}

	:global(.manage-reminder-card) {
		display: flex;
		flex-direction: column;
		gap: var(--manage-stack-gap);
		padding: var(--manage-section-padding);
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--manage-radius);
		background: var(--bubble-container-bg);
	}

	:global(.manage-reminder-actions) {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 48px;
		gap: 8px;
	}

	@keyframes manage-rise {
		from { opacity: 0; transform: translateY(14px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes manage-fade {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@media (prefers-reduced-motion: reduce) {
		.manage-sheet-shell,
		.manage-sheet-backdrop { animation: none; }
	}
</style>
