<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { t, currentLang, nutrition_nutrients_per_100 } from '$lib/i18n.svelte';
	import { getNutritionCategoryIcon } from '$lib/nutritionCategoryIcons';
	import { nextNutritionUseCount, nutritionBasisSuffix, parseOptionalNutritionNumber } from '$lib/nutritionUtils';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import NutritionFoodRow from './NutritionFoodRow.svelte';
	import NutritionMacroStrip from './NutritionMacroStrip.svelte';

	type Component = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
	};

	type GenericResult = {
		type: 'generic';
		id: string;
		category: string;
		name: string;
		kcalPer100: number;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		defaultPieceWeight: number | null;
		defaultUnit: 'g' | 'ml' | 'piece';
	};
	type ProductResult = {
		type: 'product';
		barcode: string;
		name: string;
		brand: string | null;
		imageUrl: string | null;
		nutriscoreGrade: string | null;
		servingQuantity: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
	};

	type Favorite = {
		id: string;
		displayName: string;
		imageUrl: string | null;
		productBarcode: string | null;
		genericFoodId: string | null;
		category?: string | null;
		customKcalPer100: number | null;
		customProteinPer100: number | null;
		customFatPer100: number | null;
		customCarbsPer100: number | null;
		customSugarPer100: number | null;
		customFiberPer100: number | null;
		customSaltPer100: number | null;
		defaultAmount: number;
		defaultUnit: 'g' | 'ml' | 'piece';
		defaultGramsPerPiece: number | null;
		useCount?: number;
		lastUsedAt?: number | null;
	};

	type MealFavoriteComponent = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
	};
	type MealFavorite = {
		id: string;
		displayName: string;
		defaultMealName: string | null;
		imageUrl: string | null;
		caffeineDrinkId?: string | null;
		useCount?: number;
		lastUsedAt?: number | null;
		components: MealFavoriteComponent[];
	};

	let { initial = null, suggestedAmount = null, suggestedUnit = null, favoriteMode = false, onclose, onadd, onpickmeal }: {
		initial?: Component | null;
		// Beim Zuordnen einer Rezept-Zutat: Menge/Einheit aus dem Zutatentext vorbefüllen.
		suggestedAmount?: number | null;
		suggestedUnit?: 'g' | 'ml' | 'piece' | null;
		favoriteMode?: boolean;
		onclose: () => void;
		onadd: (c: Component) => void;
		onpickmeal?: (payload: { components: Component[]; defaultMealName: string | null; favoriteName: string; imageUrl: string | null; caffeineDrinkId: string | null }) => void;
	} = $props();

	// View: 'picker' (browse/search) | 'amount' (set amount for selected)
	// svelte-ignore state_referenced_locally
	let view = $state<'picker' | 'amount' | 'custom'>(initial ? 'amount' : 'picker');
	// svelte-ignore state_referenced_locally
	let selected = $state<Component | null>(initial ? { ...initial } : null);
	// Kategorie des ausgewählten generischen Lebensmittels (für das Vorschau-Icon).
	// Nur gesetzt, wenn die Auswahl ein generic ist – sonst greift der Buchstaben-Fallback.
	let selectedCategory = $state<string | null>(null);

	// Picker state
	let query = $state('');
	// Zweistufige Suche: lokal (Generics + Cache) schnell, OFF (Online) langsam + abbrechbar.
	let localTimer: ReturnType<typeof setTimeout> | null = null;
	let offTimer: ReturnType<typeof setTimeout> | null = null;
	let localAbort: AbortController | null = null;
	let offAbort: AbortController | null = null;
	let searching = $state(false);
	let genericResults = $state<GenericResult[]>([]);
	let localProducts = $state<ProductResult[]>([]);
	let offProducts = $state<ProductResult[]>([]);
	// Lokale Treffer haben Vorrang; OFF füllt nur fehlende Barcodes auf.
	const productResults = $derived.by(() => {
		const seen = new Set<string>();
		const out: ProductResult[] = [];
		for (const p of [...localProducts, ...offProducts]) {
			if (seen.has(p.barcode)) continue;
			seen.add(p.barcode);
			out.push(p);
		}
		return out.slice(0, 20);
	});
	let favorites = $state<Favorite[]>([]);
	let mealFavorites = $state<MealFavorite[]>([]);
	let showAllFavorites = $state(false);
	let scannerOpen = $state(false);
	let loadingBarcode = $state(false);

	const sortedFavorites = $derived(
		[...favorites].sort((a, b) => {
			const ua = a.useCount ?? 0;
			const ub = b.useCount ?? 0;
			if (ub !== ua) return ub - ua;
			return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
		})
	);

	const matchingFavorites = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return [];
		return sortedFavorites.filter((f) => f.displayName.toLowerCase().includes(q));
	});

	const visibleFavorites = $derived(
		showAllFavorites ? sortedFavorites : sortedFavorites.slice(0, 6)
	);

	// Gericht-Favoriten ("Gerichte") – nur relevant, wenn das Sheet sie einfügen kann (onpickmeal).
	const sortedMealFavorites = $derived(
		[...mealFavorites].sort((a, b) => {
			const ua = a.useCount ?? 0;
			const ub = b.useCount ?? 0;
			if (ub !== ua) return ub - ua;
			return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
		})
	);
	const matchingMealFavorites = $derived.by(() => {
		const q = query.trim().toLowerCase();
		if (!q) return sortedMealFavorites;
		return sortedMealFavorites.filter((f) => f.displayName.toLowerCase().includes(q));
	});

	// Custom form
	let customName = $state('');
	let customKcal = $state('');
	let customProtein = $state('');
	let customFat = $state('');
	let customCarbs = $state('');
	let customSugar = $state('');
	let customFiber = $state('');
	let customSalt = $state('');
	// svelte-ignore state_referenced_locally
	let customAmount = $state(String(suggestedAmount ?? 100));
	// svelte-ignore state_referenced_locally
	let customUnit = $state<'g' | 'ml' | 'piece'>(suggestedUnit ?? 'g');
	let customGramsPerPiece = $state('');
	// svelte-ignore state_referenced_locally
	let customSaveFavorite = $state(favoriteMode);

	// Sheet folgt dem visualViewport, damit es bei iOS-Tastatur und iOS-Auto-Scroll
	// immer korrekt am unteren Rand des sichtbaren Bereichs sitzt:
	// - max-height = visualViewport.height (Sheet bleibt in der Höhe oberhalb der Tastatur)
	// - bottom    = innerHeight − vv.height − vv.offsetTop (anchort am sichtbaren Ende,
	//                kompensiert iOS-Window-Scroll bei Input-Fokus)
	let maxHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
	let bottomOffset = $state(0);
	// Tastatur offen = ein Eingabefeld im Sheet hat Fokus. Zuverlässiger als Viewport-Mathematik.
	// Offen → kein Safe-Area-Polster unten (Sheet sitzt direkt über der Tastatur).
	// Zu   → Safe-Area-Polster für den Home-Indicator.

	onMount(() => {
		void loadFavorites();
		if (onpickmeal) void loadMealFavorites();
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const vv = window.visualViewport;
		const update = () => {
			if (vv) {
				maxHeight = vv.height;
				bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			} else {
				maxHeight = window.innerHeight;
				bottomOffset = 0;
			}
		};
		update();
		vv?.addEventListener('resize', update);
		vv?.addEventListener('scroll', update);
		return () => {
			document.body.style.overflow = prevOverflow;
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		};
	});

	function dismissKeyboard() {
		if (document.activeElement instanceof HTMLInputElement) {
			document.activeElement.blur();
		}
	}

	async function loadFavorites() {
		try {
			const res = await fetch('/api/nutrition/favorites');
			if (res.ok) {
				const d = await res.json();
				favorites = d.favorites ?? [];
			}
		} catch { /* noop */ }
	}

	async function loadMealFavorites() {
		try {
			const res = await fetch('/api/nutrition/meal-favorites');
			if (res.ok) {
				const d = await res.json();
				mealFavorites = d.mealFavorites ?? [];
			}
		} catch { /* noop */ }
	}

	function pickMeal(f: MealFavorite) {
		// useCount hochzählen (Fehler ignorieren, UX nicht blockieren) – wie im bisherigen Picker.
		void fetch(`/api/nutrition/meal-favorites/${f.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ useCount: (f.useCount ?? 0) + 1 })
		});
		onpickmeal?.({
			components: f.components.map((c) => ({
				productBarcode: c.productBarcode,
				genericFoodId: c.genericFoodId,
				customName: c.customName,
				displayName: c.displayName,
				imageUrl: c.imageUrl,
				amount: c.amount,
				unit: c.unit,
				gramsPerPiece: c.gramsPerPiece,
				kcalPer100: c.kcalPer100,
				proteinPer100: c.proteinPer100,
				fatPer100: c.fatPer100,
				carbsPer100: c.carbsPer100,
				sugarPer100: c.sugarPer100,
				fiberPer100: c.fiberPer100,
				saltPer100: c.saltPer100
			})),
			defaultMealName: f.defaultMealName,
			favoriteName: f.displayName,
			imageUrl: f.imageUrl,
			caffeineDrinkId: f.caffeineDrinkId ?? null
		});
	}

	function mealKcal(f: MealFavorite): number {
		return Math.round(f.components.reduce((s, c) => {
			const grams = c.unit === 'piece' ? c.amount * (c.gramsPerPiece ?? 0) : c.amount;
			return s + ((c.kcalPer100 ?? 0) * grams) / 100;
		}, 0));
	}

	function resetSearch() {
		if (localTimer) clearTimeout(localTimer);
		if (offTimer) clearTimeout(offTimer);
		localAbort?.abort();
		offAbort?.abort();
		genericResults = [];
		localProducts = [];
		offProducts = [];
		searching = false;
	}

	function doSearch(q: string) {
		const trimmed = q.trim();
		// Jede neue Eingabe bricht laufende Requests ab und leert alte Treffer sofort,
		// damit nie themenfremde Reste stehen bleiben.
		resetSearch();

		// Barcode (nur Ziffern, 8–14): direkter Lookup statt Textsuche
		if (/^\d{8,14}$/.test(trimmed)) {
			offTimer = setTimeout(() => { void onScan(trimmed); }, 200);
			return;
		}
		// Mindestlänge: ab 2 Zeichen suchen
		if (trimmed.length < 2) return;

		// Stufe 1 — lokal (Generics + Cache), schnell
		localTimer = setTimeout(async () => {
			const ac = new AbortController();
			localAbort = ac;
			try {
				const res = await fetch(
					`/api/nutrition/search?q=${encodeURIComponent(trimmed)}&lang=${currentLang()}&source=local`,
					{ signal: ac.signal }
				);
				if (!res.ok) return;
				const d = await res.json();
				if (query.trim() !== trimmed) return; // Race-Guard: nur aktuelle Eingabe übernehmen
				genericResults = d.generic ?? [];
				localProducts = d.products ?? [];
			} catch { /* abgebrochen oder Fehler */ }
		}, 150);

		// Stufe 2 — OFF (Online-Produkte), langsam + abbrechbar
		searching = true;
		offTimer = setTimeout(async () => {
			const ac = new AbortController();
			offAbort = ac;
			try {
				const res = await fetch(
					`/api/nutrition/search?q=${encodeURIComponent(trimmed)}&lang=${currentLang()}&source=off`,
					{ signal: ac.signal }
				);
				if (!res.ok) return;
				const d = await res.json();
				if (query.trim() !== trimmed) return; // Race-Guard
				offProducts = d.products ?? [];
			} catch { /* abgebrochen oder Fehler */ }
			finally { if (query.trim() === trimmed) searching = false; }
		}, 500);
	}

	$effect(() => {
		doSearch(query);
	});

	function selectGeneric(g: GenericResult) {
		selected = {
			productBarcode: null,
			genericFoodId: g.id,
			customName: null,
			displayName: g.name,
			imageUrl: null,
			amount: suggestedAmount ?? (g.defaultUnit === 'piece' ? 1 : 100),
			unit: suggestedUnit ?? g.defaultUnit,
			gramsPerPiece: g.defaultPieceWeight,
			kcalPer100: g.kcalPer100,
			proteinPer100: g.proteinPer100,
			fatPer100: g.fatPer100,
			carbsPer100: g.carbsPer100,
			sugarPer100: g.sugarPer100,
			fiberPer100: g.fiberPer100,
			saltPer100: g.saltPer100
		};
		selectedCategory = g.category;
		view = 'amount';
	}

	function selectProduct(p: ProductResult) {
		selected = {
			productBarcode: p.barcode,
			genericFoodId: null,
			customName: null,
			displayName: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
			imageUrl: p.imageUrl,
			amount: suggestedAmount ?? (p.servingQuantity && p.servingQuantity > 0 ? p.servingQuantity : 100),
			unit: suggestedUnit ?? 'g',
			gramsPerPiece: null,
			kcalPer100: p.kcalPer100,
			proteinPer100: p.proteinPer100,
			fatPer100: p.fatPer100,
			carbsPer100: p.carbsPer100,
			sugarPer100: p.sugarPer100,
			fiberPer100: p.fiberPer100,
			saltPer100: p.saltPer100
		};
		selectedCategory = null;
		view = 'amount';
	}

	function selectFavorite(f: Favorite) {
		// Wenn favorit ein generic ist, müssen wir das laden ODER die customWerte verwenden.
		// Wir nutzen die in fav gespeicherten Snapshots wenn vorhanden, ansonsten markieren wir Ref auf generic.
		// Vereinfacht: nimm customKcal etc. als per100 wenn keiner gesetzt, müssen wir generic nachladen (für jetzt: nimm 0)
		selected = {
			productBarcode: f.productBarcode,
			genericFoodId: f.genericFoodId,
			customName: null,
			displayName: f.displayName,
			imageUrl: f.imageUrl,
			amount: f.defaultAmount,
			unit: f.defaultUnit,
			gramsPerPiece: f.defaultGramsPerPiece,
			kcalPer100: f.customKcalPer100,
			proteinPer100: f.customProteinPer100,
			fatPer100: f.customFatPer100,
			carbsPer100: f.customCarbsPer100,
			sugarPer100: f.customSugarPer100,
			fiberPer100: f.customFiberPer100,
			saltPer100: f.customSaltPer100
		};
		selectedCategory = f.genericFoodId ? (f.category ?? null) : null;
		// Wenn Favorit auf Produkt/Generic verweist und keine eigenen per100-Werte hat → nachladen
		if (selected.kcalPer100 == null) {
			if (f.productBarcode) {
				void fetchProductData(f.productBarcode);
			} else if (f.genericFoodId) {
				void fetchGenericData(f.genericFoodId);
			}
		}
		view = 'amount';
		// useCount erhöhen
		void fetch(`/api/nutrition/favorites/${f.id}`, {
			method: 'PATCH', headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ useCount: nextNutritionUseCount(f.useCount) })
		});
	}

	async function fetchProductData(barcode: string) {
		try {
			const res = await fetch(`/api/nutrition/product/${barcode}`);
			if (!res.ok) return;
			const d = await res.json();
			const p = d.product;
			if (!p || !selected) return;
			selected = {
				...selected,
				imageUrl: selected.imageUrl ?? p.imageUrl ?? null,
				kcalPer100: selected.kcalPer100 ?? p.kcalPer100,
				proteinPer100: selected.proteinPer100 ?? p.proteinPer100,
				fatPer100: selected.fatPer100 ?? p.fatPer100,
				carbsPer100: selected.carbsPer100 ?? p.carbsPer100,
				sugarPer100: selected.sugarPer100 ?? p.sugarPer100,
				fiberPer100: selected.fiberPer100 ?? p.fiberPer100,
				saltPer100: selected.saltPer100 ?? p.saltPer100
			};
		} catch { /* noop */ }
	}

	async function fetchGenericData(id: string) {
		try {
			const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(id)}&lang=${currentLang()}&source=local`);
			if (!res.ok) return;
			const d = await res.json();
			const g = (d.generic ?? []).find((x: GenericResult) => x.id === id);
			if (!g || !selected) return;
			selected = {
				...selected,
				kcalPer100: selected.kcalPer100 ?? g.kcalPer100,
				proteinPer100: selected.proteinPer100 ?? g.proteinPer100,
				fatPer100: selected.fatPer100 ?? g.fatPer100,
				carbsPer100: selected.carbsPer100 ?? g.carbsPer100,
				sugarPer100: selected.sugarPer100 ?? g.sugarPer100,
				fiberPer100: selected.fiberPer100 ?? g.fiberPer100,
				saltPer100: selected.saltPer100 ?? g.saltPer100
			};
		} catch { /* noop */ }
	}

	async function onScan(code: string) {
		scannerOpen = false;
		loadingBarcode = true;
		try {
			const res = await fetch(`/api/nutrition/product/${encodeURIComponent(code)}`);
			if (!res.ok) return;
			const d = await res.json();
			const p = d.product;
			if (p) {
				selected = {
					productBarcode: p.barcode,
					genericFoodId: null,
					customName: null,
					displayName: p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name,
					imageUrl: p.imageUrl,
					amount: suggestedAmount ?? (p.servingQuantity && p.servingQuantity > 0 ? p.servingQuantity : 100),
					unit: suggestedUnit ?? 'g',
					gramsPerPiece: null,
					kcalPer100: p.kcalPer100,
					proteinPer100: p.proteinPer100,
					fatPer100: p.fatPer100,
					carbsPer100: p.carbsPer100,
					sugarPer100: p.sugarPer100,
					fiberPer100: p.fiberPer100,
					saltPer100: p.saltPer100
				};
				view = 'amount';
			} else {
				alert(t.nutrition_off_not_found);
			}
		} finally {
			loadingBarcode = false;
		}
	}

	async function submitCustom() {
		const kcal = parseOptionalNutritionNumber(customKcal);
		const amount = parseOptionalNutritionNumber(customAmount);
		const gramsPerPiece = parseOptionalNutritionNumber(customGramsPerPiece);
		if (!customName.trim() || kcal == null || amount == null || amount <= 0) return;
		if (customUnit === 'piece' && (!gramsPerPiece || gramsPerPiece <= 0)) return;
		const component: Component = {
			productBarcode: null,
			genericFoodId: null,
			customName: customName.trim(),
			displayName: customName.trim(),
			imageUrl: null,
			amount: suggestedAmount ?? amount,
			unit: suggestedUnit ?? customUnit,
			gramsPerPiece: customUnit === 'piece' ? gramsPerPiece : null,
			kcalPer100: kcal,
			proteinPer100: parseOptionalNutritionNumber(customProtein),
			fatPer100: parseOptionalNutritionNumber(customFat),
			carbsPer100: parseOptionalNutritionNumber(customCarbs),
			sugarPer100: parseOptionalNutritionNumber(customSugar),
			fiberPer100: parseOptionalNutritionNumber(customFiber),
			saltPer100: parseOptionalNutritionNumber(customSalt)
		};
		selected = component;
		if ((customSaveFavorite || favoriteMode) && !(await saveAsFavorite())) return;
		onadd(component);
	}

	function effectiveGrams(c: Component): number {
		if (c.unit === 'piece') return c.amount * (c.gramsPerPiece ?? 0);
		return c.amount;
	}
	function compKcal(c: Component): number {
		return ((c.kcalPer100 ?? 0) * effectiveGrams(c)) / 100;
	}
	function compMacro(c: Component, per100: number | null): number {
		return ((per100 ?? 0) * effectiveGrams(c)) / 100;
	}

	async function confirm() {
		if (!selected) return;
		if (favoriteMode && !(await saveAsFavorite())) return;
		onadd(selected);
	}

	let savingFavorite = $state(false);
	let savedFavoriteId = $state<string | null>(null);

	function alreadyFavorite(): boolean {
		if (!selected) return false;
		if (savedFavoriteId) return true;
		if (selected.productBarcode) return favorites.some((f) => f.productBarcode === selected!.productBarcode);
		if (selected.genericFoodId) return favorites.some((f) => f.genericFoodId === selected!.genericFoodId);
		return favorites.some((f) => f.displayName === selected!.displayName);
	}

	async function saveAsFavorite(): Promise<boolean> {
		if (!selected || savingFavorite) return false;
		if (alreadyFavorite()) return true;
		savingFavorite = true;
		let saved = false;
		try {
			const res = await fetch('/api/nutrition/favorites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: selected.displayName,
					imageUrl: selected.imageUrl,
					productBarcode: selected.productBarcode,
					genericFoodId: selected.genericFoodId,
					customKcalPer100: selected.kcalPer100,
					customProteinPer100: selected.proteinPer100,
					customFatPer100: selected.fatPer100,
					customCarbsPer100: selected.carbsPer100,
					customSugarPer100: selected.sugarPer100,
					customFiberPer100: selected.fiberPer100,
					customSaltPer100: selected.saltPer100,
					defaultAmount: selected.amount,
					defaultUnit: selected.unit,
					defaultGramsPerPiece: selected.gramsPerPiece
				})
			});
			if (res.ok) {
				saved = true;
				const d = await res.json();
				savedFavoriteId = d.id ?? null;
				await loadFavorites();
			}
		} finally {
			savingFavorite = false;
		}
		return saved;
	}
</script>

<!-- Kategorie-Icon für generische Lebensmittel (gleicher Stroke-Stil wie die Listen-Icons). -->
{#snippet catIcon(category: string | null | undefined, px: number)}
	{@const ic = getNutritionCategoryIcon(category)}
	<svg width={px} height={px} viewBox="0 0 24 24" fill="none" stroke={ic.color}
	     stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
		{@html ic.svgContent}
	</svg>
{/snippet}

<ManageSheetShell
	accent="#FB923C"
	title={favoriteMode ? t.nutrition_new_ingredient : view === 'amount' ? t.nutrition_amount : view === 'custom' ? t.nutrition_custom_entry : t.nutrition_add_title}
	subtitle={view === 'picker' ? t.nutrition_picker_subtitle : null}
	{onclose}
	zIndex={65}
	bottom={`${bottomOffset}px`}
	maxHeight={`calc(${maxHeight}px - env(safe-area-inset-top, 0px) - 1.5rem)`}
>
	{#snippet headerActions()}
		{#if !favoriteMode && view === 'picker' && (favorites.length > 0 || mealFavorites.length > 0)}
			<button type="button" onclick={() => { onclose(); goto('/tracker/nutrition/favorites'); }} class="nutrition-picker-header-action" aria-label={t.nutrition_favorites_manage}>
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
				<span>{t.nutrition_favorites_label}</span>
			</button>
		{/if}
	{/snippet}
	{#snippet body()}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="manage-stack nutrition-picker-workspace" onscroll={dismissKeyboard} ontouchmove={dismissKeyboard}>
			{#if view === 'picker'}
				{#if loadingBarcode || searching}
					<div class="nutrition-search-status">
						<span></span>{loadingBarcode ? t.nutrition_loading_product : t.nutrition_searching}
					</div>
				{/if}

				{#if matchingMealFavorites.length > 0}
					<div>
						<span class="manage-section-title">{t.nutrition_meal_favorites_section}</span>
						<section class="manage-settings-surface nutrition-result-list">
							{#each matchingMealFavorites as f (f.id)}
								<NutritionFoodRow title={f.displayName} meta={`${f.components.length} ${t.nutrition_ingredients}`} trailing={`${mealKcal(f)} kcal`} imageUrl={f.imageUrl} onactivate={() => pickMeal(f)} />
							{/each}
						</section>
					</div>
				{/if}

				{@const listedFavorites = query.trim() ? matchingFavorites : visibleFavorites}
				{#if listedFavorites.length > 0}
					<div>
						<span class="manage-section-title">{query.trim() ? t.nutrition_favorites_label : t.nutrition_recently_used}</span>
						<section class="manage-settings-surface nutrition-result-list">
							{#each listedFavorites as f (f.id)}
								{#if f.genericFoodId && f.category && !f.imageUrl}
									<NutritionFoodRow title={f.displayName} meta={t.nutrition_favorite_label} trailing={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} onactivate={() => selectFavorite(f)}>
										{#snippet leading()}{@render catIcon(f.category, 27)}{/snippet}
									</NutritionFoodRow>
								{:else}
									<NutritionFoodRow title={f.displayName} meta={t.nutrition_favorite_label} trailing={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} imageUrl={f.imageUrl} onactivate={() => selectFavorite(f)} />
								{/if}
							{/each}
						</section>
						{#if !query.trim() && sortedFavorites.length > 6}
							<button type="button" onclick={() => (showAllFavorites = !showAllFavorites)} class="nutrition-show-all">{showAllFavorites ? t.nutrition_show_less : t.nutrition_show_all_favorites}</button>
						{/if}
					</div>
				{/if}

				{#if query.trim() && genericResults.length > 0}
					<div>
						<span class="manage-section-title">{t.nutrition_basic_foods}</span>
						<section class="manage-settings-surface nutrition-result-list">
							{#each genericResults as g (g.id)}
								<NutritionFoodRow title={g.name} trailing={`${Math.round(g.kcalPer100)} kcal / 100 ${g.defaultUnit === 'ml' ? 'ml' : 'g'}`} onactivate={() => selectGeneric(g)}>
									{#snippet leading()}{@render catIcon(g.category, 27)}{/snippet}
								</NutritionFoodRow>
							{/each}
						</section>
					</div>
				{/if}

				{#if query.trim() && productResults.length > 0}
					<div>
						<span class="manage-section-title">{t.nutrition_products_section}</span>
						<section class="manage-settings-surface nutrition-result-list">
							{#each productResults as p (p.barcode)}
								<NutritionFoodRow
									title={p.brand && !p.name.toLowerCase().includes(p.brand.toLowerCase()) ? `${p.brand} ${p.name}` : p.name}
									meta={p.nutriscoreGrade ? `Nutri-Score ${p.nutriscoreGrade.toUpperCase()}` : null}
									trailing={p.kcalPer100 != null ? `${Math.round(p.kcalPer100)} kcal / 100 g` : t.nutrition_no_kcal_data}
									imageUrl={p.imageUrl}
									onactivate={() => selectProduct(p)}
								/>
							{/each}
						</section>
					</div>
				{/if}

				{#if !query.trim() && favorites.length === 0 && mealFavorites.length === 0}
					<p class="nutrition-empty-state">{t.nutrition_favorites_tip}</p>
				{:else if query.trim() && !searching && matchingMealFavorites.length === 0 && matchingFavorites.length === 0 && genericResults.length === 0 && productResults.length === 0}
					<p class="nutrition-empty-state">{t.nutrition_nothing_found}</p>
				{/if}

			{:else if view === 'custom'}
				<div>
					<span class="manage-section-title">{t.nutrition_product_section}</span>
					<section class="manage-settings-surface">
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_name}</span>
							<input type="text" bind:value={customName} placeholder={t.nutrition_custom_name_placeholder} class="manage-settings-input" />
						</label>
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_basis}</span>
							<select bind:value={customUnit} class="nutrition-custom-select">
								<option value="g">100 g</option><option value="ml">100 ml</option><option value="piece">{t.nutrition_unit_piece}</option>
							</select>
						</label>
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_energy}</span>
							<span class="nutrition-number-with-unit"><input type="text" inputmode="decimal" bind:value={customKcal} placeholder="120" /><small>kcal</small></span>
						</label>
					</section>
				</div>

				<div>
					<span class="manage-section-title">{nutrition_nutrients_per_100(nutritionBasisSuffix(customUnit))}</span>
					<section class="manage-settings-surface">
						<div class="manage-settings-row nutrition-custom-grid">
							<label><span>{t.nutrition_protein}</span><input type="text" inputmode="decimal" bind:value={customProtein} placeholder="0" /></label>
							<label><span>{t.nutrition_fat}</span><input type="text" inputmode="decimal" bind:value={customFat} placeholder="0" /></label>
							<label><span>{t.nutrition_carbs}</span><input type="text" inputmode="decimal" bind:value={customCarbs} placeholder="0" /></label>
						</div>
						<div class="manage-settings-row nutrition-custom-grid">
							<label><span>{t.nutrition_fiber}</span><input type="text" inputmode="decimal" bind:value={customFiber} placeholder="0" /></label>
							<label><span>{t.nutrition_sugar}</span><input type="text" inputmode="decimal" bind:value={customSugar} placeholder="0" /></label>
							<label><span>{t.nutrition_salt}</span><input type="text" inputmode="decimal" bind:value={customSalt} placeholder="0" /></label>
						</div>
					</section>
				</div>

				<div>
					<span class="manage-section-title">{t.nutrition_portion_section}</span>
					<section class="manage-settings-surface">
						<label class="manage-settings-row nutrition-custom-row">
							<span class="manage-settings-label">{t.nutrition_amount}</span>
							<span class="nutrition-number-with-unit"><input type="text" inputmode="decimal" bind:value={customAmount} /><small>{customUnit === 'piece' ? t.nutrition_unit_short_piece : customUnit}</small></span>
						</label>
						{#if customUnit === 'piece'}
							<label class="manage-settings-row nutrition-custom-row"><span class="manage-settings-label">{t.nutrition_grams_per_piece}</span><span class="nutrition-number-with-unit"><input type="text" inputmode="decimal" bind:value={customGramsPerPiece} /><small>g</small></span></label>
						{/if}
						{#if !favoriteMode}<button type="button" class="manage-settings-row nutrition-favorite-toggle" aria-pressed={customSaveFavorite} onclick={() => (customSaveFavorite = !customSaveFavorite)}>
							<span class="manage-settings-label">{t.nutrition_save_as_favorite_short}</span>
							<svg width="18" height="18" viewBox="0 0 24 24" fill={customSaveFavorite ? '#FB923C' : 'none'} stroke={customSaveFavorite ? '#FB923C' : 'var(--color-on-surface-variant)'} stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
						</button>{/if}
					</section>
				</div>

			{:else if view === 'amount' && selected}
				{@const isFav = alreadyFavorite()}
				<section class="manage-settings-surface nutrition-amount-surface">
					<div class="nutrition-selected-head">
						{#if selected.imageUrl}<img src={selected.imageUrl} alt="" />{:else if selectedCategory}<span>{@render catIcon(selectedCategory, 31)}</span>{:else}<span>{selected.displayName.slice(0, 1).toUpperCase()}</span>{/if}
						<div><strong>{selected.displayName}</strong><small>{selected.kcalPer100 != null ? `${Math.round(selected.kcalPer100)} kcal / 100 ${nutritionBasisSuffix(selected.unit)}` : t.nutrition_no_kcal_data}</small></div>
						<button type="button" onclick={saveAsFavorite} disabled={savingFavorite || isFav} aria-label={isFav ? t.nutrition_favorite_saved : t.nutrition_save_as_favorite}>
							<svg width="20" height="20" viewBox="0 0 24 24" fill={isFav ? '#FB923C' : 'none'} stroke={isFav ? '#FB923C' : 'var(--color-on-surface-variant)'} stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
						</button>
					</div>
					<div class="manage-settings-row nutrition-amount-row">
						<span class="manage-settings-label">{t.nutrition_amount}</span>
						<input type="number" inputmode="decimal" bind:value={selected.amount} min="0" step="any" />
						<select bind:value={selected.unit}><option value="g">g</option><option value="ml">ml</option><option value="piece">{t.nutrition_unit_piece}</option></select>
						<strong>= {Math.round(compKcal(selected))} kcal</strong>
					</div>
					{#if selected.unit === 'piece'}
						<label class="manage-settings-row nutrition-custom-row"><span class="manage-settings-label">{t.nutrition_grams_per_piece}</span><span class="nutrition-number-with-unit"><input type="number" inputmode="decimal" bind:value={selected.gramsPerPiece} min="0" step="any" /><small>g</small></span></label>
					{/if}
					{#if selected.kcalPer100 != null}
						<div class="nutrition-amount-macros">
							<NutritionMacroStrip items={[
								{ label: t.nutrition_protein, value: compMacro(selected, selected.proteinPer100) },
								{ label: t.nutrition_fat, value: compMacro(selected, selected.fatPer100) },
								{ label: t.nutrition_carbs, value: compMacro(selected, selected.carbsPer100) },
								{ label: t.nutrition_fiber, value: compMacro(selected, selected.fiberPer100) }
							]} />
						</div>
					{/if}
				</section>
			{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		{#if view === 'picker'}
			<div class="nutrition-picker-footer">
				<button type="button" class="nutrition-custom-entry-action" onclick={() => (view = 'custom')}>+ {t.nutrition_custom_entry}</button>
				<input type="text" bind:value={query} placeholder={t.nutrition_search_placeholder} enterkeyhint="search" class="manage-input" />
				<div class="nutrition-picker-footer-buttons">
					<button type="button" onclick={onclose} class="manage-secondary">{t.nutrition_cancel}</button>
					<button type="button" onclick={() => (scannerOpen = true)} class="manage-primary">{t.nutrition_scan}</button>
				</div>
			</div>
		{:else if view === 'custom'}
			<button type="button" onclick={() => (view = 'picker')} class="manage-secondary">{t.nutrition_back}</button>
			<button type="button" onclick={() => void submitCustom()} disabled={!customName.trim() || parseOptionalNutritionNumber(customKcal) == null || !parseOptionalNutritionNumber(customAmount)} class="manage-primary disabled:opacity-40">{favoriteMode ? t.nutrition_save : t.nutrition_apply}</button>
		{:else}
			<button type="button" onclick={() => { if (!initial) { view = 'picker'; selected = null; } else onclose(); }} class="manage-secondary">{t.nutrition_back}</button>
			<button type="button" onclick={() => void confirm()} class="manage-primary">{favoriteMode ? t.nutrition_save : t.nutrition_apply}</button>
		{/if}
	{/snippet}
</ManageSheetShell>

{#if scannerOpen}
	<BarcodeScanner rawMode onFound={onScan} onClose={() => (scannerOpen = false)} />
{/if}

<style>
	.nutrition-picker-header-action { display: flex; min-height: 40px; align-items: center; justify-content: center; gap: 5px; padding-inline: 8px; border-radius: 12px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 650; }
	.nutrition-picker-workspace { overscroll-behavior: contain; }
	.nutrition-search-status { display: flex; min-height: 34px; align-items: center; justify-content: center; gap: 7px; color: var(--color-on-surface-variant); font-size: 11px; }
	.nutrition-search-status span { width: 13px; height: 13px; border: 2px solid color-mix(in srgb, #FB923C 35%, transparent); border-top-color: #FB923C; border-radius: 999px; animation: nutrition-spin .8s linear infinite; }
	.nutrition-result-list :global(.nutrition-food-row + .nutrition-food-row) { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-show-all { width: 100%; min-height: 38px; margin-top: 3px; color: #FB923C; font-size: 11px; font-weight: 650; }
	.nutrition-empty-state { padding: 24px 12px; color: var(--color-on-surface-variant); font-size: 12px; line-height: 1.45; text-align: center; }
	.nutrition-picker-footer { display: grid; grid-column: 1 / -1; gap: 7px; }
	.nutrition-custom-entry-action { min-height: 34px; border-radius: 10px; color: #FB923C; font-size: 12px; font-weight: 650; }
	.nutrition-custom-entry-action:active { background: color-mix(in srgb, #FB923C 8%, transparent); }
	.nutrition-picker-footer-buttons { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); gap: 8px; }
	.nutrition-custom-row { display: grid; grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr); align-items: center; gap: 12px; }
	.nutrition-custom-select { width: 100%; height: 36px; border: 0; outline: 0; appearance: none; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; text-align: right; text-align-last: right; }
	.nutrition-number-with-unit { display: flex; min-width: 0; align-items: center; justify-content: flex-end; gap: 5px; }
	.nutrition-number-with-unit input { width: 100%; min-width: 0; height: 36px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
	.nutrition-number-with-unit input::placeholder, .nutrition-custom-grid input::placeholder { color: var(--color-on-surface-variant); opacity: .55; }
	.nutrition-number-with-unit small { flex: none; color: #FB923C; font-size: 12px; font-weight: 600; }
	.nutrition-custom-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; padding-block: 7px; }
	.nutrition-custom-grid label { display: grid; min-width: 0; gap: 2px; }
	.nutrition-custom-grid span { overflow: hidden; color: var(--color-on-surface-variant); font-size: 10px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-custom-grid input { width: 100%; min-width: 0; height: 28px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-favorite-toggle { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 12px; text-align: left; }
	.nutrition-selected-head { display: flex; min-height: 58px; align-items: center; gap: 10px; padding: 8px 10px; }
	.nutrition-selected-head > img, .nutrition-selected-head > span { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; font-size: 13px; font-weight: 700; }
	.nutrition-selected-head > div { display: grid; min-width: 0; flex: 1; gap: 2px; }
	.nutrition-selected-head strong, .nutrition-selected-head small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-selected-head strong { color: var(--color-on-surface); font-size: 14px; }
	.nutrition-selected-head small { color: var(--color-on-surface-variant); font-size: 11px; font-weight: 500; }
	.nutrition-selected-head button { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; }
	.nutrition-amount-row { display: grid; grid-template-columns: auto minmax(48px, 1fr) auto minmax(82px, auto); align-items: center; gap: 7px; }
	.nutrition-amount-row input, .nutrition-amount-row select { min-width: 0; height: 36px; border: 0; outline: 0; background: transparent; color: var(--color-on-surface); font-size: 16px; font-variant-numeric: tabular-nums; }
	.nutrition-amount-row input { width: 100%; text-align: right; }
	.nutrition-amount-row select { color: #FB923C; font-weight: 650; }
	.nutrition-amount-row strong { color: #FB923C; font-size: 14px; font-weight: 650; font-variant-numeric: tabular-nums; text-align: right; }
	.nutrition-amount-macros { padding: 10px; border-top: 1px solid var(--bubble-container-border); }
	@keyframes nutrition-spin { to { transform: rotate(360deg); } }
	@media (prefers-reduced-motion: reduce) { .nutrition-search-status span { animation: none; } }
</style>
