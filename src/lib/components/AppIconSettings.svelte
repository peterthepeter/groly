<script lang="ts">
	import { currentLang, t } from '#lib/i18n.svelte';
	import { appIconAssets, installPath, type AppIcon } from '#lib/appIcon';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';

	let { currentIcon = 'dark' }: { currentIcon?: AppIcon } = $props();
	let choice = $state<AppIcon | null>(null);
	const selected = $derived(choice ?? currentIcon);
	const href = $derived(installPath(selected, currentLang()));
</script>

<div id="app-icon">
	<SettingsSelectRow label={t.icon_settings_title} value={selected} options={[{ value: 'light', label: t.theme_light }, { value: 'dark', label: t.theme_dark }]} onchange={(value) => choice = value as AppIcon}>
		{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9 10h6l-1 6h-4zM10 10V9a2 2 0 0 1 4 0v1" stroke-linejoin="round"/></svg>{/snippet}
		{#snippet preview()}<img src={appIconAssets(selected).preview} alt="" width="24" height="24" class="rounded-md" />{/snippet}
		{#snippet optionPreview(value: string)}<img src={appIconAssets(value as AppIcon).preview} alt="" width="28" height="28" class="rounded-md" />{/snippet}
	</SettingsSelectRow>
	{#if choice !== null}
		<a class="icon-install-action" href={href} target="_blank" rel="noopener" data-sveltekit-reload>{t.icon_setup}</a>
	{/if}
</div>

<style>
	.icon-install-action { display: flex; align-items: center; min-height: 44px; padding: 0 20px 0 52px; font-size: 12px; font-weight: 500; color: var(--color-primary); }
	.icon-install-action:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
</style>
