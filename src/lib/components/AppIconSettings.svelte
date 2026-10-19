<script lang="ts">
	import { currentLang, t } from '#lib/i18n.svelte';
	import { appIconAssets, installPath, type AppIcon } from '#lib/appIcon';
	let open = $state(false);
	let choice = $state<AppIcon>('dark');
	let copyState = $state<'idle' | 'copied' | 'failed'>('idle');
	let linkInput = $state<HTMLInputElement>();
	let absoluteLink = $state('');
	const href = $derived(installPath(choice, currentLang()));
	$effect(() => { absoluteLink = new URL(href, window.location.origin).href; copyState = 'idle'; });
	async function copyLink() {
		try { await navigator.clipboard.writeText(absoluteLink); copyState = 'copied'; }
		catch { copyState = 'failed'; linkInput?.focus(); linkInput?.select(); }
	}
</script>

<div id="app-icon">
	<button type="button" class="w-full flex items-center justify-between px-5 py-2.5 min-h-11" aria-expanded={open} aria-controls="app-icon-options" onclick={() => open = !open}>
		<span class="flex items-center gap-3">
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><path d="M9 10h6l-1 6h-4zM10 10V9a2 2 0 0 1 4 0v1" stroke-linejoin="round"/></svg>
			<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.icon_settings_title}</span>
		</span>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" aria-hidden="true" style:transform={open ? 'rotate(90deg)' : 'none'}><path d="m9 6 6 6-6 6"/></svg>
	</button>
	{#if open}
		<div id="app-icon-options" class="px-5 pb-4 space-y-3">
			<p class="text-xs leading-relaxed" style="color: var(--color-on-surface-variant)">{t.icon_settings_description}</p>
			<div class="grid grid-cols-2 gap-2">
				{#each ['light', 'dark'] as variant}
					{@const icon = variant as AppIcon}
					<button type="button" aria-pressed={choice === icon} onclick={() => choice = icon} class="flex flex-col items-center gap-2 rounded-xl p-3 border-2" style="border-color: {choice === icon ? 'var(--color-primary)' : 'transparent'}; color: var(--color-on-surface); background: {choice === icon ? 'var(--bubble-interactive-bg)' : 'transparent'}">
						<img src={appIconAssets(icon).preview} alt="" width="64" height="64" class="rounded-[22%]" />
						<span class="text-xs font-semibold">{icon === 'light' ? t.icon_light : t.icon_dark}</span>
					</button>
				{/each}
			</div>
			<a href={href} target="_blank" rel="noopener" data-sveltekit-reload class="flex items-center justify-center min-h-11 rounded-full px-3 text-sm font-semibold text-center" style="background: var(--color-primary); color: var(--color-on-primary)">{t.icon_setup}</a>
			<button type="button" onclick={copyLink} class="w-full min-h-11 text-sm font-medium" style="color: var(--color-on-surface)">{t.icon_copy}</button>
			<input bind:this={linkInput} aria-label={t.icon_link_label} readonly value={absoluteLink} onclick={(event) => event.currentTarget.select()} class="w-full min-w-0 bg-transparent text-sm" style="color: var(--color-on-surface-variant)" />
			<p role="status" class="text-xs" style="color: var(--color-on-surface-variant)">{copyState === 'copied' ? t.icon_copied : copyState === 'failed' ? t.icon_copy_failed : ''}</p>
		</div>
	{/if}
</div>
