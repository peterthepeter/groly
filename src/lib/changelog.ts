// Neuesten Eintrag immer oben einfügen.
// Diese Änderungen werden im Update-Popup angezeigt.
export const CHANGELOG: { version: string; de: string[]; en: string[] }[] = [
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
