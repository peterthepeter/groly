<script lang="ts">
	import { currentLang } from '$lib/i18n.svelte';
	import { CHANGELOG } from '$lib/changelog';

	let { onClose }: { onClose: () => void } = $props();

	const lang = $derived(currentLang());
	const version = CHANGELOG[0]?.version ?? '—';

	const GITHUB = 'https://github.com/peterthepeter/groly';
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
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">
			{lang === 'en' ? 'About' : 'Über Groly'}
		</h2>
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

	<!-- Content -->
	<div class="overflow-y-auto flex-1 px-6 py-2 space-y-3">

		<!-- Single info card -->
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">

			<!-- App row -->
			<div class="flex items-center gap-3 px-4 py-3.5">
				<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
				     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
						<line x1="3" y1="6" x2="21" y2="6"/>
						<path d="M16 10a4 4 0 0 1-8 0"/>
					</svg>
				</div>
				<div class="flex-1">
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">Groly</div>
					<div class="text-xs" style="color: var(--color-on-surface-variant)">
						{lang === 'en' ? 'Made by' : 'Erstellt von'} <span style="color: var(--color-primary)">@peterthepeter</span>
					</div>
				</div>
				<span class="text-xs font-semibold px-2 py-0.5 rounded-full"
				      style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
					v{version}
				</span>
			</div>

			<!-- Divider -->
			<div class="mx-4 h-px" style="background-color: var(--color-surface-high)"></div>

			<!-- Links -->
			<div class="px-4 py-3 flex flex-wrap gap-x-4 gap-y-2">
				<a href={GITHUB} target="_blank" rel="noopener noreferrer"
				   class="flex items-center gap-1.5 text-xs active:opacity-60"
				   style="color: var(--color-on-surface-variant)">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
						<path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
					</svg>
					GitHub
				</a>
				<a href="{GITHUB}/issues" target="_blank" rel="noopener noreferrer"
				   class="flex items-center gap-1.5 text-xs active:opacity-60"
				   style="color: var(--color-on-surface-variant)">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="8" x2="12" y2="12"/>
						<line x1="12" y1="16" x2="12.01" y2="16"/>
					</svg>
					{lang === 'en' ? 'Report a bug' : 'Bug melden'}
				</a>
				<a href="{GITHUB}/discussions" target="_blank" rel="noopener noreferrer"
				   class="flex items-center gap-1.5 text-xs active:opacity-60"
				   style="color: var(--color-on-surface-variant)">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
					</svg>
					{lang === 'en' ? 'Feedback & ideas' : 'Feedback & Ideen'}
				</a>
			</div>

		</div>

	</div>

	<!-- Close button -->
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
