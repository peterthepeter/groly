// Neuesten Eintrag immer oben einfügen.
// Diese Änderungen werden im Update-Popup angezeigt.
export const CHANGELOG: { version: string; de: string[]; en: string[] }[] = [
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
