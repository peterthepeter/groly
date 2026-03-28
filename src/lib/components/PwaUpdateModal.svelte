<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { applyUpdate } from '$lib/stores/pwa.svelte';
	import { LATEST_CHANGES } from '$lib/changelog';

	let { onClose }: { onClose: () => void } = $props();

	function handleReload() {
		onClose();
		applyUpdate();
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 pb-6"
     style="background-color: var(--color-surface-low)">

	<!-- Handle -->
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<!-- Icon + Header -->
	<div class="px-6 mb-6 flex items-start gap-4">
		<div class="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
		     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
			     stroke="var(--color-primary)" stroke-width="2.5"
			     stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="10"/>
				<polyline points="16 12 12 8 8 12"/>
				<line x1="12" y1="16" x2="12" y2="8"/>
			</svg>
		</div>
		<div>
			<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{t.pwa_update_title}</h2>
			<p class="text-xs mt-1 leading-relaxed" style="color: var(--color-on-surface-variant)">{t.pwa_update_body}</p>
		</div>
	</div>

	<!-- Changelog -->
	<div class="px-6 mb-5">
		<p class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--color-on-surface-variant)">
			{currentLang() === 'en' ? "What's new" : 'Was ist neu'} · v{LATEST_CHANGES.version}
		</p>
		<ul class="space-y-1.5">
			{#each (currentLang() === 'en' ? LATEST_CHANGES.en : LATEST_CHANGES.de) as item}
				<li class="flex items-start gap-2 text-sm" style="color: var(--color-on-surface)">
					<span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0" style="background-color: var(--color-primary)"></span>
					{item}
				</li>
			{/each}
		</ul>
	</div>

	<!-- Buttons -->
	<div class="px-4 space-y-2">
		<button
			onclick={handleReload}
			class="w-full py-3.5 rounded-full text-sm font-semibold active:opacity-80 transition-opacity"
			style="background-color: var(--color-primary); color: var(--color-on-primary)"
		>
			{t.pwa_update_reload}
		</button>
		<button
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{t.pwa_update_later}
		</button>
	</div>
</div>
