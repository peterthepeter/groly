// Neuesten Eintrag immer oben einfügen.
// Diese Änderungen werden im Update-Popup angezeigt.
export const CHANGELOG: { version: string; de: string[]; en: string[] }[] = [
	{
		version: '0.5.7',
		de: [
			'Einkaufsliste: Automatische Synchronisation beim Zurückkehren aus dem Hintergrund',
			'Erledigtliste: Suche durchsucht jetzt auch erledigte Items',
			'Erledigtliste: Gleiche Produkte werden zusammengefasst',
			'Rezept-Ansicht: Portionen ändern skaliert die Zutaten jetzt dauerhaft korrekt',
			'Rezept-Ansicht: Navigationsleiste unten jetzt auch in der Rezept-Detailansicht sichtbar',
			'Push-Benachrichtigungen: Jedes Gerät hat jetzt eine eigene Verbindung — alle Geräte werden benachrichtigt, ohne dass ein Gerät dieselbe Nachricht mehrfach erhält',
			'Verschiedene Kleinigkeiten und Fehlerbehebungen',
		],
		en: [
			'Shopping list: automatically refreshes when you return from background',
			'Done list: search now also finds checked-off items',
			'Done list: duplicate products are now grouped',
			'Recipe view: changing servings now correctly scales and saves ingredients permanently',
			'Recipe view: bottom navigation bar now visible on the recipe detail page',
			'Push notifications: each device now has its own subscription — all devices receive notifications without duplicates on any single device',
			'Various minor improvements and fixes',
		],
	},
	{
		version: '0.5.6',
		de: ['Technische Verbesserungen und Fehlerbehebungen'],
		en: ['Technical bugfix'],
	},
	{
		version: '0.5.5',
		de: [
			'Push-Benachrichtigungen: Erinnerungen kommen jetzt zuverlässig zur richtigen Uhrzeit',
			'Wenn Push-Benachrichtigungen nicht funktionieren, erscheint jetzt ein hilfreicher Hinweis',
		],
		en: [
			'Push notifications: reminders now arrive reliably at the correct time',
			'If push notifications stop working, a helpful message now guides you to fix it',
		],
	},
	{
		version: '0.5.3',
		de: [
			'Supplement-Katalog: Admin-Bereich mit Katalog-Verwaltung (Nährstoffe, Einheit, Packungsgröße)',
			'Supplement-Katalog: Produktseite einfügen → Felder werden automatisch ausgefüllt',
			'Neues Supplement erstellen: Katalog-Suche mit Nährstoffübernahme',
		],
		en: [
			'Supplement catalog: admin section to manage catalog entries (nutrients, unit, package size)',
			'Supplement catalog: paste a product page URL to auto-fill catalog fields',
			'New supplement: search the catalog and import nutrients automatically',
		],
	},
	{
		version: '0.5.2',
		de: [
			'Mehrere Rezepte pro Tag im Wochenplan möglich',
			'Supplements: voreingestellte Einheiten pro Supplement wählbar',
			'Nochmal auf den Supplements- oder Rezepte-Button in der Navigation tippen wechselt zwischen den Tabs (Today/History bzw. Rezepte/Wochenplan)',
			'Neuer „Über Groly"-Eintrag im Menü mit Version, GitHub-Links und Feedback-Möglichkeit',
		],
		en: [
			'Multiple recipes per day in the meal planner',
			'Supplements: set a default unit per supplement',
			'Tap the active Supplements or Recipes button in the navigation bar again to toggle between tabs (Today/History or Recipes/Meal Plan)',
			'New "About" entry in the menu showing version, GitHub link, bug reports and feedback',
		],
	},
	{
		version: '0.5.1',
		de: [
			'Supplement-Erinnerungen: pünktlichere Zustellung, offene Alarme im Badge, vergangene durchgestrichen',
			'Push-Nachricht: Supplement-Name als Titel statt abgeschnittener langer Text',
			'Schnell-Log: Schließen- und Verwalten-Button unten',
			'Android: bessere Tastatur-Erkennung bei aktivem Passwortmanager',
		],
		en: [
			'Supplement reminders: more punctual delivery, pending count in badge, past reminders struck through',
			'Push notification: supplement name as title instead of truncated long text',
			'Quick log: close and manage buttons at the bottom',
			'Android: improved keyboard detection when a password manager toolbar is active',
		]
	},
	{
		version: '0.5.0',
		de: [
			'Supplement Tracker: Nahrungsergänzungsmittel erfassen, Nährstoffe aufsummieren, Lagerbestand tracken',
			'Verlauf: Tages-, Wochen- und Monatsansicht mit vollständiger Nährstoffaufschlüsselung',
			'Push-Erinnerungen: einstellbare Uhrzeiten pro Supplement',
			'Einstellungen: Supplements und Rezepte können jetzt pro Nutzer deaktiviert werden',
			'Navigation: überarbeitete untere Navigationsleiste mit klarerem aktivem Zustand',
			'Diverse Bugfixes',
		],
		en: [
			'Supplement Tracker: log supplements, auto-sum nutrients, track stock levels',
			'History: daily, weekly, and monthly view with full nutrient breakdown',
			'Push reminders: configurable daily reminders per supplement',
			'Settings: Supplements and Recipes can now be disabled per user',
			'Navigation: redesigned bottom navigation with clearer active state',
			'Various bug fixes',
		]
	},
	{
		version: '0.4.6',
		de: [
			'Eingabebereich: Favoriten- und Barcode-Button als kompakte Icon-Buttons – eine Zeile gespart',
			'Eingabefelder getauscht: Menge oben, Artikelname unten',
			'Favoriten-Panel: Items, die bereits unabgehakt in der Liste sind, zeigen einen grünen Punkt',
			'Changelog: Link zu GitHub Issues direkt im Changelog-Dialog',
			'Neue Liste: Standort kann jetzt auch beim Erstellen direkt gesetzt werden',
			'Toggle "Nach Erstellen teilen" optisch an den App-Standard angepasst',
		],
		en: [
			'Add item bar: favourites and barcode buttons are now compact icon buttons – one row saved',
			'Input fields swapped: quantity on top, item name below',
			'Favourites panel: items already in the list (unchecked) show a green dot on their tile',
			'Changelog: link to GitHub Issues added directly in the changelog dialog',
			'New list: location can now be set when creating a list, not just when editing',
			'Toggle "Share after creating" now matches the app\'s standard toggle style',
		]
	},
	{
		version: '0.4.5',
		de: [
			'Favoriten: Häufig gekaufte Items per langem Druck → Stern als Favorit speichern',
			'Favoriten-Panel über + → Favoriten öffnen und Items schnell zur Liste hinzufügen',
			'Favorisierte Items erkennt man am grünen Punkt auf der Kachel',
		],
		en: [
			'Favourites: long-press an item → tap the star to save it as a favourite',
			'Open the favourites panel via + → Favourites to quickly re-add items to your list',
			'Favourited items are marked with a small green dot on their tile',
		]
	},
	{
		version: '0.4.2',
		de: [
			'Wochenplan: Scroll-Fehler auf kleinen Bildschirmen und iOS behoben',
			'Pinch-to-Zoom in allen Browsern (inkl. Firefox iOS) deaktiviert',
		],
		en: [
			'Meal plan: fixed scrolling on small screens and iOS',
			'Pinch-to-zoom disabled across all browsers (including Firefox iOS)',
		]
	},
	{
		version: '0.4.1',
		de: [
			'Wochenplan: Scroll-Problem auf kleinen Bildschirmen behoben',
			'„Ganze Woche einkaufen"-Button in den Header verschoben (zwischen Pfeil und Edit)',
		],
		en: [
			'Meal plan: fixed scrolling on small screens',
			'"Shop entire week" button moved to the header (between arrow and edit)',
		]
	},
	{
		version: '0.4.0',
		de: [
			'Wochenplaner: Mahlzeiten für die ganze Woche planen',
			'Rezepte oder freien Text pro Tag eintragen, Portionen anpassen',
			'Zutaten einzelner Tage oder der ganzen Woche direkt zur Einkaufsliste hinzufügen',
			'Wochenplaner als Schnellzugriff konfigurierbar',
		],
		en: [
			'Weekly meal planner: plan your meals for the entire week',
			'Assign recipes or free text per day, adjust servings',
			'Add ingredients from individual days or the whole week directly to a shopping list',
			'Meal planner available as a quick access shortcut',
		]
	},
	{
		version: '0.3.5',
		de: [
			'Einstellungen: Übersichtlichere Gruppierung in Darstellung, Benachrichtigungen & Standort und Konto',
			'Neuer Toggle: Alle erledigten Items anzeigen (statt nur die letzten 16)',
			'Admin: Benutzerverwaltung kompakter und übersichtlicher',
		],
		en: [
			'Settings: cleaner grouping into Display, Notifications & Location, and Account sections',
			'New toggle: show all checked items instead of just the last 16',
			'Admin: user management UI more compact and easier to read',
		]
	},
	{
		version: '0.3.4',
		de: [
			'Zuletzt abgehakte Items: Anzeige von 16 statt 6 Einträgen',
		],
		en: [
			'Recently checked items: now shows 16 instead of 6 entries',
		]
	},
	{
		version: '0.3.3',
		de: [
			'Sicherheit: Rezeptimport prüft nun die tatsächliche IP hinter einem Hostnamen (DNS-Rebinding-Schutz)',
			'Sicherheit: Login-Rate-Limiting funktioniert jetzt korrekt hinter Reverse Proxies (Caddy, Nginx, Traefik)',
		],
		en: [
			'Security: recipe import now resolves and validates the actual IP behind a hostname (DNS rebinding protection)',
			'Security: login rate limiting now works correctly behind reverse proxies (Caddy, Nginx, Traefik)',
		]
	},
	{
		version: '0.3.2',
		de: [
			'Sicherheit: Ausstehende Einladungen erhalten keinen Schreibzugriff mehr auf Items und Benachrichtigungseinstellungen',
			'Sicherheit: Doppelte Einladungen lösen keine erneute Push-Benachrichtigung mehr aus',
			'Sicherheit: Admin-Passwortreset erzwingt jetzt eine Passwortänderung beim nächsten Login',
			'Fixes: Tipp-Effekt bleibt nicht mehr hängen wenn der Finger die Schaltfläche verlässt',
			'Fixes: Veraltete Daten können parallele Ladevorgänge nicht mehr überschreiben',
		],
		en: [
			'Security: pending invitations no longer grant write access to items or notification settings',
			'Security: duplicate invitations no longer trigger a repeated push notification',
			'Security: admin password reset now forces a password change on next login',
			'Fix: press effect no longer gets stuck when the pointer leaves a button',
			'Fix: stale data can no longer overwrite results from a newer load',
		]
	},
	{
		version: '0.3.1',
		de: [
			'Neue Listen-Ansicht: Items als kompakte Zeilen statt Kacheln – besonders praktisch auf kleinen Bildschirmen',
			'Aktivierbar unter Einstellungen → „Listen-Ansicht"',
			'Geräte mit kleinem Bildschirm (< 374\u202fpx) erhalten beim ersten Öffnen einer Liste einen Hinweis',
			'Einstellungen: Push-Benachrichtigungen und Listen-Ansicht jetzt aufklappbar',
		],
		en: [
			'New list view: items as compact rows instead of tiles — especially handy on small screens',
			'Enable it in Settings → "List view"',
			'Devices with a small screen (< 374\u202fpx) get a one-time hint when opening a list',
			'Settings: push notifications and list view sections are now collapsible',
		]
	},
	{
		version: '0.3.0',
		de: [
			'Standorterkennung: Liste öffnet sich automatisch, wenn du einen gespeicherten Supermarkt erreichst',
			'Standort pro Liste in den Listen-Einstellungen hinterlegbar – per Adresssuche oder aktuellem GPS-Standort',
			'Global in den Einstellungen aktivierbar, pro Liste einzeln deaktivierbar',
			'Funktioniert beim App-Start und beim Zurückwechseln aus dem Hintergrund',
			'Datenschutz: GPS-Standort verlässt nie das Gerät',
		],
		en: [
			'Location detection: a list opens automatically when you arrive at a saved store location',
			'Set a location per list in the list settings — via address search or current GPS position',
			'Enable globally in Settings, disable per list individually',
			'Works on app launch and when returning from background',
			'Privacy: your GPS location never leaves your device',
		]
	},
	{
		version: '0.2.9',
		de: [
			'Schnelleingabe: Mehrere Artikel auf einmal tippen, kommagetrennt – z.\u202fB. „2x Milch, 500g Hackfleisch, Brot"',
			'Mengenangaben am Anfang werden automatisch erkannt und dem Artikel zugeordnet',
			'Vorschau der erkannten Artikel direkt im Eingabefeld',
		],
		en: [
			'Quick entry: type multiple items at once, comma-separated — e.g. "2x Milk, 500g Ground beef, Bread"',
			'Quantities at the start of each item are recognized and assigned automatically',
			'Live preview of parsed items shown directly in the input',
		]
	},
	{
		version: '0.2.8',
		de: [
			'Rezepte: Abgewählte Zutaten werden gespeichert und beim nächsten Öffnen wiederhergestellt',
			'Praktisch für Gewürze & Co., die man immer vorrätig hat',
		],
		en: [
			'Recipes: deselected ingredients are saved and restored when you open the recipe again',
			'Handy for spices and staples you always have at home',
		]
	},
	{
		version: '0.2.7',
		de: [
			'Schnellzugriff: + Button lang drücken für bis zu 4 Shortcuts zu Listen oder dem Scanner',
			'Schnellzugriff in Einstellungen konfigurierbar (Name, Liste, Aktion)',
			'Bedienungshinweis für Schnellzugriff in der Hilfe ergänzt',
		],
		en: [
			'Quick access: long-press the + button for up to 4 shortcuts to lists or the scanner',
			'Quick access shortcuts configurable in Settings (name, list, action)',
			'Usage hint for quick access added to the help section',
		]
	},
	{
		version: '0.2.6',
		de: [
			'Barcode-Scanner: Offline-Status wird dauerhaft im Scanner-Fenster angezeigt',
			'Offline: Kein irreführendes „Produkt nicht gefunden" mehr bei fehlendem Internet',
		],
		en: [
			'Barcode scanner: offline status is now permanently shown in the scanner overlay',
			'Offline: no more misleading "product not found" when there is no internet connection',
		]
	},
	{
		version: '0.2.5',
		de: [
			'Barcode-Scan: Items per Kamera-Scan zur Einkaufsliste hinzufügen',
			'Push-Benachrichtigung bei neuen App-Versionen',
			'Bedienungshinweis: Lange Item-Namen per Swipe als Pop-Up anzeigen',
		],
		en: [
			'Barcode scan: add items to your shopping list by scanning barcodes',
			'Push notification when a new app version is available',
			'Usage hint: swipe long item names to show the full name in a popup',
		]
	},
	{
		version: '0.2.1',
		de: [
			'Changelog im Hamburger-Menü unter „Was ist neu" einsehbar',
			'Update-Popup zeigt Patch Notes jetzt nach dem Neustart statt davor',
		],
		en: [
			'Changelog now accessible in the hamburger menu under "What\'s new"',
			'Update popup now shows patch notes after restart instead of before',
		]
	},
	{
		version: '0.2.0',
		de: [
			'Kategorie-Sortierung kann jetzt pro Einkaufsliste individuell eingestellt werden',
			'Update-Popup zeigt jetzt an, was sich in der neuen Version geändert hat',
		],
		en: [
			'Category sorting can now be configured individually per shopping list',
			'Update popup now shows what changed in the new version',
		]
	},
];

export const LATEST_CHANGES = CHANGELOG[0];
