<script lang="ts">
	import { currentLang } from '$lib/i18n.svelte';

	let { onClose }: { onClose: () => void } = $props();

	const lang = $derived(currentLang());

	type InfoItem = { title: string; text: string; svg: string; link?: { href: string; label: string } };
	type InfoSection = { section: string; svg: string; items: InfoItem[] };

	const sections = $derived<InfoSection[]>(lang === 'en' ? [
		{
			section: 'App & Basics',
			svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`,
			items: [
				{
					title: 'One-handed use',
					text: 'Groly is built for mobile from the ground up. New items are added at the bottom — lists grow upward. Navigation and dialogs open from the bottom too.',
					svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`
				},
				{
					title: 'Offline',
					text: 'The app works without internet. Changes are saved locally and synced automatically once you\'re back online.',
					svg: `<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`
				},
				{
					title: 'Updates',
					text: 'When a new version is available, an arrow icon appears in the top bar. Tap it to open a dialog and reload the app — no need to close it manually.',
					svg: `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`
				},
				{
					title: 'Quick access',
					text: 'Long-press the + button to reveal up to 4 shortcuts. Slide your finger to the desired shortcut and release to navigate — or just release over empty space to cancel.',
					link: { href: '/einstellungen#schnellzugriff', label: 'Set up shortcuts in Settings' },
					svg: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`
				}
			]
		},
		{
			section: 'Lists',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
			items: [
				{
					title: 'Lists',
					text: 'Tap a list to open it. Long-press a list name to edit it. Long-press the Lists tab at the bottom to enter sort mode.',
					svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
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
					title: 'Location detection',
					text: 'Enable "Location detection" in Settings, then set a location per list via long-press → Edit. When you open the app at a saved location (within 100 m), that list opens automatically. Works when coming back from background too. Your GPS location never leaves your device — only the address search query is sent to OpenStreetMap (one-time setup).',
					link: { href: '/einstellungen', label: 'Enable in Settings' },
					svg: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`
				},
				{
					title: 'List view',
					text: 'Instead of the default tile grid, items can be displayed as compact rows — with category icon, name, and quantity on a single line. Especially useful on small screens where tile names get cut off. Enable it in Settings → "List view".',
					link: { href: '/einstellungen', label: 'Enable in Settings' },
					svg: `<line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>`
				}
			]
		},
		{
			section: 'Items',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`,
			items: [
				{
					title: 'Items',
					text: 'Tap an item to check it off. Long-press to edit quantity, category, or delete it.',
					svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`
				},
				{
					title: 'Quick entry',
					text: 'Add multiple items at once by separating them with commas — e.g. "2x Milk, 500g Ground beef, Bread". Quantities at the start of each item are recognized automatically.',
					svg: `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="11" y2="9"/>`
				},
				{
					title: 'Long names',
					text: 'Swipe a long item name left or right to see the full name in a popup.',
					svg: `<polyline points="18 9 21 12 18 15"/><polyline points="6 9 3 12 6 15"/><line x1="3" y1="12" x2="21" y2="12"/>`
				},
				{
					title: 'Categories',
					text: 'Items are categorized automatically. Long-press an item to override its category manually. You can enable and reorder global category sorting in Settings. For per-list sorting, long-press a list name → Edit → "Category sorting".',
					link: { href: '/einstellungen#kategorien-sortieren', label: 'Category sorting in Settings' },
					svg: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`
				},
				{
					title: 'Favourites',
					text: 'Long-press an item, then tap the star next to the quantity field to save it as a favourite. Favourited items show a small green dot on their tile (can be turned off in Settings → Display). Tap + → Favourites to open your favourites panel — items are sorted by category — and quickly add them to the list. Long-press a favourite card to remove it.',
					link: { href: '/einstellungen', label: 'Toggle dot indicator in Settings' },
					svg: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
				}
			]
		},
		{
			section: 'Supplements',
			svg: `<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>`,
			items: [
				{
					title: 'Manage',
					text: 'Add supplements under "Manage" — enter name, unit (e.g. "capsule", "g"), and optional nutrients per unit (e.g. "Magnesium 200 mg"). Name and unit are required. Mark supplements as active or inactive — only active ones appear in the daily quick-log.',
					svg: `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`
				},
				{
					title: 'Today',
					text: 'The Today tab shows all supplements you\'ve logged today. Tap + (FAB) to open the quick-log and record your intake. Each supplement shows the total amount taken and the time of the last log entry. Long-press a log entry to edit or delete it.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'History',
					text: 'The History tab shows your supplement intake and total nutrient values for the selected period — by day, week, or month. Navigate between periods with the arrow buttons. Nutrients are sorted by total amount; if there are more than 10, tap "Show more" to expand the list.',
					svg: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`
				},
				{
					title: 'Reminders',
					text: 'Tap the bell icon next to a supplement in Manage to set up reminders. Choose the days of the week and a time — you\'ll receive a push notification at that time. Multiple supplements due at the same time are combined into one notification. Reminders are automatically deactivated when a supplement is set to inactive, and reactivated when it\'s set to active again.',
					svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
				}
			]
		},
		{
			section: 'Recipes',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Recipes',
					text: 'Browse your saved recipes and tap one to open it. Adjust the serving size — it saves automatically. Deselect ingredients you don\'t need, then tap the cart icon to add everything to a shopping list. Long-press the Recipes tab at the bottom to enter sort mode.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
				},
				{
					title: 'Meal Plan',
					text: 'Switch to the "Meal Plan" tab on the Recipes page to plan your meals for the week. Tap the date column on the left to add a meal — multiple meals per day are supported. Tap a meal to open the recipe or edit it in edit mode. Adjust serving counts with the stepper. Tap the cart icon to add a meal\'s ingredients to a shopping list, or use "Shop entire week" for all planned meals at once.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
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
					text: 'Groly ist von Grund auf für das Smartphone gebaut. Neue Items reihen sich unten an – die Liste wächst nach oben. Auch Navigation und Dialoge öffnen sich von unten.',
					svg: `<rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>`
				},
				{
					title: 'Offline',
					text: 'Die App funktioniert ohne Internet. Änderungen werden lokal gespeichert und automatisch synchronisiert.',
					svg: `<line x1="1" y1="1" x2="23" y2="23"/><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/><path d="M10.71 5.05A16 16 0 0 1 22.56 9"/><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>`
				},
				{
					title: 'Updates',
					text: 'Wenn eine neue Version verfügbar ist, erscheint ein Pfeil-Icon in der oberen Leiste. Antippen öffnet einen Dialog zum Neu laden – die App muss nicht manuell geschlossen werden.',
					svg: `<circle cx="12" cy="12" r="10"/><polyline points="16 12 12 8 8 12"/><line x1="12" y1="16" x2="12" y2="8"/>`
				},
				{
					title: 'Schnellzugriff',
					text: 'Lange auf den + Button drücken, um bis zu 4 Schnellzugriffe anzuzeigen. Finger zum gewünschten Shortcut schieben und loslassen – oder auf einer leeren Stelle loslassen, um abzubrechen.',
					link: { href: '/einstellungen#schnellzugriff', label: 'Schnellzugriffe in den Einstellungen anlegen' },
					svg: `<circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>`
				}
			]
		},
		{
			section: 'Listen',
			svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`,
			items: [
				{
					title: 'Listen',
					text: 'Tippe auf eine Liste, um sie zu öffnen. Langer Druck auf einen Listennamen öffnet den Bearbeiten-Dialog. Langer Druck auf den Listen-Tab unten aktiviert den Sortiermodus.',
					svg: `<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>`
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
					title: 'Standorterkennung',
					text: '„Standorterkennung" in den Einstellungen aktivieren, dann pro Liste per langem Druck → Bearbeiten einen Standort festlegen. Wenn du die App an einem gespeicherten Ort öffnest (innerhalb von 100 m), wird diese Liste automatisch geöffnet – auch wenn die App im Hintergrund lief. Dein GPS-Standort verlässt nie dein Gerät. Nur der Suchbegriff bei der Adresssuche wird einmalig an OpenStreetMap gesendet.',
					link: { href: '/einstellungen', label: 'In den Einstellungen aktivieren' },
					svg: `<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>`
				},
				{
					title: 'Listen-Ansicht',
					text: 'Statt der Standard-Kachelansicht können Items als kompakte Zeilen angezeigt werden – mit Kategorie-Icon, Name und Menge in einer Zeile. Besonders praktisch auf kleinen Bildschirmen. Aktivieren unter Einstellungen → „Listen-Ansicht".',
					link: { href: '/einstellungen', label: 'In den Einstellungen aktivieren' },
					svg: `<line x1="3" y1="7" x2="21" y2="7"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="17" x2="21" y2="17"/>`
				}
			]
		},
		{
			section: 'Items',
			svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`,
			items: [
				{
					title: 'Items',
					text: 'Kurzes Tippen hakt ein Item ab. Langes Drücken öffnet den Bearbeiten-Dialog mit Menge, Kategorie und Löschen.',
					svg: `<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><polyline points="3 6 4 7 6 5"/><polyline points="3 12 4 13 6 11"/><polyline points="3 18 4 19 6 17"/>`
				},
				{
					title: 'Schnelleingabe',
					text: 'Mehrere Artikel auf einmal eingeben: Komma-getrennt tippen, z.\u202fB. „2x Milch, 500g Hackfleisch, Brot". Mengenangaben am Anfang werden automatisch erkannt.',
					svg: `<path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/><line x1="9" y1="9" x2="11" y2="9"/>`
				},
				{
					title: 'Lange Namen',
					text: 'Wische bei langen Item-Namen nach links oder rechts, um den vollständigen Namen im Pop-Up anzuzeigen.',
					svg: `<polyline points="18 9 21 12 18 15"/><polyline points="6 9 3 12 6 15"/><line x1="3" y1="12" x2="21" y2="12"/>`
				},
				{
					title: 'Kategorien',
					text: 'Items werden automatisch kategorisiert. Langer Druck auf ein Item → Kategorie manuell überschreiben. Die globale Kategoriesortierung lässt sich in den Einstellungen aktivieren und umsortieren.',
					link: { href: '/einstellungen#kategorien-sortieren', label: 'Kategoriesortierung in den Einstellungen' },
					svg: `<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/>`
				},
				{
					title: 'Favoriten',
					text: 'Langes Drücken auf ein Item, dann den Stern neben dem Mengenfeld antippen, um es als Favorit zu speichern. Favorisierte Items zeigen einen kleinen grünen Punkt auf der Kachel (abschaltbar unter Einstellungen). Tippe + → Favoriten, um das Favoriten-Panel zu öffnen und Items schnell zur Liste hinzuzufügen.',
					link: { href: '/einstellungen', label: 'Punkt-Indikator in den Einstellungen umschalten' },
					svg: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
				}
			]
		},
		{
			section: 'Nahrungsergänzungsmittel',
			svg: `<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>`,
			items: [
				{
					title: 'Verwalten',
					text: 'Lege Supplements unter „Verwalten" an – mit Name, Einheit (z.\u202fB. „Kapsel", „g") und optionalen Nährwerten pro Einheit (z.\u202fB. „Magnesium 200\u202fmg"). Name und Einheit sind Pflichtfelder. Setze Supplements auf aktiv oder inaktiv – nur aktive erscheinen im täglichen Quick-Log.',
					svg: `<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>`
				},
				{
					title: 'Heute',
					text: 'Der Heute-Tab zeigt alle Supplements, die du heute bereits geloggt hast. Tippe auf + (FAB), um den Quick-Log zu öffnen und deine Einnahme einzutragen. Jedes Supplement zeigt die Gesamtmenge und die Uhrzeit der letzten Einnahme. Langer Druck auf einen Eintrag ermöglicht Bearbeiten oder Löschen.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'Verlauf',
					text: 'Der Verlauf-Tab zeigt deine Supplementeinnahme und die gesamten Nährwerte für den gewählten Zeitraum – nach Tag, Woche oder Monat. Mit den Pfeiltasten navigierst du zwischen den Zeiträumen. Nährstoffe sind nach Gesamtmenge sortiert; bei mehr als 10 lassen sich die restlichen per Tap einblenden.',
					svg: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`
				},
				{
					title: 'Erinnerungen',
					text: 'Tippe auf das Glocken-Icon neben einem Supplement unter „Verwalten", um Erinnerungen einzurichten. Wähle Wochentage und eine Uhrzeit – du erhältst dann eine Push-Benachrichtigung. Mehrere Supplements zur selben Uhrzeit werden in einer einzigen Nachricht zusammengefasst. Erinnerungen werden automatisch deaktiviert, wenn ein Supplement auf inaktiv gesetzt wird, und reaktiviert, wenn es wieder aktiviert wird.',
					svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
				}
			]
		},
		{
			section: 'Rezepte',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Rezepte',
					text: 'Tippe auf ein Rezept, um es zu öffnen. Passe die Portionenzahl an – sie wird automatisch gespeichert. Hake Zutaten ab, die du nicht brauchst, und tippe dann auf das Einkaufswagen-Icon, um alles in eine Liste zu übertragen. Langer Druck auf den Rezepte-Tab unten aktiviert den Sortiermodus.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
				},
				{
					title: 'Wochenplan',
					text: 'Wechsle auf den Tab „Wochenplan" auf der Rezepte-Seite, um deine Mahlzeiten für die Woche zu planen. Tippe auf die Datumsspalte links, um eine Mahlzeit hinzuzufügen – pro Tag sind mehrere Mahlzeiten möglich. Tippe auf eine Mahlzeit, um das Rezept zu öffnen oder es im Bearbeitungsmodus zu ändern. Mit dem Stepper passt du die Portionenzahl an. Tippe das Warenkorb-Icon, um die Zutaten in eine Einkaufsliste zu übertragen, oder nutze „Ganze Woche einkaufen".',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				}
			]
		}
	]);

	let openSections = $state(new Set<number>());

	function toggleSection(i: number) {
		const next = new Set(openSections);
		if (next.has(i)) next.delete(i); else next.add(i);
		openSections = next;
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
			{lang === 'en' ? 'How to use' : 'Bedienung'}
		</h2>
		<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">
			{lang === 'en' ? 'Tap a section to expand it' : 'Abschnitt antippen zum Aufklappen'}
		</p>
	</div>

	<!-- Sections -->
	<div class="px-4 overflow-y-auto" style="max-height: 65vh">
		{#each sections as sec, i (i)}
			<!-- Section header (always visible) -->
			<button
				onclick={() => toggleSection(i)}
				class="w-full flex items-center gap-3 px-3 py-3 rounded-xl active:opacity-70 transition-opacity"
				class:mb-1={openSections.has(i)}
				style="background-color: var(--color-surface-container)"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-primary)" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
					{@html sec.svg}
				</svg>
				<span class="flex-1 text-left text-sm font-medium" style="color: var(--color-on-surface)">{sec.section}</span>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-on-surface-variant)" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round"
				     style="transition: transform 0.2s; transform: rotate({openSections.has(i) ? 90 : 0}deg)">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>

			<!-- Section items (expanded) -->
			{#if openSections.has(i)}
				<div class="mb-2 space-y-1 pl-2">
					{#each sec.items as item}
						<div class="flex items-start gap-3 px-3 py-3 rounded-xl"
						     style="background-color: color-mix(in srgb, var(--color-surface-container) 50%, transparent)">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
							     stroke="var(--color-primary)" stroke-width="2"
							     stroke-linecap="round" stroke-linejoin="round" class="shrink-0 mt-0.5">
								{@html item.svg}
							</svg>
							<div class="flex-1 min-w-0">
								<div class="text-sm font-semibold leading-tight mb-0.5"
								     style="color: var(--color-on-surface)">{item.title}</div>
								<div class="text-xs leading-relaxed"
								     style="color: var(--color-on-surface-variant)">{item.text}</div>
								{#if item.link}
									<a href={item.link.href} onclick={onClose}
									   class="text-xs font-medium mt-1 inline-block"
									   style="color: var(--color-primary)">{item.link.label}</a>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}

			{#if i < sections.length - 1}
				<div class="h-1.5"></div>
			{/if}
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
