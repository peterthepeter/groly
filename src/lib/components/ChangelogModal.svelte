<script lang="ts">
	import type { AvailableLanguageTag } from '$lib/paraglide/runtime';

	let { entries, lang, onClose }: {
		entries: { version: string; de: string[]; en: string[] }[];
		lang: AvailableLanguageTag;
		onClose: () => void;
	} = $props();
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl flex flex-col"
     style="background-color: var(--color-surface-low); max-height: 85vh">

	<!-- Handle -->
	<div class="flex justify-center pt-4 pb-2 flex-shrink-0">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<!-- Header -->
	<div class="flex items-center justify-between px-6 py-3 flex-shrink-0">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">Changelog</h2>
		<button
			onclick={onClose}
			class="w-8 h-8 flex items-center justify-center rounded-full active:opacity-60 transition-opacity"
			style="background-color: var(--color-surface-container)"
			aria-label={lang === 'en' ? 'Close' : 'Schließen'}
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)"
			     stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="18" y1="6" x2="6" y2="18"/>
				<line x1="6" y1="6" x2="18" y2="18"/>
			</svg>
		</button>
	</div>

	<!-- Scrollable content -->
	<div class="overflow-y-auto flex-1 px-6 py-2">
		{#each entries as entry, i}
			<div class="py-4">
				<!-- Version badge -->
				<div class="mb-3">
					<span class="inline-flex items-center text-xs font-semibold px-2.5 py-1 rounded-full"
					      style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
						v{entry.version}
					</span>
				</div>

				<!-- Items -->
				<ul class="space-y-2">
					{#each (lang === 'en' ? entry.en : entry.de) as item}
						<li class="flex items-start gap-3">
							<span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
							      style="background-color: var(--color-primary)"></span>
							<span class="text-sm leading-relaxed" style="color: var(--color-on-surface)">{item}</span>
						</li>
					{/each}
				</ul>
			</div>

			{#if i < entries.length - 1}
				<div class="h-px" style="background-color: var(--color-surface-container)"></div>
			{/if}
		{/each}
	</div>

	<!-- Button -->
	<div class="px-4 py-4 flex-shrink-0">
		<button
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold active:opacity-80 transition-opacity"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{lang === 'en' ? 'Close' : 'Schließen'}
		</button>
	</div>
</div>
