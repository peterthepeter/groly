<script lang="ts">
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { currentLang } from '$lib/i18n.svelte';

	let { onClose }: { onClose: () => void } = $props();

	const lang = $derived(currentLang());

	type InfoItem = { title: string; text: string; link?: { href: string; label: string } };
	type InfoSection = { section: string; svg: string; items: InfoItem[] };

	const sections = $derived<InfoSection[]>(lang === 'en' ? [
		{
			section: 'App & Basics',
			svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
			items: [
				{
					title: 'One-handed use',
					text: 'Groly is designed for one-handed use. New items appear at the bottom and lists grow upward; navigation and sheets also open from the bottom.'
				},
				{
					title: 'Offline & sync',
					text: 'You can keep working without an internet connection. Changes are saved on your device and synced automatically when you are back online.'
				},
				{
					title: 'Updates',
					text: 'When an update is ready, an arrow appears in the top bar. Tap it and reload Groly from the dialog.'
				},
				{
					title: 'Quick access',
					text: 'Long-press + to show up to four shortcuts. Slide to a shortcut and release to open it.',
					link: { href: '/einstellungen#schnellzugriff', label: 'Set up shortcuts' }
				},
				{
					title: 'Keep screen on',
					text: 'Groly can keep the screen awake while you shop, cook from a recipe, or meditate. Each context can be enabled separately in Settings.',
					link: { href: '/einstellungen', label: 'Manage in Settings' }
				}
			]
		},
		{
			section: 'Lists',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
			items: [
				{
					title: 'Open, edit & sort',
					text: 'Tap a list to open it. Long-press its name to edit it, or long-press the Lists tab to rearrange your lists.'
				},
				{
					title: 'Share & notify',
					text: 'Long-press a list and use the share icon to invite another user. Notifications for changes to shared lists can be enabled in Settings.'
				},
				{
					title: 'Location detection',
					text: 'Assign a location while editing a list and Groly can open it automatically when you arrive. Your GPS location stays on your device; only address searches are sent to OpenStreetMap.',
					link: { href: '/einstellungen', label: 'Enable location detection' }
				},
				{
					title: 'List view',
					text: 'Prefer compact rows to tiles? Switch to List view in Settings to show icon, name, and quantity on one line.',
					link: { href: '/einstellungen', label: 'Choose a list view' }
				}
			]
		},
		{
			section: 'Items',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`,
			items: [
				{
					title: 'Add items',
					text: 'Separate several items with commas, for example “2x Milk, 500g Ground beef, Bread”. Quantities at the start are recognized automatically.'
				},
				{
					title: 'Use & edit',
					text: 'Tap an item to check it off. Long-press to edit or delete it; swipe a long name sideways to reveal it in full.'
				},
				{
					title: 'Categories',
					text: 'Groly automatically recognizes items and shows a matching category or product icon. Long-press an item to change its category or return to Automatic. Groly remembers your choice for items with the same name. Set the order globally in Settings or per list in its edit dialog.',
					link: { href: '/einstellungen#kategorien-sortieren', label: 'Set category sorting' }
				},
				{
					title: 'Favorites',
					text: 'Long-press an item and tap the star beside its quantity to save it. Open + → Favorites to add saved items quickly; long-press a favorite to remove it.'
				}
			]
		},
		{
			section: 'Trackers',
			svg: `<path d="M3 3v18h18"/><path d="m7 15 3-3 3 2 4-5"/>`,
			items: [
				{
					title: 'Today & history',
					text: 'Switch between Today, History, and—when enabled—Nutrition in the section bar below the header. Use + to open Quick Log. Tap a tracker card to expand it and manage its entries. History summarizes your data by day, week, or month.'
				},
				{
					title: 'Supplements & reminders',
					text: 'Create supplements under Manage with a name, unit, and optional nutrients. Use the bell to schedule reminders; logging a supplement up to 45 minutes early completes its closest reminder. Week plan shows the complete reminder schedule.',
					link: { href: '/tracker/verwalten', label: 'Open Manage' }
				},
				{
					title: 'Water',
					text: 'Enable Water under Manage, then log a preset or custom amount from its card. Set a daily goal and expand the card to review or delete entries.'
				},
				{
					title: 'Caffeine',
					text: 'Save your usual drinks and log them from the Caffeine card. Groly tracks milliliters and caffeine against your daily limit; drinks and the limit are editable under Manage.'
				},
				{
					title: 'Meditation',
					text: 'Choose a preset or custom duration and start the timer. Preparation time, sounds, daily goal, and reminder weekdays are configurable under Manage; ending early still saves the elapsed time.'
				},
				{
					title: 'Mood journal',
					text: 'Record mood and daily energy on a 1–5 scale, then optionally add feelings, activities, contexts, gratitude, or a note. The completed previous week appears as a factual review from four entries and remains available in weekly History. Its Today card can be hidden directly or disabled under Manage.'
				},
				{
					title: 'Nutrition',
					text: 'Log meals using product search, barcode scanning, or complete custom nutrition values. The daily balance shows calories and macros at a glance; individual ingredients and meal templates can be created and managed in Favorites. Daily targets can be entered manually or explicitly filled from the needs calculator. Recipes can be matched once and then logged by serving. The bottom Tracker button returns to the tracker overview.'
				}
			]
		},
		{
			section: 'Recipes',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Create or import',
					text: 'Use + to create a recipe manually or import one from a supported website. Paste several ingredient lines at once and Groly separates amount, unit, and name for you.'
				},
				{
					title: 'Cook & shop',
					text: 'Adjust the serving count, deselect ingredients you do not need, and use the cart to add the rest to a shopping list.'
				},
				{
					title: 'Meal plan',
					text: 'Plan several meals per day, adjust servings, and add one meal or the entire week to a shopping list.'
				},
				{
					title: 'Organize & remember',
					text: 'Use favorites, ratings, and tags to organize recipes. “Cooked today” updates the cooking history; long-press the Recipes tab to arrange recipes manually.'
				}
			]
		}
	] : [
		{
			section: 'App & Grundlagen',
			svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
			items: [
				{
					title: 'Einhandbedienung',
					text: 'Groly ist für die Bedienung mit einer Hand ausgelegt. Neue Items erscheinen unten und Listen wachsen nach oben; auch Navigation und Dialoge öffnen sich von unten.'
				},
				{
					title: 'Offline & Synchronisation',
					text: 'Du kannst ohne Internet weiterarbeiten. Änderungen bleiben auf deinem Gerät gespeichert und werden automatisch synchronisiert, sobald du wieder online bist.'
				},
				{
					title: 'Updates',
					text: 'Ist ein Update verfügbar, erscheint oben ein Pfeil. Tippe ihn an und lade Groly über den angezeigten Dialog neu.'
				},
				{
					title: 'Schnellzugriff',
					text: 'Halte + gedrückt, um bis zu vier Schnellzugriffe zu öffnen. Schiebe den Finger zum gewünschten Ziel und lasse los.',
					link: { href: '/einstellungen#schnellzugriff', label: 'Schnellzugriffe einrichten' }
				},
				{
					title: 'Bildschirm anlassen',
					text: 'Groly kann den Bildschirm beim Einkaufen, Kochen mit Rezept oder Meditieren wach halten. Jeder Bereich lässt sich einzeln in den Einstellungen aktivieren.',
					link: { href: '/einstellungen', label: 'In den Einstellungen verwalten' }
				}
			]
		},
		{
			section: 'Listen',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
			items: [
				{
					title: 'Öffnen, bearbeiten & sortieren',
					text: 'Tippe eine Liste zum Öffnen an. Halte ihren Namen gedrückt, um sie zu bearbeiten, oder halte den Listen-Tab gedrückt, um deine Listen zu sortieren.'
				},
				{
					title: 'Teilen & Benachrichtigungen',
					text: 'Halte eine Liste gedrückt und lade über das Teilen-Icon andere Nutzer ein. Benachrichtigungen über Änderungen an geteilten Listen aktivierst du in den Einstellungen.'
				},
				{
					title: 'Standorterkennung',
					text: 'Hinterlege beim Bearbeiten einer Liste einen Standort und Groly kann sie bei deiner Ankunft automatisch öffnen. Dein GPS-Standort bleibt auf dem Gerät; nur Adresssuchen werden an OpenStreetMap gesendet.',
					link: { href: '/einstellungen', label: 'Standorterkennung aktivieren' }
				},
				{
					title: 'Listenansicht',
					text: 'Du bevorzugst kompakte Zeilen statt Kacheln? Aktiviere die Listenansicht, um Icon, Name und Menge in einer Zeile zu sehen.',
					link: { href: '/einstellungen', label: 'Listenansicht auswählen' }
				}
			]
		},
		{
			section: 'Items',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`,
			items: [
				{
					title: 'Items hinzufügen',
					text: 'Trenne mehrere Items durch Kommas, zum Beispiel „2x Milch, 500 g Hackfleisch, Brot“. Mengenangaben am Anfang werden automatisch erkannt.'
				},
				{
					title: 'Verwenden & bearbeiten',
					text: 'Tippe ein Item zum Abhaken an. Halte es zum Bearbeiten oder Löschen gedrückt; wische einen langen Namen seitlich, um ihn vollständig zu sehen.'
				},
				{
					title: 'Kategorien',
					text: 'Groly erkennt Items automatisch und zeigt passende Kategorie- oder Produktsymbole. Halte ein Item gedrückt, um die Kategorie zu ändern oder zu „Automatisch“ zurückzukehren. Groly merkt sich deine Auswahl für gleich benannte Items. Die Reihenfolge legst du global in den Einstellungen oder je Liste fest.',
					link: { href: '/einstellungen#kategorien-sortieren', label: 'Kategoriesortierung festlegen' }
				},
				{
					title: 'Favoriten',
					text: 'Halte ein Item gedrückt und tippe auf den Stern neben der Menge. Über + → Favoriten fügst du gespeicherte Items schnell hinzu; langer Druck entfernt einen Favoriten.'
				}
			]
		},
		{
			section: 'Tracker',
			svg: `<path d="M3 3v18h18"/><path d="m7 15 3-3 3 2 4-5"/>`,
			items: [
				{
					title: 'Heute & Verlauf',
					text: 'Über die Bereichsleiste unter dem Header wechselst du zwischen Heute, Verlauf und – falls aktiviert – Ernährung. Über + öffnest du das Quick-Log. Tippe eine Tracker-Karte an, um sie aufzuklappen und ihre Einträge zu verwalten. Der Verlauf fasst deine Daten nach Tag, Woche oder Monat zusammen.'
				},
				{
					title: 'Supplements & Erinnerungen',
					text: 'Lege Supplements unter „Verwalten“ mit Name, Einheit und optionalen Nährstoffen an. Über die Glocke planst du Erinnerungen; ein Log bis zu 45 Minuten vorher erledigt den zeitlich passendsten Reminder. Der Wochenplan zeigt alle Termine auf einen Blick.',
					link: { href: '/tracker/verwalten', label: 'Verwalten öffnen' }
				},
				{
					title: 'Wasser',
					text: 'Aktiviere Wasser unter „Verwalten“ und trage über die Karte eine Vorgabe oder eigene Menge ein. Lege ein Tagesziel fest und klappe die Karte auf, um Einträge zu prüfen oder zu löschen.'
				},
				{
					title: 'Koffein',
					text: 'Speichere deine üblichen Getränke und trage sie über die Koffein-Karte ein. Groly erfasst Milliliter und Koffein bis zum Tageslimit; Getränke und Limit bearbeitest du unter „Verwalten“.'
				},
				{
					title: 'Meditation',
					text: 'Wähle eine Vorgabe oder eigene Dauer und starte den Timer. Vorbereitungszeit, Klänge, Tagesziel und die Wochentage für Erinnerungen stellst du unter „Verwalten“ ein; auch ein vorzeitiges Ende wird gespeichert.'
				},
				{
					title: 'Stimmungstagebuch',
					text: 'Erfasse Stimmung und Tagesenergie auf einer Skala von 1 bis 5 und ergänze optional Gefühle, Aktivitäten, Kontexte, Dankbarkeit oder eine Notiz. Die abgeschlossene Vorwoche erscheint ab vier Einträgen als sachlicher Rückblick und bleibt im Wochenverlauf verfügbar. Die Karte auf „Heute“ kannst du direkt ausblenden oder unter „Verwalten“ abschalten.'
				},
				{
					title: 'Ernährung',
					text: 'Erfasse Mahlzeiten per Produktsuche, Barcode oder mit vollständigen eigenen Nährwerten. Die Tagesbilanz zeigt Kalorien und Makros auf einen Blick; einzelne Zutaten und Gerichtsvorlagen kannst du in den Favoriten anlegen und verwalten. Tagesziele kannst du manuell setzen oder bewusst aus dem Bedarfsrechner übernehmen. Rezepte ordnest du einmal Nährwerten zu und trackst sie danach portionsweise. Über den unteren Tracker-Button gelangst du zurück zur Tracker-Übersicht.'
				}
			]
		},
		{
			section: 'Rezepte',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Anlegen oder importieren',
					text: 'Über + legst du ein Rezept selbst an oder importierst es von einer unterstützten Website. Füge mehrere Zutatenzeilen auf einmal ein und Groly trennt Menge, Einheit und Name für dich.'
				},
				{
					title: 'Kochen & einkaufen',
					text: 'Passe die Portionenzahl an, wähle nicht benötigte Zutaten ab und übertrage den Rest über den Warenkorb in eine Einkaufsliste.'
				},
				{
					title: 'Wochenplan',
					text: 'Plane mehrere Mahlzeiten pro Tag, passe die Portionen an und übertrage ein Gericht oder die ganze Woche in eine Einkaufsliste.'
				},
				{
					title: 'Ordnen & merken',
					text: 'Organisiere Rezepte mit Favoriten, Bewertungen und Tags. „Heute gekocht“ aktualisiert den Kochverlauf; halte den Rezepte-Tab gedrückt, um Rezepte manuell zu sortieren.'
				}
			]
		}
	]);

	let openSection = $state<number | null>(null);
	let reduceMotion = $state(false);

	onMount(() => {
		const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		const updateMotionPreference = () => reduceMotion = mediaQuery.matches;
		updateMotionPreference();
		mediaQuery.addEventListener('change', updateMotionPreference);
		return () => mediaQuery.removeEventListener('change', updateMotionPreference);
	});

	function toggleSection(i: number) {
		openSection = openSection === i ? null : i;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<!-- Modal -->
<div
	class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 pb-6 flex flex-col"
	style="background-color: var(--modal-bg); max-height: 88dvh"
	role="dialog"
	aria-modal="true"
	aria-labelledby="info-modal-title"
>
	<!-- Handle -->
	<div class="flex justify-center mb-4 shrink-0">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<!-- Header -->
	<div class="px-6 mb-4 shrink-0">
		<h2 id="info-modal-title" class="text-lg font-bold" style="color: var(--color-on-surface)">
			{lang === 'en' ? 'How to use' : 'Bedienung'}
		</h2>
		<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">
			{lang === 'en' ? 'Choose a topic' : 'Thema auswählen'}
		</p>
	</div>

	<!-- Sections -->
	<div class="px-4 overflow-y-auto overscroll-contain min-h-0 flex-1">
		<div class="rounded-2xl overflow-hidden divide-y divide-white/[0.08]" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			{#each sections as sec, i (sec.section)}
				<section>
					<h3>
						<button
							type="button"
							id={`info-heading-${i}`}
							aria-expanded={openSection === i}
							aria-controls={`info-panel-${i}`}
							onclick={() => toggleSection(i)}
							class="w-full flex items-center gap-3 px-4 active:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset"
							style="height: 44px; --tw-ring-color: var(--color-primary)"
						>
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
							     stroke="var(--color-primary)" stroke-width="2"
							     stroke-linecap="round" stroke-linejoin="round" class="shrink-0" aria-hidden="true">
								{@html sec.svg}
							</svg>
							<span class="flex-1 text-left text-sm font-medium" style="color: var(--color-on-surface)">{sec.section}</span>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
							     stroke="var(--color-on-surface-variant)" stroke-width="2"
							     stroke-linecap="round" stroke-linejoin="round" class="shrink-0"
							     aria-hidden="true"
							     style="transition: transform {reduceMotion ? 0 : 180}ms cubic-bezier(0.2, 0, 0, 1); transform: rotate({openSection === i ? 90 : 0}deg)">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						</button>
					</h3>

					{#if openSection === i}
						<div
							id={`info-panel-${i}`}
							role="region"
							aria-labelledby={`info-heading-${i}`}
							transition:slide={{ duration: reduceMotion ? 0 : 180 }}
						>
							{#each sec.items as item}
								<div class="py-3.5 pl-12 pr-4" style="border-top: 1px solid var(--color-outline-variant)">
									<h4 class="text-sm font-semibold leading-snug mb-1" style="color: var(--color-on-surface)">{item.title}</h4>
									<p class="text-sm leading-[1.5]" style="color: var(--color-on-surface-variant)">{item.text}</p>
									{#if item.link}
										<a href={item.link.href} onclick={onClose}
										   class="text-[13px] font-semibold mt-1.5 inline-block focus-visible:outline-none focus-visible:underline"
										   style="color: var(--color-primary)">{item.link.label}</a>
									{/if}
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>
	</div>

	<!-- Close button -->
	<div class="px-4 mt-4 shrink-0">
		<button
			type="button"
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold focus-visible:outline-none focus-visible:ring-2"
			style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant); --tw-ring-color: var(--color-primary)"
		>
			{lang === 'en' ? 'Done' : 'Fertig'}
		</button>
	</div>
</div>
