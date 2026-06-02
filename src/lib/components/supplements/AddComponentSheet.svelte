<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import BarcodeScanner from '$lib/components/BarcodeScanner.svelte';
	import { t, currentLang } from '$lib/i18n.svelte';

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

	let { initial = null, suggestedAmount = null, suggestedUnit = null, onclose, onadd, onpickmeal }: {
		initial?: Component | null;
		// Beim Zuordnen einer Rezept-Zutat: Menge/Einheit aus dem Zutatentext vorbefüllen.
		suggestedAmount?: number | null;
		suggestedUnit?: 'g' | 'ml' | 'piece' | null;
		onclose: () => void;
		onadd: (c: Component) => void;
		onpickmeal?: (payload: { components: Component[]; defaultMealName: string | null; favoriteName: string; imageUrl: string | null; caffeineDrinkId: string | null }) => void;
	} = $props();

	// View: 'picker' (browse/search) | 'amount' (set amount for selected)
	// svelte-ignore state_referenced_locally
	let view = $state<'picker' | 'amount' | 'custom'>(initial ? 'amount' : 'picker');
	// svelte-ignore state_referenced_locally
	let selected = $state<Component | null>(initial ? { ...initial } : null);

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
	let inputFocused = $state(false);

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
			body: JSON.stringify({ useCount: (favorites.find(x => x.id === f.id)?.['defaultAmount'] != null ? 1 : 1) })
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

	function submitCustom() {
		const kcal = parseFloat(customKcal.replace(',', '.'));
		if (!customName.trim() || !Number.isFinite(kcal) || kcal < 0) return;
		selected = {
			productBarcode: null,
			genericFoodId: null,
			customName: customName.trim(),
			displayName: customName.trim(),
			imageUrl: null,
			amount: suggestedAmount ?? 100,
			unit: suggestedUnit ?? 'g',
			gramsPerPiece: null,
			kcalPer100: kcal,
			proteinPer100: parseFloat(customProtein.replace(',', '.')) || null,
			fatPer100: parseFloat(customFat.replace(',', '.')) || null,
			carbsPer100: parseFloat(customCarbs.replace(',', '.')) || null,
			sugarPer100: null,
			fiberPer100: null,
			saltPer100: null
		};
		view = 'amount';
	}

	function effectiveGrams(c: Component): number {
		if (c.unit === 'piece') return c.amount * (c.gramsPerPiece ?? 0);
		return c.amount;
	}
	function compKcal(c: Component): number {
		return ((c.kcalPer100 ?? 0) * effectiveGrams(c)) / 100;
	}

	function confirm() {
		if (!selected) return;
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

	async function saveAsFavorite() {
		if (!selected || savingFavorite || alreadyFavorite()) return;
		savingFavorite = true;
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
				const d = await res.json();
				savedFavoriteId = d.id ?? null;
				await loadFavorites();
			}
		} finally {
			savingFavorite = false;
		}
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[62]" style="background: rgba(0,0,0,0.5)" onclick={onclose}></div>

<div class="fixed left-0 right-0 z-[65] rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
     style="background-color: var(--modal-bg); bottom: {bottomOffset}px; max-height: calc({maxHeight}px - env(safe-area-inset-top, 0px) - 1.5rem)"
     onfocusin={() => (inputFocused = true)} onfocusout={() => (inputFocused = false)}>
	<!-- Handle -->
	<div class="flex justify-center pt-3 pb-1 shrink-0">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
	</div>

	<!-- Title -->
	<div class="px-5 pb-2 shrink-0 flex items-center justify-between">
		<p class="font-bold text-lg" style="color: #FB923C">
			{view === 'amount' ? t.nutrition_amount : view === 'custom' ? t.nutrition_custom_entry : t.nutrition_add_title}
		</p>
		{#if view === 'picker' && (favorites.length > 0 || mealFavorites.length > 0)}
			<button onclick={() => { onclose(); goto('/tracker/nutrition/favorites'); }}
			        class="w-9 h-9 rounded-lg flex items-center justify-center active:opacity-60"
			        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_edit}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Scrollable content -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="overflow-y-auto px-5 py-2 flex-1"
	     style="min-height: 0; overscroll-behavior: contain; -webkit-overflow-scrolling: touch"
	     onscroll={dismissKeyboard}
	     ontouchmove={dismissKeyboard}>
		{#if view === 'picker'}
			{#if loadingBarcode}
				<div class="text-center text-xs py-2" style="color: var(--color-on-surface-variant)">{t.nutrition_loading_product}</div>
			{:else if searching}
				<div class="text-center text-xs py-2" style="color: var(--color-on-surface-variant)">{t.nutrition_searching}</div>
			{/if}

			{@const rows = !query.trim()
				? [
					...matchingMealFavorites.map((f) => ({ kind: 'meal' as const, id: f.id, data: f })),
					...visibleFavorites.map((f) => ({ kind: 'fav' as const, id: f.id, data: f }))
				]
				: [
					...matchingMealFavorites.map((f) => ({ kind: 'meal' as const, id: f.id, data: f })),
					...matchingFavorites.map((f) => ({ kind: 'fav' as const, id: f.id, data: f })),
					...genericResults.map((g) => ({ kind: 'gen' as const, id: g.id, data: g })),
					...productResults.map((p) => ({ kind: 'prod' as const, id: p.barcode, data: p }))
				]}

			{#if rows.length > 0}
				<div class="rounded-2xl overflow-hidden"
				     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					{#each rows as row, i (row.kind + '_' + row.id)}
						{#if row.kind === 'meal'}
							{@const f = row.data}
							<button onclick={() => pickMeal(f)}
							        class="w-full text-left px-3 py-2 flex items-center gap-2 active:opacity-60 min-w-0">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="#FB923C" stroke="#FB923C" stroke-width="2" stroke-linejoin="round" class="shrink-0">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
								</svg>
								{#if f.imageUrl}
									<img src={f.imageUrl} alt="" class="w-6 h-6 rounded object-cover bg-black/5 shrink-0" />
								{:else}
									<div class="w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-semibold"
									     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
										{f.displayName.slice(0, 1).toUpperCase()}
									</div>
								{/if}
								<span class="flex-1 truncate text-sm" style="color: var(--color-on-surface)">{f.displayName}</span>
								<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">
									{f.components.length} {t.nutrition_ingredients} · {mealKcal(f)} kcal
								</span>
							</button>
						{:else if row.kind === 'fav'}
							{@const f = row.data}
							<button onclick={() => selectFavorite(f)}
							        class="w-full text-left px-3 py-2 flex items-center gap-2 active:opacity-60 min-w-0">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="#FB923C" stroke="#FB923C" stroke-width="2" stroke-linejoin="round" class="shrink-0">
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
								</svg>
								{#if f.imageUrl}
									<img src={f.imageUrl} alt="" class="w-6 h-6 rounded object-cover bg-black/5 shrink-0" />
								{:else}
									<div class="w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-semibold"
									     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
										{f.displayName.slice(0, 1).toUpperCase()}
									</div>
								{/if}
								<span class="flex-1 truncate text-sm" style="color: var(--color-on-surface)">{f.displayName}</span>
								<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">
									{f.defaultAmount}{f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}
								</span>
							</button>
						{:else if row.kind === 'gen'}
							{@const g = row.data}
							<button onclick={() => selectGeneric(g)}
							        class="w-full text-left px-3 py-2 flex items-center gap-2 active:opacity-60 min-w-0">
								<div class="w-[14px] shrink-0"></div>
								<div class="w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-semibold"
								     style="background: color-mix(in srgb, var(--color-on-surface) 6%, transparent); color: var(--color-on-surface-variant)">
									{g.name.slice(0, 1).toUpperCase()}
								</div>
								<span class="flex-1 truncate text-sm" style="color: var(--color-on-surface)">{g.name}</span>
								<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">
									{Math.round(g.kcalPer100)} kcal/100{g.defaultUnit === 'ml' ? 'ml' : 'g'}
								</span>
							</button>
						{:else if row.kind === 'prod'}
							{@const p = row.data}
							{@const startsWithBrand = !!p.brand && p.name.toLowerCase().startsWith(p.brand.toLowerCase())}
							{@const kcalText = p.kcalPer100 != null ? `${Math.round(p.kcalPer100)} kcal/100g` : null}
							<button onclick={() => selectProduct(p)}
							        class="w-full text-left px-3 py-2 flex items-center gap-2 active:opacity-60 min-w-0">
								<div class="w-[14px] shrink-0"></div>
								{#if p.imageUrl}
									<img src={p.imageUrl} alt="" class="w-6 h-6 rounded object-cover bg-black/5 shrink-0" />
								{:else}
									<div class="w-6 h-6 rounded shrink-0 flex items-center justify-center text-[10px] font-semibold"
									     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
										{p.name.slice(0, 1).toUpperCase()}
									</div>
								{/if}
								<div class="flex-1 min-w-0">
									<div class="text-sm truncate" style="color: var(--color-on-surface)">
										{#if startsWithBrand && p.brand}<span style="color: var(--color-on-surface-variant)">{p.name.slice(0, p.brand.length)}</span>{p.name.slice(p.brand.length)}{:else if p.brand}<span style="color: var(--color-on-surface-variant)">{p.brand} </span>{p.name}{:else}{p.name}{/if}
									</div>
									{#if p.nutriscoreGrade || kcalText}
										<div class="text-[10px] tabular-nums truncate" style="color: var(--color-on-surface-variant)">
											{#if p.nutriscoreGrade}Nutri-Score {p.nutriscoreGrade.toUpperCase()}{/if}{#if p.nutriscoreGrade && kcalText} · {/if}{#if kcalText}{kcalText}{/if}
										</div>
									{/if}
								</div>
							</button>
						{/if}
						{#if i < rows.length - 1}
							<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
						{/if}
					{/each}
				</div>

				{#if !query.trim() && sortedFavorites.length > 6}
					<button onclick={() => (showAllFavorites = !showAllFavorites)}
					        class="w-full text-center text-xs underline mt-3 active:opacity-60"
					        style="color: #FB923C">
						{showAllFavorites ? t.nutrition_show_less : t.nutrition_show_all_favorites}
					</button>
				{/if}
			{:else if !query.trim() && favorites.length === 0}
				<div class="text-center text-xs py-4" style="color: var(--color-on-surface-variant)">
					{t.nutrition_favorites_tip}
				</div>
			{:else if query.trim() && !searching}
				<div class="text-center text-xs py-4" style="color: var(--color-on-surface-variant)">
					{t.nutrition_nothing_found}
				</div>
			{/if}

		{:else if view === 'custom'}
			<div class="flex flex-col gap-3">
				<label class="block">
					<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_name}</span>
					<input type="text" bind:value={customName} placeholder={t.nutrition_custom_name_placeholder}
					       class="w-full mt-1 px-4 py-3 rounded-xl bg-transparent outline-none"
					       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px" />
				</label>
				<label class="block">
					<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_kcal_per_100_label}</span>
					<input type="text" inputmode="decimal" bind:value={customKcal} placeholder="120"
					       class="w-full mt-1 px-4 py-3 rounded-xl bg-transparent outline-none"
					       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px" />
				</label>
				<div class="grid grid-cols-3 gap-2">
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_protein_per_100}</span>
						<input type="text" inputmode="decimal" bind:value={customProtein}
						       class="w-full mt-1 px-3 py-2.5 rounded-xl bg-transparent outline-none"
						       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px" />
					</label>
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_fat_per_100}</span>
						<input type="text" inputmode="decimal" bind:value={customFat}
						       class="w-full mt-1 px-3 py-2.5 rounded-xl bg-transparent outline-none"
						       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px" />
					</label>
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_carbs_per_100}</span>
						<input type="text" inputmode="decimal" bind:value={customCarbs}
						       class="w-full mt-1 px-3 py-2.5 rounded-xl bg-transparent outline-none"
						       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px" />
					</label>
				</div>
				<button onclick={submitCustom}
				        disabled={!customName.trim() || !customKcal}
				        class="mt-2 w-full py-3 rounded-xl font-medium active:opacity-70 disabled:opacity-30"
				        style="background: #FB923C; color: #fff">
					{t.nutrition_next}
				</button>
			</div>

		{:else if view === 'amount' && selected}
			{@const isFav = alreadyFavorite()}
			<div class="rounded-2xl"
			     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<!-- Kopf: Bild + Name + kcal/100 + Stern -->
				<div class="px-3 py-2.5 flex gap-2.5 items-center">
					{#if selected.imageUrl}
						<img src={selected.imageUrl} alt="" class="w-10 h-10 rounded-lg object-cover bg-black/5 shrink-0" />
					{:else}
						<div class="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0"
						     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
							{selected.displayName.slice(0, 1).toUpperCase()}
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{selected.displayName}</div>
						<div class="text-xs" style="color: var(--color-on-surface-variant)">
							{selected.kcalPer100 != null ? `${Math.round(selected.kcalPer100)} kcal/100g` : t.nutrition_no_kcal_data}
						</div>
					</div>
					<button onclick={saveAsFavorite} disabled={savingFavorite || isFav}
					        class="shrink-0 w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:active:opacity-100"
					        style="color: {isFav ? '#FB923C' : 'var(--color-on-surface-variant)'}"
					        aria-label={isFav ? t.nutrition_favorite_saved : t.nutrition_save_as_favorite}
					        title={isFav ? t.nutrition_favorite_saved : t.nutrition_save_as_favorite}>
						{#if savingFavorite}
							<div class="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style="border-color: #FB923C; border-top-color: transparent"></div>
						{:else}
							<svg width="20" height="20" viewBox="0 0 24 24" fill={isFav ? '#FB923C' : 'none'} stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
							</svg>
						{/if}
					</button>
				</div>

				<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>

				<!-- Menge + Einheit + Kcal-Ergebnis -->
				<div class="px-3 py-2.5 flex items-center gap-2">
					<span class="text-[11px] uppercase tracking-wide shrink-0" style="color: var(--color-on-surface-variant)">{t.nutrition_amount}</span>
					<input type="number" inputmode="decimal" bind:value={selected.amount} min="0" step="any"
					       class="flex-1 min-w-0 px-2.5 rounded-xl bg-transparent outline-none tabular-nums"
					       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px" />
					<select bind:value={selected.unit}
					        class="px-2 rounded-xl bg-transparent outline-none appearance-none shrink-0"
					        style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px">
						<option value="g">g</option>
						<option value="ml">ml</option>
						<option value="piece">{t.nutrition_unit_piece}</option>
					</select>
					<span class="text-base font-semibold tabular-nums shrink-0" style="color: #FB923C">
						= {Math.round(compKcal(selected))} kcal
					</span>
				</div>

				{#if selected.unit === 'piece'}
					<div class="px-3 pb-2 -mt-1 flex items-center gap-2">
						<span class="text-[11px] uppercase tracking-wide shrink-0" style="color: var(--color-on-surface-variant)">{t.nutrition_grams_per_piece}</span>
						<input type="number" inputmode="decimal" bind:value={selected.gramsPerPiece} min="0" step="any"
						       class="flex-1 min-w-0 px-2.5 rounded-xl bg-transparent outline-none tabular-nums"
						       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px" />
					</div>
				{/if}

				{#if selected.kcalPer100 != null}
					<div class="px-3 pb-2.5 text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
						{t.nutrition_protein} {((selected.proteinPer100 ?? 0) * effectiveGrams(selected) / 100).toFixed(1)}g
						· {t.nutrition_fat} {((selected.fatPer100 ?? 0) * effectiveGrams(selected) / 100).toFixed(1)}g
						· {t.nutrition_carbs} {((selected.carbsPer100 ?? 0) * effectiveGrams(selected) / 100).toFixed(1)}g
					</div>
				{/if}
			</div>

		{/if}
	</div>

	<!-- Suchleiste – unten, direkt über den Buttons (bottom-up wie die Einkaufsliste) -->
	{#if view === 'picker'}
		<div class="px-5 pt-2 shrink-0">
			<input type="text" bind:value={query} placeholder={t.nutrition_search_placeholder}
			       enterkeyhint="search"
			       class="w-full px-3 rounded-xl bg-transparent outline-none"
			       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 40px" />
		</div>
	{/if}

	<!-- Bottom buttons -->
	<div class="px-5 pt-2 shrink-0 flex gap-2" style="padding-bottom: {inputFocused ? '0.75rem' : 'calc(env(safe-area-inset-bottom) + 0.75rem)'}">
		<button onclick={() => { if (view === 'amount' && !initial) { view = 'picker'; selected = null; } else if (view === 'custom') { view = 'picker'; } else { onclose(); } }}
		        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
		        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
			{view === 'amount' && !initial ? t.nutrition_back : view === 'custom' ? t.nutrition_back : t.nutrition_cancel}
		</button>
		{#if view === 'picker'}
			<button onclick={() => (view = 'custom')}
			        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
			        style="background-color: transparent; border: 1px solid #FB923C; color: #FB923C">
				{t.nutrition_custom}
			</button>
			<button onclick={() => (scannerOpen = true)}
			        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80"
			        style="background: #FB923C; color: #fff">
				{t.nutrition_scan}
			</button>
		{:else if view === 'amount' && selected}
			<button onclick={confirm}
			        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80"
			        style="background: #FB923C; color: #fff">
				{t.nutrition_apply}
			</button>
		{/if}
	</div>
</div>

{#if scannerOpen}
	<BarcodeScanner rawMode onFound={onScan} onClose={() => (scannerOpen = false)} />
{/if}
