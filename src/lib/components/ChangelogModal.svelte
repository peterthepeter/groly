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
		<div class="flex items-center gap-2.5">
			<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">Changelog</h2>
			<a
				href="https://github.com/peterthepeter/groly/issues"
				target="_blank"
				rel="noopener noreferrer"
				class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium active:opacity-70"
				style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				aria-label="GitHub Issues"
			>
				<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
					<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
				</svg>
				Issues
			</a>
		</div>
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
