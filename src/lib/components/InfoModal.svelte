<script lang="ts">
	import { currentLang } from '$lib/i18n.svelte';

	let { onClose }: { onClose: () => void } = $props();

	const lang = $derived(currentLang());

	const items = $derived(lang === 'en' ? [
		{
			title: 'One-handed use',
			text: 'Groly is built for mobile from the ground up. New items are added at the bottom — lists grow upward. Navigation and dialogs open from the bottom too.',
			svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`
		},
		{
			title: 'Lists',
			text: 'Tap a list to open it. Long-press a list name to edit it. Long-press the Lists tab at the bottom to enter sort mode.',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
		},
		{
			title: 'Items',
			text: 'Tap an item to check it off. Long-press to edit quantity, category, or delete it.',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`
		},
		{
			title: 'Long names',
			text: 'Swipe a long item name left or right to see the full name in a popup.',
			svg: `<polyline points="18 9 21 12 18 15"/><polyline points="6 9 3 12 6 15"/><line x1="3" y1="12" x2="21" y2="12"/>`
		},
		{
			title: 'Sharing',
			text: 'Long-press a list name to open its settings, then tap the share icon to invite other users. They\'ll receive an invitation.',
			svg: `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>`
		},
		{
			title: 'Notifications',
			text: 'Shared lists support push notifications. Enable them in Settings to stay updated when others make changes.',
			svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
		},
		{
			title: 'Offline',
			text: 'The app works without internet. Changes are saved locally and synced automatically once you\'re back online.',
			svg: `<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`
		},
		{
			title: 'Categories',
			text: 'Items are categorized automatically. Long-press an item and choose a category to override it manually.',
			svg: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`
		},
		{
			title: 'Recipes',
			text: 'Browse your saved recipes and tap one to open it. Adjust the serving size — it saves automatically. Deselect ingredients you don\'t need, then tap the cart icon to add everything to a shopping list.',
			svg: `<path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="20" x2="15" y2="20"/>`
		},
		{
			title: 'Updates',
			text: 'When a new version is available, an arrow icon appears in the top bar. Tap it to open a dialog and reload the app — no need to close it manually.',
			svg: `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`
		}
	] : [
		{
			title: 'Einhandbedienung',
			text: 'Groly ist von Grund auf für das Smartphone gebaut. Neue Items reihen sich unten an – die Liste wächst nach oben. Auch Navigation und Dialoge öffnen sich von unten.',
			svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`
		},
		{
			title: 'Listen',
			text: 'Tippe auf eine Liste, um sie zu öffnen. Langer Druck auf einen Listennamen öffnet den Bearbeiten-Dialog. Langer Druck auf den Listen-Tab unten aktiviert den Sortiermodus.',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
		},
		{
			title: 'Items',
			text: 'Kurzes Tippen hakt ein Item ab. Langes Drücken öffnet den Bearbeiten-Dialog mit Menge, Kategorie und Löschen.',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`
		},
		{
			title: 'Lange Namen',
			text: 'Wische bei langen Item-Namen nach links oder rechts, um den vollständigen Namen im Pop-Up anzuzeigen.',
			svg: `<polyline points="18 9 21 12 18 15"/><polyline points="6 9 3 12 6 15"/><line x1="3" y1="12" x2="21" y2="12"/>`
		},
		{
			title: 'Teilen',
			text: 'Langer Druck auf einen Listennamen öffnet den Bearbeiten-Dialog. Dort über das Teilen-Icon andere Nutzer einladen – diese erhalten eine Einladung.',
			svg: `<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>`
		},
		{
			title: 'Benachrichtigungen',
			text: 'Bei geteilten Listen kannst du Push-Nachrichten aktivieren. Einstellungen → Benachrichtigungen.',
			svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
		},
		{
			title: 'Offline',
			text: 'Die App funktioniert ohne Internet. Änderungen werden lokal gespeichert und automatisch synchronisiert.',
			svg: `<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`
		},
		{
			title: 'Kategorien',
			text: 'Items werden automatisch kategorisiert. Langer Druck auf ein Item → Kategorie manuell überschreiben.',
			svg: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`
		},
		{
			title: 'Rezepte',
			text: 'Tippe auf ein Rezept, um es zu öffnen. Passe die Portionenzahl an – sie wird automatisch gespeichert. Hake Zutaten ab, die du nicht brauchst, und tippe dann auf das Einkaufswagen-Icon, um alles in eine Liste zu übertragen.',
			svg: `<path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7z"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="20" x2="15" y2="20"/>`
		},
		{
			title: 'Updates',
			text: 'Wenn eine neue Version verfügbar ist, erscheint ein Pfeil-Icon in der oberen Leiste. Antippen öffnet einen Dialog zum Neu laden – die App muss nicht manuell geschlossen werden.',
			svg: `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`
		}
	]);
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
			{lang === 'en' ? 'How to use' : 'Bedienung'}
		</h2>
		<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">
			{lang === 'en' ? 'Quick overview of the most important gestures' : 'Kurze Übersicht der wichtigsten Gesten'}
		</p>
	</div>

	<!-- Items -->
	<div class="px-4 space-y-1 overflow-y-auto" style="max-height: 65vh">
		{#each items as item, i (i)}
			<div class="flex items-start gap-3 px-3 py-3 rounded-xl"
			     style="background-color: var(--color-surface-container)">
				<!-- Icon badge -->
				<div class="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center mt-0.5"
				     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-primary)" stroke-width="2"
					     stroke-linecap="round" stroke-linejoin="round">
						{@html item.svg}
					</svg>
				</div>
				<!-- Text -->
				<div class="flex-1 min-w-0">
					<div class="text-sm font-semibold leading-tight mb-0.5"
					     style="color: var(--color-on-surface)">{item.title}</div>
					<div class="text-xs leading-relaxed"
					     style="color: var(--color-on-surface-variant)">{item.text}</div>
				</div>
			</div>
		{/each}
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
