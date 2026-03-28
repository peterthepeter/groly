<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';

	let { version, items, onClose }: {
		version: string;
		items: string[];
		onClose: () => void;
	} = $props();
</script>

<!-- Backdrop (no click-to-close) -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)"></div>

<!-- Modal -->
<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 pb-6"
     style="background-color: var(--color-surface-low)">

	<!-- Handle -->
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<!-- Icon + Header -->
	<div class="px-6 mb-5 flex items-start gap-4">
		<div class="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center"
		     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
			<svg width="24" height="24" viewBox="0 0 24 24" fill="none"
			     stroke="var(--color-primary)" stroke-width="2"
			     stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
			</svg>
		</div>
		<div class="flex-1 min-w-0">
			<div class="flex items-center gap-2 flex-wrap">
				<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? "What's new" : 'Was ist neu'}
				</h2>
				<span class="text-xs font-semibold px-2 py-0.5 rounded-full"
				      style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
					v{version}
				</span>
			</div>
			<p class="text-xs mt-1" style="color: var(--color-on-surface-variant)">
				{currentLang() === 'en' ? 'Here is what changed in this update.' : 'Das hat sich in diesem Update geändert.'}
			</p>
		</div>
	</div>

	<!-- Changelog items -->
	<div class="px-6 mb-6">
		<ul class="space-y-2">
			{#each items as item}
				<li class="flex items-start gap-3">
					<span class="mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0"
					      style="background-color: var(--color-primary)"></span>
					<span class="text-sm leading-relaxed" style="color: var(--color-on-surface)">{item}</span>
				</li>
			{/each}
		</ul>
	</div>

	<!-- Button -->
	<div class="px-4">
		<button
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold active:opacity-80 transition-opacity"
			style="background-color: var(--color-primary); color: var(--color-on-primary)"
		>
			{currentLang() === 'en' ? 'Got it' : 'Alles klar'}
		</button>
	</div>
</div>
