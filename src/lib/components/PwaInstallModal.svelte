<script lang="ts">
	import { currentLang, t } from '$lib/i18n.svelte';

	let { onClose, deferredPrompt = $bindable<any>(null) }: {
		onClose: () => void;
		deferredPrompt?: any;
	} = $props();

	const lang = $derived(currentLang());

	type Platform = 'ios' | 'android';

	function detectPlatform(): Platform {
		if (typeof navigator === 'undefined') return 'ios';
		return /android/i.test(navigator.userAgent) ? 'android' : 'ios';
	}

	let activePlatform = $state<Platform>(detectPlatform());

	let installDone = $state(false);

	async function triggerInstall() {
		if (!deferredPrompt) return;
		deferredPrompt.prompt();
		const { outcome } = await deferredPrompt.userChoice;
		deferredPrompt = null;
		if (outcome === 'accepted') installDone = true;
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

	<!-- Header -->
	<div class="px-6 mb-4">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">
			{lang === 'en' ? 'Install App' : 'App installieren'}
		</h2>
		<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">
			{lang === 'en' ? 'Add Groly to your home screen for the best experience' : 'Groly zum Startbildschirm hinzufügen für die beste Erfahrung'}
		</p>
		<p class="text-xs mt-1.5" style="color: var(--color-on-surface-variant)">
			{t.pwa_install_subtitle}
		</p>
	</div>

	<!-- Platform Toggle -->
	<div class="px-4 mb-4">
		<div class="flex rounded-xl p-1 gap-1" style="background-color: var(--color-surface-container)">
			<button
				onclick={() => activePlatform = 'ios'}
				class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
				style="background-color: {activePlatform === 'ios' ? 'var(--color-surface-low)' : 'transparent'}; color: {activePlatform === 'ios' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
			>
				<!-- Apple icon -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
					<path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
				</svg>
				iOS
			</button>
			<button
				onclick={() => activePlatform = 'android'}
				class="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-colors"
				style="background-color: {activePlatform === 'android' ? 'var(--color-surface-low)' : 'transparent'}; color: {activePlatform === 'android' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
			>
				<!-- Android icon -->
				<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
					<path d="M17.523 15.341a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zm-11.046 0a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5zM3.513 8.956a.75.75 0 0 1 .098-1.056l2.91-2.398a.75.75 0 0 1 .958 1.158L4.57 9.054a.75.75 0 0 1-1.057-.098zm16.974 0a.75.75 0 0 1-1.057.098l-2.909-2.398a.75.75 0 0 1 .958-1.158l2.91 2.398a.75.75 0 0 1 .098 1.06zM15.535 3.27l-1.022 1.775A5.97 5.97 0 0 0 12 4.5a5.97 5.97 0 0 0-2.512.545L8.465 3.27a.75.75 0 1 0-1.299.75l.985 1.71A6 6 0 0 0 6 11v1h12v-1a6 6 0 0 0-2.151-4.57l.985-1.71a.75.75 0 1 0-1.299-.75zM4.5 13.5v4.25A2.25 2.25 0 0 0 6.75 20h.75v1.25a2 2 0 0 0 4 0V20h1v1.25a2 2 0 0 0 4 0V20h.75a2.25 2.25 0 0 0 2.25-2.25V13.5H4.5z"/>
				</svg>
				Android
			</button>
		</div>
	</div>

	<!-- Steps -->
	<div class="px-4 overflow-y-auto" style="max-height: 50vh">
		{#if activePlatform === 'ios'}
			{#if lang === 'en'}
				{@const steps = [
					{ n: 1, text: 'Open Groly in Safari (not Chrome or another browser).' },
					{ n: 2, text: 'Tap the Share button at the bottom of the screen (box with an arrow pointing up).' },
					{ n: 3, text: 'Scroll down in the Share menu and tap "Add to Home Screen".' },
					{ n: 4, text: 'Tap "Add" in the top right corner. Groly will appear on your home screen like a native app.' }
				]}
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
					{#each steps as s}
						<div class="flex items-start gap-3 px-3 py-2.5">
							<div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
							     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
								{s.n}
							</div>
							<div class="flex-1 min-w-0 text-xs leading-relaxed pt-1" style="color: var(--color-on-surface-variant)">{s.text}</div>
						</div>
					{/each}
				</div>
			{:else}
				{@const steps = [
					{ n: 1, text: 'Öffne Groly in Safari (nicht Chrome oder einem anderen Browser).' },
					{ n: 2, text: 'Tippe auf den Teilen-Button unten in der Mitte (Rechteck mit Pfeil nach oben).' },
					{ n: 3, text: 'Scrolle im Teilen-Menü nach unten und wähle „Zum Home-Bildschirm".' },
					{ n: 4, text: 'Tippe oben rechts auf „Hinzufügen". Groly erscheint wie eine native App auf deinem Startbildschirm.' }
				]}
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
					{#each steps as s}
						<div class="flex items-start gap-3 px-3 py-2.5">
							<div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
							     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
								{s.n}
							</div>
							<div class="flex-1 min-w-0 text-xs leading-relaxed pt-1" style="color: var(--color-on-surface-variant)">{s.text}</div>
						</div>
					{/each}
				</div>
			{/if}
		{:else}
			{#if installDone}
				<div class="px-3 py-4 rounded-2xl text-center"
				     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent)">
					<div class="text-2xl mb-1">✓</div>
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">
						{lang === 'en' ? 'Installed!' : 'Installiert!'}
					</div>
					<div class="text-xs mt-1" style="color: var(--color-on-surface-variant)">
						{lang === 'en' ? 'Groly has been added to your home screen.' : 'Groly wurde zum Startbildschirm hinzugefügt.'}
					</div>
				</div>
			{:else if deferredPrompt}
				<button
					onclick={triggerInstall}
					class="w-full flex items-center justify-center gap-3 py-3 rounded-2xl text-sm font-semibold transition-colors active:opacity-80"
					style="background-color: var(--color-primary); color: var(--color-on-primary)"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/>
						<polyline points="8 10 12 14 16 10"/>
						<line x1="12" y1="14" x2="12" y2="6"/>
					</svg>
					{lang === 'en' ? 'Install Groly' : 'Groly installieren'}
				</button>
				<div class="px-3 py-2 text-xs text-center" style="color: var(--color-on-surface-variant)">
					{lang === 'en' ? 'Tap the button above to install directly.' : 'Tippe auf den Button, um die App direkt zu installieren.'}
				</div>
			{:else}
				{#if lang === 'en'}
					{@const steps = [
						{ n: 1, text: 'Open Groly in Chrome.' },
						{ n: 2, text: 'Tap the three-dot menu (⋮) in the top right corner.' },
						{ n: 3, text: 'Tap "Add to Home screen" or "Install app".' },
						{ n: 4, text: 'Confirm with "Add". Groly will appear on your home screen and runs in its own window.' }
					]}
					<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
						{#each steps as s}
							<div class="flex items-start gap-3 px-3 py-2.5">
								<div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
								     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
									{s.n}
								</div>
								<div class="flex-1 min-w-0 text-xs leading-relaxed pt-1" style="color: var(--color-on-surface-variant)">{s.text}</div>
							</div>
						{/each}
					</div>
				{:else}
					{@const steps = [
						{ n: 1, text: 'Öffne Groly in Chrome.' },
						{ n: 2, text: 'Tippe auf das Drei-Punkte-Menü (⋮) oben rechts.' },
						{ n: 3, text: 'Wähle „Zum Startbildschirm hinzufügen" oder „App installieren".' },
						{ n: 4, text: 'Bestätige mit „Hinzufügen". Groly erscheint auf dem Startbildschirm und läuft im eigenen Fenster.' }
					]}
					<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
						{#each steps as s}
							<div class="flex items-start gap-3 px-3 py-2.5">
								<div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
								     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)">
									{s.n}
								</div>
								<div class="flex-1 min-w-0 text-xs leading-relaxed pt-1" style="color: var(--color-on-surface-variant)">{s.text}</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		{/if}
	</div>

	<!-- Close button -->
	<div class="px-4 mt-4">
		<button
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{lang === 'en' ? 'Done' : 'Fertig'}
		</button>
	</div>
</div>
