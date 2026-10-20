<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n.svelte';

	let { label, description, checked, onchange, icon, disabled = false, infoInitiallyOpen = false }: {
		label: string;
		description?: string;
		checked: boolean;
		onchange: () => void;
		icon?: Snippet;
		disabled?: boolean;
		infoInitiallyOpen?: boolean;
	} = $props();
	const id = $props.id();
	let infoOpen = $state(false);
	$effect(() => { if (infoInitiallyOpen) infoOpen = true; });
</script>

<div class="settings-toggle-row">
	<div class="settings-toggle-header">
		<label for={`${id}-switch`} class="settings-toggle-label">
			{#if icon}<span class="settings-toggle-icon" aria-hidden="true">{@render icon()}</span>{/if}
			<span id={`${id}-label`}>{label}</span>
		</label>
		{#if description}
			<button
				type="button"
				class="settings-toggle-info"
				aria-label={`${t.settings_more_info}: ${label}`}
				aria-expanded={infoOpen}
				aria-controls={`${id}-description`}
				onclick={() => infoOpen = !infoOpen}
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true">
					<circle cx="12" cy="12" r="9" /><path d="M12 11v6m0-10v.01" />
				</svg>
			</button>
		{/if}
		<button
			id={`${id}-switch`}
			type="button"
			{disabled}
			role="switch"
			aria-checked={checked}
			aria-labelledby={`${id}-label`}
			aria-describedby={description ? `${id}-description` : undefined}
			onclick={onchange}
			class="settings-toggle-control"
		>
			<span class="settings-toggle-track" class:checked aria-hidden="true"></span>
		</button>
	</div>
	{#if description}
		<p id={`${id}-description`} class="settings-toggle-description" hidden={!infoOpen}>{description}</p>
	{/if}
</div>

<style>
	.settings-toggle-header {
		display: flex;
		align-items: center;
		min-height: 44px;
		padding: 0 18px 0 20px;
		color: var(--color-on-surface);
	}
	.settings-toggle-label {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 12px;
		min-width: 0;
		min-height: 44px;
		padding: 8px 0;
		font-size: 14px;
		font-weight: 550;
		line-height: 1.4;
		cursor: pointer;
	}
	.settings-toggle-icon { flex: none; color: var(--color-on-surface-variant); }
	.settings-toggle-info, .settings-toggle-control {
		display: flex;
		flex: none;
		align-items: center;
		justify-content: center;
		min-height: 44px;
	}
	.settings-toggle-info { width: 40px; color: var(--color-on-surface-variant); }
	.settings-toggle-control { width: 44px; }
	.settings-toggle-control:disabled { opacity: 0.5; cursor: default; }
	.settings-toggle-description {
		margin: 0;
		padding: 0 20px 12px;
		font-size: 12px;
		white-space: pre-line;
		line-height: 1.5;
		color: var(--color-on-surface-variant);
	}
	.settings-toggle-track {
		width: 40px;
		height: 20px;
		border: 1px solid var(--color-outline-variant);
		border-radius: 999px;
		background: var(--color-surface-container);
		transition: background-color 160ms ease, border-color 160ms ease;
	}
	.settings-toggle-track.checked { background: var(--color-primary); border-color: var(--color-primary); }
	.settings-toggle-header:has(.settings-toggle-control:active), .settings-toggle-info:active { background: var(--bubble-interactive-bg); }
	.settings-toggle-header:has(.settings-toggle-control:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-toggle-info:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	@media (prefers-reduced-motion: reduce) { .settings-toggle-track { transition: none; } }
</style>
