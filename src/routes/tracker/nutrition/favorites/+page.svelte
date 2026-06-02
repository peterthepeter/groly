<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import MealFavoriteEditSheet from '$lib/components/supplements/MealFavoriteEditSheet.svelte';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { getNutritionCategoryIcon } from '$lib/nutritionCategoryIcons';

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
		defaultAmount: number;
		defaultUnit: 'g' | 'ml' | 'piece';
		defaultGramsPerPiece: number | null;
		useCount: number;
		lastUsedAt: number | null;
	};

	let { data } = $props();
	let menuOpen = $state(false);
	let favorites = $state<Favorite[]>([]);
	let loading = $state(true);
	let editing = $state<Favorite | null>(null);
	let editName = $state('');
	let editAmount = $state('');
	let editUnit = $state<'g' | 'ml' | 'piece'>('g');
	let editGpp = $state('');
	let favSaving = $state(false);
	let favSaved = $state(false);

	type MealComponent = {
		id?: string;
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
		imageUrl: string | null;
		caffeineDrinkId: string | null;
		useCount: number;
		lastUsedAt: number | null;
		components: MealComponent[];
	};
	let mealFavorites = $state<MealFavorite[]>([]);
	let editingMeal = $state<MealFavorite | null>(null);
	let newMealOpen = $state(false);

	async function loadMealFavorites() {
		try {
			const res = await fetch('/api/nutrition/meal-favorites');
			if (res.ok) {
				const d = await res.json();
				mealFavorites = d.mealFavorites ?? [];
			}
		} catch { /* ignore */ }
	}

	function startEditMeal(f: MealFavorite) {
		editingMeal = f;
	}

	async function deleteMealFav(id: string) {
		if (!confirm(t.nutrition_confirm_delete_meal_favorite)) return;
		const res = await fetch(`/api/nutrition/meal-favorites/${id}`, { method: 'DELETE' });
		if (res.ok) {
			if (editingMeal?.id === id) editingMeal = null;
			await loadMealFavorites();
		}
	}

	async function load() {
		loading = true;
		try {
			const res = await fetch('/api/nutrition/favorites');
			if (res.ok) {
				const d = await res.json();
				favorites = (d.favorites ?? []).sort((a: Favorite, b: Favorite) => {
					const ua = a.useCount ?? 0;
					const ub = b.useCount ?? 0;
					if (ub !== ua) return ub - ua;
					return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0);
				});
			}
		} finally { loading = false; }
	}

	onMount(() => { void load(); void loadMealFavorites(); });

	function startEdit(f: Favorite) {
		editing = f;
		editName = f.displayName;
		editAmount = String(f.defaultAmount);
		editUnit = f.defaultUnit;
		editGpp = f.defaultGramsPerPiece != null ? String(f.defaultGramsPerPiece) : '';
		// Kein gespeicherter Nährwert-Snapshot (z.B. Produkt vor dem Laden favorisiert)?
		// Dann live nachladen – wie die Amount-Ansicht – damit kcal + Makros auch hier erscheinen.
		if (f.customKcalPer100 == null) void hydrateNutrition(f);
	}

	async function hydrateNutrition(f: Favorite) {
		try {
			let n: { kcalPer100: number | null; proteinPer100: number | null; fatPer100: number | null; carbsPer100: number | null } | null = null;
			if (f.productBarcode) {
				const res = await fetch(`/api/nutrition/product/${encodeURIComponent(f.productBarcode)}`);
				if (res.ok) n = (await res.json()).product ?? null;
			} else if (f.genericFoodId) {
				const res = await fetch(`/api/nutrition/search?q=${encodeURIComponent(f.genericFoodId)}&lang=${currentLang()}&source=local`);
				if (res.ok) n = ((await res.json()).generic ?? []).find((x: { id: string }) => x.id === f.genericFoodId) ?? null;
			}
			// Nur übernehmen, wenn noch dieselbe Favoritenkarte offen ist.
			if (!n || !editing || editing.id !== f.id) return;
			editing = {
				...editing,
				customKcalPer100: editing.customKcalPer100 ?? n.kcalPer100,
				customProteinPer100: editing.customProteinPer100 ?? n.proteinPer100,
				customFatPer100: editing.customFatPer100 ?? n.fatPer100,
				customCarbsPer100: editing.customCarbsPer100 ?? n.carbsPer100
			};
		} catch { /* noop */ }
	}

	// Effektive Gramm der aktuellen Eingabe (bei Stück = Menge × Gramm/Stück) –
	// für die Live-kcal-/Makro-Anzeige in der Edit-Bubble.
	function editEffectiveGrams(): number {
		const amt = parseFloat(String(editAmount).replace(',', '.')) || 0;
		if (editUnit === 'piece') return amt * (parseFloat(String(editGpp).replace(',', '.')) || 0);
		return amt;
	}

	async function saveEdit() {
		if (!editing || favSaving) return;
		favSaving = true;
		const payload = {
			displayName: editName.trim(),
			defaultAmount: parseFloat(String(editAmount).replace(',', '.')),
			defaultUnit: editUnit,
			defaultGramsPerPiece: editGpp ? parseFloat(String(editGpp).replace(',', '.')) : null
		};
		let ok = false;
		try {
			const res = await fetch(`/api/nutrition/favorites/${editing.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			ok = res.ok;
		} finally {
			favSaving = false;
		}
		if (ok) {
			favSaved = true;
			void load();
			setTimeout(() => { editing = null; favSaved = false; }, 650);
		}
	}

	async function deleteFav(id: string) {
		if (!confirm(t.nutrition_confirm_delete_favorite)) return;
		const res = await fetch(`/api/nutrition/favorites/${id}`, { method: 'DELETE' });
		if (res.ok) {
			if (editing?.id === id) editing = null;
			await load();
		}
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

<AppHeader title={t.nutrition_favorites_label} eyebrow={t.nutrition_label_short} onMenuOpen={() => (menuOpen = true)} onBack={() => goto('/tracker/nutrition')} />
<HamburgerMenu bind:open={menuOpen} user={data?.user ?? null} />

<main class="px-4 pb-32" style="padding-top: 5.25rem">
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
			     style="border-color: #FB923C; border-top-color: transparent"></div>
		</div>
	{:else}
		<h2 class="text-[11px] uppercase tracking-wide mb-2 mt-1" style="color: var(--color-on-surface-variant)">{t.nutrition_ingredients}</h2>
		{#if favorites.length === 0}
			<p class="text-sm mb-7" style="color: var(--color-on-surface-variant)">{t.nutrition_no_favorites_yet}</p>
		{:else}
		<div class="rounded-2xl overflow-hidden mb-8"
		     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			{#each favorites as f, i (f.id)}
				{#if i > 0}
					<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
				{/if}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="px-3 py-2.5 flex items-center gap-3 cursor-pointer active:opacity-80" onclick={() => startEdit(f)}>
					{#if f.imageUrl}
						<img src={f.imageUrl} alt="" class="w-9 h-9 rounded-lg object-cover bg-black/5 shrink-0" />
					{:else if f.genericFoodId && f.category}
						<div class="w-9 h-9 rounded-lg flex items-center justify-center shrink-0">
							{@render catIcon(f.category, 28)}
						</div>
					{:else}
						<div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
						     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
							{f.displayName.slice(0, 1).toUpperCase()}
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{f.displayName}</div>
						<div class="text-xs" style="color: var(--color-on-surface-variant)">
							{f.defaultAmount}{f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}
							· {f.useCount}× {t.nutrition_used}
						</div>
					</div>
					<button onclick={(e) => { e.stopPropagation(); deleteFav(f.id); }}
					        class="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60 shrink-0"
					        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_remove}>
						<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6"/>
							<path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
		{/if}

		<div class="flex items-center justify-between mb-2 mt-2">
			<h2 class="text-[11px] uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.nutrition_meal_favorites_section}</h2>
			<button onclick={() => (newMealOpen = true)}
			        class="text-xs font-medium px-2.5 py-1 rounded-full active:opacity-70"
			        style="border: 1px solid var(--bubble-interactive-border); color: #FB923C">
				+ {t.nutrition_new_meal_favorite}
			</button>
		</div>
		{#if mealFavorites.length === 0}
			<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.nutrition_no_meal_favorites}</p>
		{:else}
			<div class="rounded-2xl overflow-hidden"
			     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				{#each mealFavorites as f, i (f.id)}
					{#if i > 0}
						<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
					{/if}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="px-3 py-2.5 flex items-center gap-3 cursor-pointer active:opacity-80" onclick={() => startEditMeal(f)}>
						{#if f.imageUrl}
							<img src={f.imageUrl} alt="" class="w-9 h-9 rounded-lg object-cover bg-black/5 shrink-0" />
						{:else}
							<div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-semibold shrink-0"
							     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
								{f.displayName.slice(0, 1).toUpperCase()}
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{f.displayName}</div>
							<div class="text-xs" style="color: var(--color-on-surface-variant)">
								{f.components.length} {t.nutrition_ingredients} · {f.useCount}× {t.nutrition_used}
							</div>
						</div>
						<button onclick={(e) => { e.stopPropagation(); deleteMealFav(f.id); }}
						        class="w-8 h-8 rounded-lg flex items-center justify-center active:opacity-60 shrink-0"
						        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_remove}>
							<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/>
							</svg>
						</button>
					</div>
				{/each}
			</div>
		{/if}
	{/if}
</main>

<AppBottomNav activeTab="tracker" showFab={false} />

{#if newMealOpen}
	<MealFavoriteEditSheet
		onclose={() => (newMealOpen = false)}
		onsaved={() => { newMealOpen = false; void loadMealFavorites(); }}
	/>
{/if}

{#if editingMeal}
	<MealFavoriteEditSheet
		existing={editingMeal}
		onclose={() => (editingMeal = null)}
		onsaved={() => { editingMeal = null; void loadMealFavorites(); }}
	/>
{/if}

{#if editing}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[55]" style="background: rgba(0,0,0,0.5)" onclick={() => (editing = null)}></div>
	<div class="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
	     style="background-color: var(--modal-bg); max-height: 92dvh">
		<div class="flex justify-center pt-3 pb-1 shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
		</div>
		<div class="px-5 pb-2 shrink-0">
			<p class="font-bold text-lg" style="color: #FB923C">{t.nutrition_edit}</p>
		</div>
		<div class="overflow-y-auto px-5 py-2" style="min-height: 0">
			<div class="rounded-2xl mb-3"
			     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<!-- Kopf: Bild/Icon + Name + kcal/100 -->
				<div class="px-3 py-2.5 flex gap-2.5 items-center">
					{#if editing.imageUrl}
						<img src={editing.imageUrl} alt="" class="w-10 h-10 rounded-lg object-cover bg-black/5 shrink-0" />
					{:else if editing.genericFoodId && editing.category}
						<div class="w-10 h-10 rounded-lg flex items-center justify-center shrink-0">
							{@render catIcon(editing.category, 32)}
						</div>
					{:else}
						<div class="w-10 h-10 rounded-lg flex items-center justify-center text-base shrink-0"
						     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
							{editing.displayName.slice(0, 1).toUpperCase()}
						</div>
					{/if}
					<div class="flex-1 min-w-0">
						<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{editing.displayName}</div>
						<div class="text-xs" style="color: var(--color-on-surface-variant)">
							{editing.customKcalPer100 != null ? `${Math.round(editing.customKcalPer100)} kcal/100g` : t.nutrition_no_kcal_data}
						</div>
					</div>
				</div>

				<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>

				<!-- Name -->
				<div class="px-3 py-2.5 flex items-center gap-2">
					<span class="text-[11px] uppercase tracking-wide shrink-0" style="color: var(--color-on-surface-variant)">{t.nutrition_name}</span>
					<input type="text" bind:value={editName}
					       class="flex-1 min-w-0 px-2.5 rounded-xl bg-transparent outline-none"
					       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px" />
				</div>

				<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>

				<!-- Menge + Einheit + kcal-Ergebnis -->
				<div class="px-3 py-2.5 flex items-center gap-2">
					<span class="text-[11px] uppercase tracking-wide shrink-0" style="color: var(--color-on-surface-variant)">{t.nutrition_amount}</span>
					<input type="number" inputmode="decimal" bind:value={editAmount} min="0" step="any"
					       class="flex-1 min-w-0 px-2.5 rounded-xl bg-transparent outline-none tabular-nums"
					       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px" />
					<select bind:value={editUnit}
					        class="px-2 rounded-xl bg-transparent outline-none appearance-none shrink-0"
					        style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px">
						<option value="g">g</option>
						<option value="ml">ml</option>
						<option value="piece">{t.nutrition_unit_piece}</option>
					</select>
					{#if editing.customKcalPer100 != null}
						<span class="text-base font-semibold tabular-nums shrink-0" style="color: #FB923C">
							= {Math.round((editing.customKcalPer100 ?? 0) * editEffectiveGrams() / 100)} kcal
						</span>
					{/if}
				</div>

				{#if editUnit === 'piece'}
					<div class="px-3 pb-2 -mt-1 flex items-center gap-2">
						<span class="text-[11px] uppercase tracking-wide shrink-0" style="color: var(--color-on-surface-variant)">{t.nutrition_grams_per_piece}</span>
						<input type="number" inputmode="decimal" bind:value={editGpp} min="0" step="any"
						       class="flex-1 min-w-0 px-2.5 rounded-xl bg-transparent outline-none tabular-nums"
						       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 36px" />
					</div>
				{/if}

				{#if editing.customKcalPer100 != null}
					<div class="px-3 pb-2.5 text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
						{t.nutrition_protein} {((editing.customProteinPer100 ?? 0) * editEffectiveGrams() / 100).toFixed(1)}g
						· {t.nutrition_fat} {((editing.customFatPer100 ?? 0) * editEffectiveGrams() / 100).toFixed(1)}g
						· {t.nutrition_carbs} {((editing.customCarbsPer100 ?? 0) * editEffectiveGrams() / 100).toFixed(1)}g
					</div>
				{/if}
			</div>
		</div>
		<div class="px-5 pt-2 shrink-0 flex gap-2" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
			<button onclick={() => (editing = null)}
			        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
			        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
				{t.nutrition_cancel}
			</button>
			<button onclick={saveEdit} disabled={favSaving || favSaved}
			        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-100 flex items-center justify-center gap-1.5"
			        style="background: {favSaved ? '#22C55E' : '#FB923C'}; color: #fff; transition: background-color 0.2s">
				{#if favSaved}
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
				{:else}
					{favSaving ? '…' : t.nutrition_save}
				{/if}
			</button>
		</div>
	</div>
{/if}
