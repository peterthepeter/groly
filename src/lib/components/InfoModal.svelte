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
				},
				{
					title: 'Keep screen on',
					text: 'The screen stays on automatically when you are inside a shopping list, an opened recipe, or a running meditation — so you don\'t have to wake it with sticky fingers while cooking or shopping. Toggle each context individually in Settings → "Keep screen on".',
					link: { href: '/einstellungen', label: 'Manage in Settings' },
					svg: `<rect x="2" y="4" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/>`
				},
				{
					title: 'Support',
					text: 'Groly is free and built in my spare time. If you want to say thanks, you can buy me a coffee via the "Buy me a coffee" button in the About dialog (menu → About). Completely voluntary, nothing is expected in return.',
					svg: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`
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
					text: 'Items are recognized automatically in German and English. Common fruit and vegetables receive a matching item icon — for example apple, banana, pear, orange, lemon, strawberry, grapes, carrot, tomato, bell pepper, potato, cucumber, onion, broccoli, or mushroom. Other fruit, vegetables, and herbs use the neutral leaf. Alcohol is also distinguished as wine, beer, sparkling wine, spirits, or a neutral alcohol symbol. Clear product names can additionally receive packaging icons for dairy cups, drink cartons, sauces, oils, snack bags, cereal, detergent, tubes, or paper goods. Sorting and colour still follow the regular category; flavour and ingredient words do not override a clear product type. Ambiguous or unknown names keep the familiar category icon. Long-press an item to choose a category — including “Everything else” — or switch back to Automatic. When you deliberately choose a category, Groly privately remembers it for your account and exactly that item name; future items with the same name use it automatically. Choosing Automatic forgets that preference. Editing only the name or quantity does not teach anything. The specific icon remains automatic. You can enable and reorder global category sorting in Settings. For per-list sorting, long-press a list name → Edit → "Category sorting". Offline sorting changes are kept on this device and synchronized automatically after reconnecting or reopening the app.',
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
					text: 'The Today tab groups logged trackers in two-column tiles and supplements in three-column tiles; both groups grow from the bottom upward. When the content is taller than the screen, Today opens at its lower edge. Tap a supplement tile to expand it to the full width and long-press it to edit the newest entry. Tap + (FAB) to open the quick-log. In the Supplements tab, tap a tile to log its displayed amount and time. Tap the amount to open the compact −/+ control, then tap the amount with the check mark to finish. Tap the time to change it; long-press a tile to add a note. In both Today and the quick-log, caffeine and hydration use a centered + Log action while meditation uses Start. The selected tracker becomes the only visible tracker tile, moves to the bottom of its tracker group and expands to full width with its drinks, presets or custom value inside the card. Supplements stay in place; use the chevron to return to the previous tracker grid. Use Manage in the quick-log header to configure trackers and supplements. On Today, compact supplement tiles show the total amount and latest time; expanded tiles show all entries and let you edit or delete them individually.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'History',
					text: 'The History tab shows your supplement intake and total nutrient values for the selected period — by day, week, or month. Navigate between periods with the arrow buttons. Nutrients are sorted by total amount; if there are more than 10, tap "Show more" to expand the list.',
					svg: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`
				},
				{
					title: 'Reminders',
					text: 'Tap the bell icon next to a supplement in Manage to set up reminders. Choose the days of the week and a time — you\'ll receive a push notification at that time. Multiple supplements due at the same time are combined into one notification. Reminders are automatically deactivated when a supplement is set to inactive, and reactivated when it\'s set to active again. Use the "Week plan" toggle at the top of the supplement list to see all reminders across the whole week at a glance, with today highlighted — tap any entry to jump straight to that supplement\'s reminders.',
					svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
				},
				{
					title: 'Water Tracker',
					text: 'Enable the Water Tracker under Manage → Water Tracker toggle. Tap + Log on its compact card, then choose a preset or Custom in the expanded focus card. A progress bar shows how close you are to your daily goal (default: 2000 ml). Tap the chevron to expand and delete individual entries. When enabled, the Water Tracker also appears in the quick-log. Edit your daily goal via the pencil icon on the Manage page.',
					svg: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`
				},
				{
					title: 'Meditation Timer',
					text: 'Enable the Meditation tracker under Manage. Tap Start on its compact card, then choose 5/10/15/20 min or Custom in the expanded focus card. Custom opens a duration wheel for 5–120 minutes in 5-minute steps — it selects a length, not a clock time. After an optional preparation phase (default 20 s) the main timer begins with a starting sound. The screen stays black with a Zen circle that gradually empties as time runs out. Tap the screen to end early — your elapsed time is saved. An ending sound plays when the timer completes. Choose start/end sounds and daily goal under Manage. Set a daily reminder via the bell icon.',
					svg: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>`
				},
				{
					title: 'Mood Journal',
					text: 'Enable the Mood Journal under Manage. Each day, rate how you felt on a 5-point scale — from Very bad to Great. Add activity tags (Sport, Hobbies, Emotions, Social, Health, Work, Weather), a gratitude journal entry (what am I grateful for today?), and an optional free-text note. The compact Today tile previews up to two activities and one line from gratitude or notes; expand it to see everything. In the History tab, the Mood section shows a weekly view (7 circles) and a monthly calendar — tap any day to see details (including gratitude entries) or add a missing entry for a past day. Tags you never use can be hidden via the gear icon in the entry sheet. The gratitude journal can be included in the PDF export via the optional "Mood — gratitude journal" section.',
					svg: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`
				},
				{
					title: 'Nutrition Tracker',
					text: 'Track meals and calories for the day. Tap the orange Nutrition card on the Tracker tab to open the detail view. Add a meal with the + button — name, time and ingredients. Add ingredients by scanning a barcode (Open Food Facts), searching for branded products or basic foods (apple, potato, rice, …), or by entering your own value. Save items you eat often as favourites — they appear at the top of the picker. You can also save a whole meal (e.g. your usual breakfast) as a meal favorite: in the new-meal sheet tap the star next to "Ingredients", or build one from scratch on the Favorites page. When logging, tap "From favorite" to add all of its ingredients at once — adjust the amounts before saving. Picking a meal favorite appends its ingredients, so you can combine several. When saving a template you can add your own photo (like recipes) and a name — the photo and name then show on the meal favorite, in the picker, and on the logged meal in the day view. Set an optional daily calorie goal (with built-in calculator based on Mifflin-St Jeor) under the "Goal" button. The daily card shows total kcal, optional bar against the goal, and the macronutrients (protein, fat, carbs). Enable or disable the Nutrition Tracker under Manage via its toggle — the daily goal can also be edited there via the pencil icon. You can also track meals straight from a recipe: open a recipe and tap "+ Nutrition" to match each ingredient to a food once (scan, search, or enter your own values; spices can be skipped) — the recipe then shows calories per serving in the meta line. Tap "Track" and choose how many servings you ate to log it as a meal. If you later change the recipe\'s ingredients, a hint reminds you the nutrition may be outdated.',
					svg: `<path d="M3 3h18l-2 7H5L3 3z"/><path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/><circle cx="12" cy="15" r="2"/>`
				}
			]
		},
		{
			section: 'Recipes',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Adding a recipe',
					text: 'Tap the + button on the Recipes page to create a recipe — add a photo, name, servings and times. For ingredients you don\'t have to keep pressing "+ Ingredient": press Enter after a row to jump to the next one, and a fresh empty row always grows in as you type. To enter a whole list at once, tap "Paste" and drop in one ingredient per line (e.g. "100 g flour", "3 eggs", "1 pinch of salt") — Groly splits each line into amount, unit and name automatically. Pasting a multi-line list straight into an ingredient field works too. Everything stays editable afterwards.',
					svg: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`
				},
				{
					title: 'Recipes',
					text: 'Browse your saved recipes and tap one to open it. Adjust the serving size — it saves automatically. Deselect ingredients you don\'t need, then tap the cart icon to add everything to a shopping list. Long-press the Recipes tab at the bottom to enter sort mode.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
				},
				{
					title: 'Meal Plan',
					text: 'Switch to the "Meal Plan" tab on the Recipes page to plan your meals for the week. Tap the date column on the left to add a meal — multiple meals per day are supported. Tap a meal to open the recipe or edit it in edit mode. Adjust serving counts with the stepper. Tap the cart icon to add a meal\'s ingredients to a shopping list, or use "Shop entire week" for all planned meals at once.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'Favorites, rating & tags',
					text: 'Tap the star icon on a recipe card to mark it as a favorite. In the recipe view you can rate it from 1 to 5 stars and add tags (e.g. Pasta, Vegan, Quick) — tags appear as filter chips at the top of the recipe list. The sort dropdown lets you sort by last updated, last cooked, most cooked, rating, title A–Z, or your custom drag order.',
					svg: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
				},
				{
					title: 'Cooking history',
					text: 'Tap "Cooked today" in the recipe view to log that you made it — the counter and last-cooked date update immediately. The small back-arrow next to the counter undoes the last entry if you tapped by accident. Sort recipes by "Most cooked" or "Last cooked" to quickly find your go-to dishes.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
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
				},
				{
					title: 'Bildschirm anlassen',
					text: 'Der Bildschirm bleibt automatisch an, solange du in einer Einkaufsliste, einem geöffneten Rezept oder einer laufenden Meditation bist – so musst du das Handy beim Kochen oder Einkaufen nicht jedes Mal mit klebrigen Fingern wieder entsperren. Jeden Bereich einzeln umschaltbar unter Einstellungen → „Bildschirm anlassen".',
					link: { href: '/einstellungen', label: 'In den Einstellungen verwalten' },
					svg: `<rect x="2" y="4" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/>`
				},
				{
					title: 'Unterstützen',
					text: 'Groly ist kostenlos und entsteht in meiner Freizeit. Wenn du Danke sagen möchtest, kannst du mir über den „Kaffee ausgeben“-Knopf im Über-Dialog (Menü → Über) einen Kaffee ausgeben. Völlig freiwillig, ganz ohne Gegenleistung.',
					svg: `<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>`
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
					text: 'Items werden automatisch auf Deutsch und Englisch erkannt. Gängige Obst- und Gemüsesorten erhalten ein passendes Artikelsymbol – etwa Apfel, Banane, Birne, Orange, Zitrone, Erdbeere, Trauben, Karotte, Tomate, Paprika, Kartoffel, Gurke, Zwiebel, Brokkoli oder Pilz. Für anderes Obst, Gemüse und Kräuter bleibt das neutrale Blattsymbol. Alkohol wird zusätzlich als Wein, Bier, Sekt, Spirituose oder mit einem neutralen Alkoholsymbol unterschieden. Eindeutige Produktnamen können außerdem Verpackungssymbole für Milchprodukt-Becher, Getränkekartons, Saucen, Öle, Snacktüten, Müsli, Waschmittel, Tuben oder Papierwaren erhalten. Sortierung und Farbe richten sich weiterhin nach der normalen Kategorie; Geschmacks- und Zutatenwörter überschreiben keine eindeutige Produktart. Unsichere oder unbekannte Namen behalten das bewährte Kategorie-Icon. Mit langem Druck lässt sich eine Kategorie einschließlich „Alles andere“ auswählen oder wieder auf „Automatisch“ stellen. Sobald du bewusst eine Kategorie auswählst, merkt Groly sie sich privat für dein Konto und exakt diesen Artikelnamen; neue Items mit demselben Namen übernehmen sie automatisch. „Automatisch“ löscht diese Präferenz wieder. Reine Namens- oder Mengenänderungen lernen nichts. Das spezifische Symbol bleibt automatisch. Die globale Kategoriesortierung lässt sich in den Einstellungen aktivieren und umsortieren. Für eine einzelne Liste: Listenname lange drücken → Bearbeiten → „Kategorien sortieren“. Offline geänderte Sortierungen bleiben auf diesem Gerät erhalten und werden nach dem Verbinden oder erneuten Öffnen automatisch synchronisiert.',
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
					text: 'Der Heute-Tab gruppiert geloggte Tracker in Kacheln mit zwei Spalten und Supplements in Kacheln mit drei Spalten; beide Gruppen wachsen von unten nach oben. Ist der Inhalt höher als der Bildschirm, öffnet Heute direkt am unteren Ende. Tippe eine Supplement-Kachel an, um sie auf die volle Breite aufzuklappen, und halte sie lange gedrückt, um den neuesten Eintrag zu bearbeiten. Tippe auf + (FAB), um den Quick-Log zu öffnen. Im Supplements-Tab trägt ein Tipp auf eine Kachel die angezeigte Menge und Uhrzeit ein. Tippe auf die Menge, um den kompakten −/+-Regler zu öffnen, und anschließend zum Beenden auf die Menge mit dem Haken. Tippe auf die Uhrzeit, um sie zu ändern; ein langer Druck auf die Kachel öffnet die Notiz. In Heute und im Quick-Log verwenden Koffein und Wasser mittig „+ Eintragen“, Meditation „Starten“. Die ausgewählte Karte wird als einziger Tracker angezeigt, rückt ans Ende ihrer Tracker-Gruppe und klappt auf volle Breite mit Getränken, Vorgaben oder individuellem Wert auf. Supplements bleiben erhalten; über den Pfeil kehrst du zum vorherigen Tracker-Raster zurück. Über „Verwalten“ im Quick-Log-Kopf konfigurierst du Tracker und Supplements. Kompakte Supplement-Kacheln zeigen auf Heute Gesamtmenge und letzte Uhrzeit; aufgeklappt erscheinen alle Einträge und lassen sich einzeln bearbeiten oder löschen.',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'Verlauf',
					text: 'Der Verlauf-Tab zeigt deine Supplementeinnahme und die gesamten Nährwerte für den gewählten Zeitraum – nach Tag, Woche oder Monat. Mit den Pfeiltasten navigierst du zwischen den Zeiträumen. Nährstoffe sind nach Gesamtmenge sortiert; bei mehr als 10 lassen sich die restlichen per Tap einblenden.',
					svg: `<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>`
				},
				{
					title: 'Erinnerungen',
					text: 'Tippe auf das Glocken-Icon neben einem Supplement unter „Verwalten", um Erinnerungen einzurichten. Wähle Wochentage und eine Uhrzeit – du erhältst dann eine Push-Benachrichtigung. Mehrere Supplements zur selben Uhrzeit werden in einer einzigen Nachricht zusammengefasst. Erinnerungen werden automatisch deaktiviert, wenn ein Supplement auf inaktiv gesetzt wird, und reaktiviert, wenn es wieder aktiviert wird. Über den Umschalter „Wochenplan" oben in der Supplement-Liste siehst du alle Erinnerungen der ganzen Woche auf einen Blick – der heutige Tag ist hervorgehoben. Tippe auf einen Eintrag, um direkt zu den Alarmen des Supplements zu springen.',
					svg: `<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>`
				},
				{
					title: 'Wassertracker',
					text: 'Aktiviere den Wassertracker unter Verwalten über den Toggle. Tippe auf „+ Eintragen" in der kompakten Karte und wähle anschließend in der aufgeklappten Fokuskarte eine Vorgabe oder „Individuell". Ein Fortschrittsbalken zeigt, wie nah du deinem Tagesziel bist (Standard: 2000 ml). Mit dem Chevron-Icon klappst du die Karte auf und kannst einzelne Einträge löschen. Wenn aktiviert, erscheint der Wassertracker auch im Quick-Log. Das Tagesziel lässt sich über das Stift-Icon unter Verwalten anpassen.',
					svg: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>`
				},
				{
					title: 'Meditationstimer',
					text: 'Aktiviere den Meditationstracker unter Verwalten. Tippe auf „Starten" in der kompakten Karte und wähle anschließend in der aufgeklappten Fokuskarte 5/10/15/20 Min. oder „Individuell". Bei „Individuell" stellst du über ein Dauerrad 5–120 Minuten in 5-Minuten-Schritten ein – keine Uhrzeit. Nach einer optionalen Vorbereitungsphase (Standard 20 s) beginnt der eigentliche Timer mit einem Start-Sound. Der Bildschirm bleibt schwarz mit einem Zen-Kreis, der sich nach und nach leert, je weniger Zeit übrig ist. Tippe auf den Bildschirm, um vorzeitig zu beenden – die abgesessene Zeit wird gespeichert. Am Ende ertönt ein End-Sound. Start-/End-Sound, Tagesziel und Vorbereitungszeit lassen sich unter Verwalten konfigurieren. Über das Glocken-Icon richtest du tägliche Erinnerungen ein.',
					svg: `<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>`
				},
				{
					title: 'Stimmungstagebuch',
					text: 'Aktiviere das Stimmungstagebuch unter Verwalten. Bewerte jeden Tag deine Stimmung auf einer 5-Stufen-Skala – von „Sehr schlecht" bis „Super". Füge Aktivitäts-Tags aus den Kategorien Sport, Hobbies, Emotionen, Soziales, Gesundheit, Arbeit und Wetter hinzu, einen Eintrag im Dankbarkeitsjournal („Wofür bin ich heute dankbar?") sowie eine optionale Freitext-Notiz. Die kompakte Heute-Kachel zeigt bis zu zwei Aktivitäten und eine Zeile aus Dankbarkeit oder Notiz; aufgeklappt erscheint alles vollständig. Im Verlauf-Tab zeigt der Stimmungsbereich eine Wochen- und Monatsansicht – tippe auf einen Tag, um Details (inkl. Dankbarkeitseintrag) zu sehen oder einen vergangenen Tag nachzutragen. Tags, die du nie nutzt, lassen sich über das Zahnrad-Icon im Eingabe-Sheet ausblenden. Das Dankbarkeitsjournal kann beim PDF-Export über den optionalen Abschnitt „Stimmung — Dankbarkeitsjournal" mit exportiert werden.',
					svg: `<circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>`
				},
				{
					title: 'Ernährung',
					text: 'Erfasse Mahlzeiten und Kalorien. Tippe die orangene Ernährungs-Karte auf dem Tracker-Tab an, um die Detailansicht zu öffnen. Über das +-Symbol legst du eine neue Mahlzeit an – mit Name, Uhrzeit und Zutaten. Zutaten lassen sich per Barcode scannen (Open Food Facts), nach Markenprodukten oder Grundlebensmitteln suchen (Apfel, Kartoffel, Reis, …) oder ganz eigene Werte eintragen. Häufig gegessenes als Favorit speichern – das spart Tipparbeit und Suche. Auch ganze Gerichte (z.B. dein übliches Frühstück) lassen sich als Gericht-Favorit speichern: im Neue-Mahlzeit-Sheet auf den Stern neben „Zutaten" tippen oder eines von Grund auf auf der Favoriten-Seite anlegen. Beim Eintragen tippst du auf „Aus Favorit" und übernimmst alle Zutaten auf einmal – die Mengen kannst du vorher anpassen. Ein Gericht-Favorit hängt seine Zutaten an, du kannst also mehrere kombinieren. Beim Speichern einer Vorlage kannst du ein eigenes Foto (wie bei Rezepten) und einen Namen vergeben — Foto und Name erscheinen dann am Gericht-Favorit, in der Auswahl und auf der getrackten Mahlzeit in der Tagesansicht. Setze optional ein Tagesziel für Kalorien (mit integriertem Mifflin-St-Jeor-Rechner) über den „Ziel"-Button. Die Tageskarte zeigt kcal-Summe, optionalen Balken zum Ziel und die Makronährstoffe Eiweiß/Fett/Kohlenhydrate. Den Ernährungs-Tracker kannst du unter Verwalten über den Toggle ein- und ausschalten — das Tagesziel lässt sich dort auch über das Stift-Icon anpassen. Mahlzeiten lassen sich auch direkt aus einem Rezept tracken: Öffne ein Rezept und tippe auf „+ Nährwerte", um jede Zutat einmal einem Lebensmittel zuzuordnen (scannen, suchen oder eigene Werte eintragen; Gewürze kannst du überspringen) — danach zeigt das Rezept die Kalorien pro Portion in der Info-Zeile. Über „Tracken" wählst du, wie viele Portionen du gegessen hast, und es wird als Mahlzeit ins Tagebuch übernommen. Änderst du später die Zutaten des Rezepts, weist ein Hinweis darauf hin, dass die Nährwerte evtl. veraltet sind.',
					svg: `<path d="M3 3h18l-2 7H5L3 3z"/><path d="M5 10v9a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-9"/><circle cx="12" cy="15" r="2"/>`
				}
			]
		},
		{
			section: 'Rezepte',
			svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`,
			items: [
				{
					title: 'Rezept anlegen',
					text: 'Tippe auf der Rezepte-Seite auf das +, um ein Rezept anzulegen – mit Foto, Name, Portionen und Zeiten. Bei den Zutaten musst du nicht jedes Mal auf „+ Zutat" tippen: Drücke nach einer Zeile einfach Enter, um in die nächste zu springen – eine leere Zeile wächst beim Tippen automatisch nach. Eine ganze Liste auf einmal fügst du über „Einfügen" ein: eine Zutat pro Zeile (z.B. „100 g Mehl", „3 Eier", „1 Prise Salz") – Groly zerlegt jede Zeile automatisch in Menge, Einheit und Name. Auch das direkte Einfügen einer mehrzeiligen Liste in ein Zutatenfeld funktioniert. Alles bleibt danach editierbar.',
					svg: `<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>`
				},
				{
					title: 'Rezepte',
					text: 'Tippe auf ein Rezept, um es zu öffnen. Passe die Portionenzahl an – sie wird automatisch gespeichert. Hake Zutaten ab, die du nicht brauchst, und tippe dann auf das Einkaufswagen-Icon, um alles in eine Liste zu übertragen. Langer Druck auf den Rezepte-Tab unten aktiviert den Sortiermodus.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
				},
				{
					title: 'Wochenplan',
					text: 'Wechsle auf den Tab „Wochenplan" auf der Rezepte-Seite, um deine Mahlzeiten für die Woche zu planen. Tippe auf die Datumsspalte links, um eine Mahlzeit hinzuzufügen – pro Tag sind mehrere Mahlzeiten möglich. Tippe auf eine Mahlzeit, um das Rezept zu öffnen oder es im Bearbeitungsmodus zu ändern. Mit dem Stepper passt du die Portionenzahl an. Tippe das Warenkorb-Icon, um die Zutaten in eine Einkaufsliste zu übertragen, oder nutze „Ganze Woche einkaufen".',
					svg: `<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>`
				},
				{
					title: 'Favoriten, Bewertung & Tags',
					text: 'Tippe auf den Stern an einer Rezeptkarte, um es als Favorit zu markieren. In der Rezept-Ansicht kannst du es mit 1–5 Sternen bewerten und Tags vergeben (z.B. Pasta, Vegan, Schnell) – die Tags erscheinen oben in der Liste als Filter-Chips. Im Sortier-Dropdown wählst du zwischen Zuletzt geändert, Zuletzt gekocht, Am häufigsten gekocht, Bewertung, Titel A–Z oder deiner eigenen Reihenfolge.',
					svg: `<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>`
				},
				{
					title: 'Kochhistorie',
					text: 'Tippe in der Rezept-Ansicht auf „Heute gekocht", um zu protokollieren, dass du es zubereitet hast – Zähler und letztes Kochdatum aktualisieren sich sofort. Der kleine Pfeil daneben macht den letzten Eintrag rückgängig, falls du dich vertippt hast. Sortiere nach „Am häufigsten gekocht" oder „Zuletzt gekocht", um deine Klassiker schnell zu finden.',
					svg: `<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>`
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
     style="background-color: var(--modal-bg)">

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
		<div class="rounded-2xl overflow-hidden divide-y divide-white/[0.08]" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			{#each sections as sec, i (i)}
				<div>
				<!-- Section header -->
				<button
					onclick={() => toggleSection(i)}
					class="w-full flex items-center gap-3 px-3 py-2.5 active:opacity-70 transition-opacity"
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
					<div>
						{#each sec.items as item}
							<div class="flex items-start gap-3 px-3 py-2">
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
				</div>
			{/each}
		</div>
	</div>

	<!-- Close button -->
	<div class="px-4 mt-4">
		<button
			onclick={onClose}
			class="w-full py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
		>
			{lang === 'en' ? 'Done' : 'Fertig'}
		</button>
	</div>
</div>
