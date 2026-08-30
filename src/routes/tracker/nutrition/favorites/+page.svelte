<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import MealFavoriteEditSheet from '$lib/components/supplements/MealFavoriteEditSheet.svelte';
	import AddComponentSheet from '$lib/components/supplements/AddComponentSheet.svelte';
	import ManageSheetShell from '$lib/components/supplements/ManageSheetShell.svelte';
	import NutritionFoodRow from '$lib/components/supplements/NutritionFoodRow.svelte';
	import NutritionMacroStrip from '$lib/components/supplements/NutritionMacroStrip.svelte';
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
		customSugarPer100: number | null;
		customFiberPer100: number | null;
		customSaltPer100: number | null;
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
	let newIngredientOpen = $state(false);

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
		if (!confirm(t.nutrition_confirm_delete_meal_favorite)) return false;
		const res = await fetch(`/api/nutrition/meal-favorites/${id}`, { method: 'DELETE' });
		if (res.ok) {
			if (editingMeal?.id === id) editingMeal = null;
			await loadMealFavorites();
		}
		return res.ok;
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
			let n: { kcalPer100: number | null; proteinPer100: number | null; fatPer100: number | null; carbsPer100: number | null; sugarPer100?: number | null; fiberPer100?: number | null; saltPer100?: number | null } | null = null;
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
				customCarbsPer100: editing.customCarbsPer100 ?? n.carbsPer100,
				customSugarPer100: editing.customSugarPer100 ?? n.sugarPer100 ?? null,
				customFiberPer100: editing.customFiberPer100 ?? n.fiberPer100 ?? null,
				customSaltPer100: editing.customSaltPer100 ?? n.saltPer100 ?? null
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
		if (!confirm(t.nutrition_confirm_delete_favorite)) return false;
		const res = await fetch(`/api/nutrition/favorites/${id}`, { method: 'DELETE' });
		if (res.ok) {
			if (editing?.id === id) editing = null;
			await load();
		}
		return res.ok;
	}

	const editMacroItems = $derived(editing ? [
		{ label: t.nutrition_protein, value: (editing.customProteinPer100 ?? 0) * editEffectiveGrams() / 100 },
		{ label: t.nutrition_fat, value: (editing.customFatPer100 ?? 0) * editEffectiveGrams() / 100 },
		{ label: t.nutrition_carbs, value: (editing.customCarbsPer100 ?? 0) * editEffectiveGrams() / 100 },
		{ label: t.nutrition_fiber, value: (editing.customFiberPer100 ?? 0) * editEffectiveGrams() / 100 }
	] : []);
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
		<div class="nutrition-section-heading">
			<h2 class="nutrition-section-title">{t.nutrition_ingredients}</h2>
			<button onclick={() => (newIngredientOpen = true)} class="nutrition-new-template">+ {t.nutrition_new_ingredient}</button>
		</div>
		{#if favorites.length === 0}
			<p class="nutrition-empty-copy">{t.nutrition_no_favorites_yet}</p>
		{:else}
		<div class="nutrition-list-surface">
			{#each favorites as f (f.id)}
				{#if !f.imageUrl && f.genericFoodId && f.category}
					{#snippet favoriteIcon()}{@render catIcon(f.category, 27)}{/snippet}
					<NutritionFoodRow title={f.displayName} meta={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} trailing={`${f.useCount}× ${t.nutrition_used}`} leading={favoriteIcon} onactivate={() => startEdit(f)} />
				{:else}
					<NutritionFoodRow title={f.displayName} meta={`${f.defaultAmount}${f.defaultUnit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : f.defaultUnit}`} trailing={`${f.useCount}× ${t.nutrition_used}`} imageUrl={f.imageUrl} onactivate={() => startEdit(f)} />
				{/if}
			{/each}
		</div>
		{/if}

		<div class="nutrition-section-heading">
			<h2 class="nutrition-section-title">{t.nutrition_meal_favorites_section}</h2>
			<button onclick={() => (newMealOpen = true)}
			        class="nutrition-new-template">
				+ {t.nutrition_new_meal_favorite}
			</button>
		</div>
		{#if mealFavorites.length === 0}
			<p class="nutrition-empty-copy">{t.nutrition_no_meal_favorites}</p>
		{:else}
			<div class="nutrition-list-surface">
				{#each mealFavorites as f (f.id)}
					<NutritionFoodRow title={f.displayName} meta={`${f.components.length} ${t.nutrition_ingredients}`} trailing={`${f.useCount}× ${t.nutrition_used}`} imageUrl={f.imageUrl} onactivate={() => startEditMeal(f)} />
				{/each}
			</div>
		{/if}
	{/if}
</main>

<AppBottomNav activeTab="tracker" trackerBack showFab={false} />

{#if newIngredientOpen}
	<AddComponentSheet
		favoriteMode
		onclose={() => (newIngredientOpen = false)}
		onadd={() => { newIngredientOpen = false; void load(); }}
	/>
{/if}

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
		ondelete={async () => { if (editingMeal && await deleteMealFav(editingMeal.id)) editingMeal = null; }}
	/>
{/if}

{#if editing}
	{@const currentFavorite = editing}
	<ManageSheetShell accent="#FB923C" title={t.nutrition_edit} subtitle={currentFavorite.customKcalPer100 != null ? `${Math.round(currentFavorite.customKcalPer100)} kcal/100g` : t.nutrition_no_kcal_data} onclose={() => (editing = null)} zIndex={60} maxHeight="92dvh">
		{#snippet body()}
			<div class="manage-stack">
				<section class="nutrition-favorite-identity">
					{#if currentFavorite.imageUrl}<img src={currentFavorite.imageUrl} alt="" />{:else if currentFavorite.genericFoodId && currentFavorite.category}<span class="nutrition-category-icon">{@render catIcon(currentFavorite.category, 31)}</span>{:else}<span>{currentFavorite.displayName.slice(0, 1).toUpperCase()}</span>{/if}
					<strong>{currentFavorite.displayName}</strong>
				</section>
				<div>
					<span class="manage-section-title">{t.nutrition_portion_section}</span>
					<section class="manage-settings-surface">
						<label class="manage-settings-row nutrition-edit-row"><span class="manage-settings-label">{t.nutrition_name}</span><input type="text" bind:value={editName} class="manage-settings-input" /></label>
						<div class="manage-settings-row nutrition-amount-row">
							<span class="manage-settings-label">{t.nutrition_amount}</span>
							<input type="number" inputmode="decimal" bind:value={editAmount} min="0" step="any" class="manage-settings-input" />
							<select bind:value={editUnit} class="nutrition-unit-select"><option value="g">g</option><option value="ml">ml</option><option value="piece">{t.nutrition_unit_piece}</option></select>
						</div>
						{#if editUnit === 'piece'}<label class="manage-settings-row nutrition-edit-row"><span class="manage-settings-label">{t.nutrition_grams_per_piece}</span><input type="number" inputmode="decimal" bind:value={editGpp} min="0" step="any" class="manage-settings-input" /></label>{/if}
					</section>
				</div>
				{#if currentFavorite.customKcalPer100 != null}
					<section class="manage-section nutrition-favorite-summary"><strong>{Math.round(currentFavorite.customKcalPer100 * editEffectiveGrams() / 100)} kcal</strong><NutritionMacroStrip items={editMacroItems} /></section>
				{/if}
				<button type="button" class="manage-danger nutrition-delete-action" onclick={async () => { if (await deleteFav(editing!.id)) editing = null; }}>{t.nutrition_delete_favorite}</button>
			</div>
		{/snippet}
		{#snippet footer()}
			<button type="button" class="manage-secondary" onclick={() => (editing = null)}>{t.nutrition_cancel}</button>
			<button type="button" class="manage-primary disabled:opacity-40" onclick={saveEdit} disabled={favSaving || favSaved || !editName.trim()}>{favSaving ? '…' : t.nutrition_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}

<style>
	.nutrition-section-title { margin: 4px 2px 7px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 650; letter-spacing: .08em; text-transform: uppercase; }
	.nutrition-empty-copy { margin: 0 2px 28px; color: var(--color-on-surface-variant); font-size: 13px; }
	.nutrition-list-surface { margin-bottom: 28px; overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.nutrition-list-surface :global(.nutrition-food-row + .nutrition-food-row) { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-section-heading { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.nutrition-new-template { min-height: 36px; padding-inline: 10px; border-radius: 999px; color: #FB923C; font-size: 12px; font-weight: 650; }
	.nutrition-favorite-identity { display: flex; min-height: 54px; align-items: center; gap: 11px; padding: 8px 10px; border: 1px solid var(--bubble-container-border); border-radius: 14px; background: var(--bubble-container-bg); }
	.nutrition-favorite-identity img, .nutrition-favorite-identity > span { display: flex; width: 38px; height: 38px; flex: none; align-items: center; justify-content: center; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; font-size: 13px; font-weight: 700; }
	.nutrition-favorite-identity .nutrition-category-icon { background: transparent; }
	.nutrition-favorite-identity strong { overflow: hidden; color: var(--color-on-surface); font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-edit-row { display: grid; grid-template-columns: minmax(0, .65fr) minmax(0, 1.35fr); align-items: center; gap: 12px; }
	.nutrition-amount-row { display: grid; grid-template-columns: minmax(0, .65fr) minmax(64px, 1fr) auto; align-items: center; gap: 10px; }
	.nutrition-unit-select { height: 36px; max-width: 78px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 650; }
	.nutrition-favorite-summary { display: grid; gap: 9px; padding: 10px; }
	.nutrition-favorite-summary > strong { color: #FB923C; font-size: 19px; font-weight: 720; font-variant-numeric: tabular-nums; }
	.nutrition-delete-action { width: 100%; min-height: 40px; }
</style>
