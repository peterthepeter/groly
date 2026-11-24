<script lang="ts">
	import { Folder, Pencil, Tag, X } from '@lucide/svelte';
	import RecipeCategoryAssignmentSheet from '#lib/components/recipe/RecipeCategoryAssignmentSheet.svelte';
	import type { RecipeCategory, RecipeCategoryChoice } from '#lib/recipeCategories';
	import { recipeCategoryErrorMessage } from '#lib/recipeCategoryUi';
	import { displayDate } from '#lib/dateDisplay';
	import { flushSync, onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { t, currentLang } from '#lib/i18n.svelte';
	import { scaleAmount, type Recipe } from '#lib/recipeUtils';
	import RecipeShareModal from '#lib/components/recipe/RecipeShareModal.svelte';
	import RecipeAddToListModal from '#lib/components/recipe/RecipeAddToListModal.svelte';
	import RecipeNutritionSheet from '#lib/components/recipe/RecipeNutritionSheet.svelte';
	import RecipeTrackSheet from '#lib/components/recipe/RecipeTrackSheet.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import UnavailableView from '#lib/components/UnavailableView.svelte';
	import { cacheRecipeCategoryAssignment, cacheRecipeDetail, getOfflineRecipeCategories, getOfflineRecipeDetail, fetchWithTimeout } from '#lib/sync/manager';
	import { userSettings } from '#lib/userSettings.svelte';
	import { acquireWakeLock, releaseWakeLock } from '#lib/wakeLock';

	let wakeLockHeld = false;

	let recipe = $state<Recipe | null>(null);
	let loading = $state(true);
	let activeTab = $state<'zutaten' | 'anleitung'>('zutaten');
	let currentServings = $state(4);
	let originalServings = $state(4);

	let shareModalOpen = $state(false);
	let listModalOpen = $state(false);
	let categorySheetOpen = $state(false);
	let isOfflineFallback = $state(false);
	let offlineUnavailable = $state(false);

	let excludedIngredients = $state(new Set<string>());
	let exclusionsSaving = $state(false);
	let exclusionsLoading = $state(true);
	let exclusionsLoaded = $state(false);
	let exclusionsLoadError = $state(false);
	let exclusionsSaveError = $state(false);
	let pendingExclusions: { recipeId: string; excludedIds: string[] } | null = null;
	let cookSaving = $state(false);

	// Nutrition-Tracking
	type NutComp = {
		productBarcode: string | null; genericFoodId: string | null; customName: string | null;
		displayName: string; imageUrl: string | null; amount: number; unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null; kcalPer100: number | null; proteinPer100: number | null;
		fatPer100: number | null; carbsPer100: number | null; sugarPer100: number | null;
		fiberPer100: number | null; saltPer100: number | null; skipped?: boolean;
	};
	let nutMapped = $state(false);
	let nutStale = $state(false);
	let nutComponents = $state<NutComp[]>([]);
	let nutMappedServings = $state(4);
	let nutritionSheetOpen = $state(false);
	let trackSheetOpen = $state(false);
	let nutToast = $state<string | null>(null);
	let nutToastTimer: ReturnType<typeof setTimeout> | null = null;

	const usableComponents = $derived(nutComponents.filter((c) => !c.skipped));
	const nutPerPortionKcal = $derived.by(() => {
		if (!nutMapped || nutMappedServings <= 0) return 0;
		const total = usableComponents.reduce((s, c) => {
			const grams = c.unit === 'piece' ? c.amount * (c.gramsPerPiece ?? 0) : c.amount;
			return s + ((c.kcalPer100 ?? 0) * grams) / 100;
		}, 0);
		return Math.round(total / nutMappedServings);
	});

	async function loadNutrition() {
		if (isOfflineFallback || !userSettings.nutritionTrackerEnabled) return;
		try {
			const res = await fetch(`/api/nutrition/recipe-components?recipeId=${recipeId}`);
			if (!res.ok) return;
			const d = await res.json();
			nutMapped = !!d.mapped;
			nutStale = !!d.stale;
			nutMappedServings = d.mappedServings ?? recipe?.servings ?? 4;
			nutComponents = (d.components ?? []).map((c: NutComp) => ({ ...c }));
		} catch { /* offline */ }
	}

	// Topf-Button ist kontextabhängig, wenn der Nutrition-Tracker an ist:
	//  - Nährwerte hinterlegt → Portionen tracken (zählt beim Bestätigen auch „gekocht")
	//  - noch nicht hinterlegt → Zuordnung öffnen („Nährwerte hinterlegen")
	// Tracker aus → reines „gekocht" wie bisher.
	const nutTrackerActive = $derived(!isOfflineFallback && userSettings.nutritionTrackerEnabled);
	function onCookButton() {
		if (!nutTrackerActive) { void logCooked(); return; }
		if (nutMapped && usableComponents.length > 0) trackSheetOpen = true;
		else nutritionSheetOpen = true;
	}
	const cookLabel = $derived(
		!nutTrackerActive
			? t.recipe_cooked_today
			: (nutMapped && usableComponents.length > 0 ? t.recipe_track_button : t.recipe_nutrition_title)
	);

	function onTracked(kcal: number) {
		void logCooked();
		if (nutToastTimer) clearTimeout(nutToastTimer);
		nutToast = `${t.recipe_nutrition_tracked} · ${kcal} kcal`;
		nutToastTimer = setTimeout(() => (nutToast = null), 2600);
	}
	let tagInput = $state('');
	let tagField = $state<HTMLInputElement>();
	let editingTags = $state(false);
	let actionMenuOpen = $state(false);
	let ratingPopupOpen = $state(false);

	function showActionMenu(dialog: HTMLDialogElement) {
		dialog.showModal();
	}

	function formatLastCooked(ts: number | null | undefined): string {
		if (!ts) return '';
		return displayDate(new Date(ts), { day: 'numeric', month: 'short' }, currentLang() === 'de' ? 'de-DE' : 'en-US');
	}

	function buildPutBody(overrides: Record<string, unknown> = {}) {
		if (!recipe) return null;
		return {
			title: recipe.title,
			description: recipe.description,
			imageUrl: recipe.imageUrl,
			sourceUrl: recipe.sourceUrl,
			servings: recipe.servings,
			prepTime: recipe.prepTime,
			cookTime: recipe.cookTime,
			rating: recipe.rating ?? null,
			tags: recipe.tags ?? [],
			...overrides
		};
	}

	async function saveRecipeCategory(choice: RecipeCategoryChoice) {
		const id = recipeId;
		const userId = page.data.user?.id ?? null;
		const response = await fetch(`/api/recipes/${id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ category: choice })
		}).catch(() => null);
		const result = await response?.json().catch(() => null);
		if (!response?.ok || !result) {
			throw new Error(recipeCategoryErrorMessage(result?.code) ?? t.recipe_categories_save_error);
		}
		const { category, updatedAt }: { category: RecipeCategory | null; updatedAt: number } = result;
		if (recipe?.id === id) recipe = { ...recipe, categoryId: category?.id ?? null, categoryName: category?.name ?? null };
		void cacheRecipeCategoryAssignment(id, category, updatedAt, userId).catch(() => {});
	}

	async function setRating(value: number) {
		if (!recipe) return;
		const next = recipe.rating === value ? null : value;
		const prev = recipe.rating;
		recipe = { ...recipe, rating: next };
		try {
			await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPutBody({ rating: next }))
			});
		} catch {
			recipe = recipe ? { ...recipe, rating: prev ?? null } : recipe;
		}
	}

	async function logCooked() {
		if (!recipe || cookSaving) return;
		cookSaving = true;
		try {
			const res = await fetch(`/api/recipes/${recipeId}/cook`, { method: 'POST' });
			if (res.ok) {
				const data = await res.json();
				recipe = { ...recipe, cookCount: data.cookCount ?? (recipe.cookCount ?? 0) + 1, lastCookedAt: data.lastCookedAt ?? Date.now() };
			}
		} catch {} finally {
			cookSaving = false;
		}
	}

	async function undoCooked() {
		if (!recipe || cookSaving || !(recipe.cookCount && recipe.cookCount > 0)) return;
		cookSaving = true;
		try {
			const res = await fetch(`/api/recipes/${recipeId}/cook`, { method: 'DELETE' });
			if (res.ok) {
				const data = await res.json();
				recipe = { ...recipe, cookCount: data.cookCount ?? Math.max((recipe.cookCount ?? 1) - 1, 0) };
			}
		} catch {} finally {
			cookSaving = false;
		}
	}

	function openTagEditor() {
		flushSync(() => { actionMenuOpen = false; editingTags = true; });
		tagField?.focus({ preventScroll: true });
		tagField?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	async function addTag() {
		if (!recipe) return;
		const value = tagInput.trim();
		if (!value) return;
		const current = recipe.tags ?? [];
		if (current.some((t) => t.toLowerCase() === value.toLowerCase())) {
			tagInput = '';
			return;
		}
		const nextTags = [...current, value];
		recipe = { ...recipe, tags: nextTags };
		tagInput = '';
		try {
			await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPutBody({ tags: nextTags }))
			});
		} catch {}
	}

	async function removeTag(tag: string) {
		if (!recipe) return;
		const nextTags = (recipe.tags ?? []).filter((t) => t !== tag);
		recipe = { ...recipe, tags: nextTags };
		try {
			await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPutBody({ tags: nextTags }))
			});
		} catch {}
	}

	async function loadExclusions() {
		exclusionsLoading = true;
		exclusionsLoadError = false;
		try {
			const res = await fetchWithTimeout(`/api/recipes/${recipeId}/exclusions`);
			if (!res.ok) throw new Error('Selection unavailable');
			const data = await res.json();
			excludedIngredients = new Set(data.excludedIds);
			exclusionsLoaded = true;
		} catch {
			exclusionsLoadError = true;
		} finally {
			exclusionsLoading = false;
		}
	}

	async function saveExclusions(excluded: Set<string>) {
		pendingExclusions = { recipeId, excludedIds: [...excluded] };
		if (exclusionsSaving) return;
		exclusionsSaving = true;
		exclusionsSaveError = false;
		try {
			// The endpoint replaces the full selection. Serialize writes and
			// coalesce changes made while a previous request is in flight.
			while (pendingExclusions) {
				const next = pendingExclusions;
				pendingExclusions = null;
				try {
					const response = await fetchWithTimeout(`/api/recipes/${next.recipeId}/exclusions`, {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ excludedIds: next.excludedIds })
					});
					if (!response.ok) throw new Error('Selection could not be saved');
				} catch {
					pendingExclusions ??= next;
					throw new Error('Selection could not be saved');
				}
			}
		} catch {
			exclusionsSaveError = true;
		} finally {
			exclusionsSaving = false;
		}
	}

	function toggleIngredient(id: string) {
		const next = new Set(excludedIngredients);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		excludedIngredients = next;
		saveExclusions(next);
	}

	const selectedCount = $derived(
		recipe ? recipe.ingredients.filter(i => !excludedIngredients.has(i.id)).length : 0
	);

	const recipeId = $derived(page.params.id ?? '');

	async function loadRecipe() {
		const cacheUserId = page.data.user?.id ?? null;
		loading = true;
		offlineUnavailable = false;
		isOfflineFallback = false;
		try {
			const res = await fetch(`/api/recipes/${recipeId}`);
			if (!res.ok) { goto('/rezepte'); return; }
			const data = await res.json();
			recipe = data;
			currentServings = data.servings;
			originalServings = data.servings;
			cacheRecipeDetail(data, cacheUserId).catch(() => {});
			await loadExclusions();
		} catch {
			exclusionsLoading = false;
			exclusionsLoadError = true;
			const [cached, categories] = await Promise.all([getOfflineRecipeDetail(recipeId), getOfflineRecipeCategories(cacheUserId)]);
			if (cached) {
				recipe = {
					...cached as Recipe,
					categoryName: cached.categoryId === undefined && cached.isFavorite ? t.recipes_favorites
						: categories ? categories.find(category => category.id === cached.categoryId)?.name ?? null
							: cached.categoryName
				};
				currentServings = cached.servings;
				originalServings = cached.servings;
				isOfflineFallback = true;
			} else {
				offlineUnavailable = true;
			}
		}
		loading = false;
	}

	// Servings auto-save
	let servingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let servingsSaved = $state(false);

	function changeServings(delta: number) {
		const next = currentServings + delta;
		if (next < 1) return;
		currentServings = next;
		if (servingsSaveTimer) clearTimeout(servingsSaveTimer);
		servingsSaveTimer = setTimeout(() => saveServings(next), 800);
	}

	async function saveServings(servings: number) {
		if (!recipe) return;
		try {
			const scaledIngredients = recipe.ingredients.map(i => ({
				id: i.id,
				amount: scaleAmount(i.amount, servings, originalServings) ?? i.amount,
				unit: i.unit,
				name: i.name
			}));
			const res = await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: recipe.title,
					description: recipe.description,
					imageUrl: recipe.imageUrl,
					sourceUrl: recipe.sourceUrl,
					servings,
					prepTime: recipe.prepTime,
					cookTime: recipe.cookTime,
					ingredients: scaledIngredients,
					steps: recipe.steps.map(s => ({ text: s.text }))
				})
			});
			if (res.ok) {
				recipe = {
					...recipe,
					servings,
					ingredients: recipe.ingredients.map((i, idx) => ({ ...i, amount: scaledIngredients[idx].amount }))
				};
				originalServings = servings;
				servingsSaved = true;
				setTimeout(() => servingsSaved = false, 1500);
			}
		} catch {}
	}

	// Inline title editing
	let editingTitle = $state(false);
	let editTitleValue = $state('');

	function startEditTitle() {
		if (!recipe) return;
		editTitleValue = recipe.title;
		editingTitle = true;
	}

	async function saveTitle() {
		if (!recipe) { editingTitle = false; return; }
		const newTitle = editTitleValue.trim();
		editingTitle = false;
		if (!newTitle || newTitle === recipe.title) return;
		try {
			const res = await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					title: newTitle,
					description: recipe.description,
					imageUrl: recipe.imageUrl,
					sourceUrl: recipe.sourceUrl,
					servings: recipe.servings,
					prepTime: recipe.prepTime,
					cookTime: recipe.cookTime,
					ingredients: recipe.ingredients.map(i => ({ id: i.id, amount: i.amount, unit: i.unit, name: i.name })),
					steps: recipe.steps.map(s => ({ text: s.text }))
				})
			});
			if (res.ok) recipe = { ...recipe, title: newTitle };
		} catch {}
	}

	async function deleteRecipe() {
		if (!confirm(t.recipe_confirm_delete)) return;
		const res = await fetch(`/api/recipes/${recipeId}`, { method: 'DELETE' });
		if (res.ok) goto('/rezepte');
	}

	onMount(() => {
		void loadRecipe().then(() => loadNutrition());
		if (userSettings.wakeLockRecipes) { wakeLockHeld = true; void acquireWakeLock(); }
	});

	onDestroy(() => {
		if (wakeLockHeld) void releaseWakeLock();
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden max-w-[430px] mx-auto" style="background-color: var(--color-bg)">

	<div class="flex-1 overflow-y-auto min-h-0" style="padding-bottom: calc(env(safe-area-inset-bottom) + 6rem)">
		{#if loading}
			<div class="flex justify-center py-16">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if offlineUnavailable}
			<UnavailableView title={t.offline_recipe_title} message={t.offline_recipe_message} backHref="/rezepte" backLabel={t.offline_recipes} onRetry={() => void loadRecipe()} />
		{:else if recipe}
			<!-- Hero Image -->
			<div class="relative w-full h-48 flex-shrink-0 overflow-hidden"
			     style="background-color: var(--color-surface-container)">
				{#if recipe.imageUrl}
					<img src={recipe.imageUrl} alt={recipe.title} class="w-full h-full object-cover" />
				{:else}
					<div class="w-full h-full flex items-center justify-center"
					     style="background: linear-gradient(135deg, var(--color-surface-container), var(--color-surface-high))">
						<span class="text-6xl font-bold" style="color: var(--color-primary); font-family: 'Plus Jakarta Sans', sans-serif; opacity: 0.4">
							{recipe.title[0]?.toUpperCase() ?? '?'}
						</span>
					</div>
				{/if}
				<div class="recipe-hero-controls">
					<button type="button" class="recipe-hero-control recipe-hero-back" onclick={() => goto('/rezepte')}
						aria-label={t.a11y_back}>
						<span class="recipe-hero-pill">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
								<polyline points="15 18 9 12 15 6"/>
							</svg>
						</span>
					</button>
					{#if recipe.categoryName}
						{#if isOfflineFallback}
							<span class="recipe-hero-control recipe-hero-category" title={recipe.categoryName}>
								<span class="recipe-hero-pill">{recipe.categoryName}</span>
							</span>
						{:else}
							<button type="button" class="recipe-hero-control recipe-hero-category" onclick={() => categorySheetOpen = true}
								aria-label={`${t.recipe_category_change}: ${recipe.categoryName}`} title={recipe.categoryName}>
								<span class="recipe-hero-pill">{recipe.categoryName}</span>
							</button>
						{/if}
					{/if}
				</div>
			</div>

			<div class="px-4 pt-4">
				<!-- Title (tap to rename) -->
				{#if editingTitle}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={editTitleValue}
						autofocus
						onblur={saveTitle}
						onkeydown={(e) => { if (e.key === 'Enter') saveTitle(); if (e.key === 'Escape') editingTitle = false; }}
						class="w-full bg-transparent outline-none text-xl font-bold mb-1 border-b"
						style="color: var(--color-on-surface); font-size: 16px; border-color: var(--color-primary)"
					/>
				{:else}
					<div class="flex items-start gap-2 mb-1">
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
						<h1
							class="text-xl font-bold cursor-text flex-1 min-w-0"
							style="color: var(--color-on-surface)"
							onclick={startEditTitle}
						>{recipe.title}</h1>
						{#if recipe.sourceUrl}
							<a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
							   class="flex-shrink-0 w-7 h-7 mt-1 rounded-full flex items-center justify-center active:opacity-60"
							   aria-label={t.recipe_original_link}
							   title={t.recipe_original_link}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
									<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
								</svg>
							</a>
						{/if}
					</div>
				{/if}
				{#if recipe.description}
					<p class="text-sm mt-1" style="color: var(--color-on-surface-variant)">{recipe.description}</p>
				{/if}

				<!-- Meta line: rating · nutrition · time -->
				<div class="flex items-center gap-1.5 mt-1 flex-wrap text-xs" style="color: var(--color-on-surface-variant)">
					<!-- Rating (tap opens popup) -->
					<button
						onclick={() => (ratingPopupOpen = true)}
						disabled={isOfflineFallback}
						aria-label={t.recipe_rating}
						class="flex items-center gap-1 active:opacity-60 disabled:opacity-40"
					>
						<svg width="14" height="14" viewBox="0 0 24 24"
						     fill={recipe.rating ? 'var(--color-primary)' : 'none'}
						     stroke={recipe.rating ? 'var(--color-primary)' : 'var(--color-outline)'}
						     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
						</svg>
						{#if recipe.rating}
							<span class="font-semibold" style="color: var(--color-on-surface)">{recipe.rating}</span>
						{:else}
							<span>{t.recipe_rate}</span>
						{/if}
					</button>

					{#if nutTrackerActive && nutMapped && usableComponents.length > 0}
						<span aria-hidden="true">·</span>
						<span class="inline-flex items-center gap-1 whitespace-nowrap">
							{nutPerPortionKcal} kcal {t.recipe_nutrition_per_portion}
							{#if nutStale}
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
							{/if}
						</span>
					{/if}

					{#if recipe.prepTime || recipe.cookTime}
						<span aria-hidden="true">·</span>
						<span class="whitespace-nowrap">{((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0))} {t.recipe_minutes}</span>
					{/if}

					{#if recipe.lastCookedAt}
						<span aria-hidden="true">·</span>
						<span class="whitespace-nowrap">{#if recipe.cookCount && recipe.cookCount > 0}{recipe.cookCount}× · {/if}{formatLastCooked(recipe.lastCookedAt)}</span>
					{/if}

					<!-- Setup prompt: assign nutrition (only while not yet mapped) -->
					{#if nutTrackerActive && !(nutMapped && usableComponents.length > 0)}
						<span aria-hidden="true">·</span>
						<button
							onclick={() => (nutritionSheetOpen = true)}
							disabled={isOfflineFallback}
							class="inline-flex items-center gap-1 font-semibold whitespace-nowrap active:opacity-60 disabled:opacity-40"
							style="color: #FB923C"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
							</svg>
							{t.recipe_nutrition_button}
						</button>
					{/if}
				</div>

				<!-- Action row: servings · more · track · shopping list -->
				<div class="recipe-actions flex items-center gap-y-2 mt-1 flex-wrap">
					<!-- Servings stepper -->
					<button
						onclick={() => changeServings(-1)}
						disabled={currentServings <= 1}
						aria-label={t.a11y_decrease_servings}
						class="w-8 h-10 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
							<line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
					</button>
					<div class="flex items-center gap-1 relative">
						{#if servingsSaved}
							<svg class="absolute -top-2 -right-2 w-3 h-3" viewBox="0 0 24 24" fill="none"
							     stroke="var(--color-primary)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"
							     style="animation: fadeInOut 1.5s ease-in-out forwards">
								<polyline points="20 6 9 17 4 12"/>
							</svg>
						{/if}
						<svg class="recipe-servings-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
						<span class="text-sm font-bold w-5 text-center" style="color: var(--color-on-surface)">{currentServings}</span>
					</div>
					<button
						onclick={() => changeServings(1)}
						aria-label={t.a11y_increase_servings}
						class="w-8 h-10 rounded-full flex items-center justify-center active:opacity-60"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
					</button>

					<button type="button" onclick={() => actionMenuOpen = true} disabled={isOfflineFallback}
						aria-label={t.a11y_more} aria-haspopup="dialog" aria-expanded={actionMenuOpen}
						class="w-8 h-10 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-on-surface-variant)" aria-hidden="true">
							<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
						</svg>
					</button>

					<!-- Track and shopping list actions -->
					<div class="ml-auto flex items-center gap-1.5">
						<!-- Cook / track button (hidden while nutrition still needs mapping — shown as meta prompt instead) -->
						{#if !nutTrackerActive || (nutMapped && usableComponents.length > 0)}
							{@const isTrack = nutTrackerActive && nutMapped && usableComponents.length > 0}
							<button
								onclick={onCookButton}
								disabled={isOfflineFallback || cookSaving}
								aria-label={cookLabel}
								title={cookLabel}
								class="h-11 min-w-11 rounded-full flex items-center justify-center gap-1 active:opacity-70 disabled:opacity-40 active:scale-95 transition-transform {isTrack ? 'recipe-action-labeled' : 'w-8'}"
								style={isTrack
									? 'background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: #FB923C'
									: 'background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)'}
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
								</svg>
								{#if isTrack}
									<span class="text-xs font-semibold whitespace-nowrap">{t.recipe_track_button}</span>
								{/if}
							</button>
						{/if}

						<!-- Shopping list (primary) -->
						{#if recipe.ingredients.length > 0}
							<button
								onclick={(event) => { event.currentTarget.focus({ preventScroll: true }); listModalOpen = true; }}
								aria-label={t.a11y_add_to_list}
								class="recipe-action-labeled flex items-center gap-1.5 h-11 min-w-11 rounded-full text-xs font-semibold active:opacity-70 disabled:opacity-40 active:scale-95 transition-transform"
								style="background-color: var(--color-primary); color: var(--color-on-primary)"
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
								</svg>
								<span>{selectedCount}/{recipe.ingredients.length}</span>
							</button>
						{/if}
					</div>
				</div>

				{#if editingTags}
					<div class="recipe-tags recipe-tags-edit" role="group" aria-label={t.recipe_tags}>
						{#each (recipe.tags ?? []) as tag (tag)}
							<button type="button" class="recipe-tag recipe-tag-remove" onclick={() => removeTag(tag)}
								aria-label={`${t.recipe_tag_remove}: ${tag}`}>
								<span>{tag}</span><X size={12} aria-hidden="true" />
							</button>
						{/each}
						<input type="text" aria-label={t.recipe_tags_placeholder} placeholder={t.recipe_tags_placeholder} autocomplete="off"
							bind:this={tagField} bind:value={tagInput}
							onkeydown={event => {
								if (event.key === 'Enter') { event.preventDefault(); void addTag(); }
								if (event.key === 'Escape') { editingTags = false; tagInput = ''; }
							}} />
						<button type="button" class="recipe-tag-done"
							onclick={async () => { if (tagInput.trim()) await addTag(); editingTags = false; tagInput = ''; }}>
							{t.sort_mode_done}
						</button>
					</div>
				{:else if recipe.tags?.length}
					<div class="recipe-tags recipe-tags-preview" role="group" aria-label={t.recipe_tags}>
						{#each recipe.tags as tag (tag)}<span class="recipe-tag" title={tag}><span>{tag}</span></span>{/each}
					</div>
				{/if}

				<!-- Tabs -->
				<div class="flex gap-1 mt-3 mb-3 p-1 rounded-xl" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					<button
						onclick={() => activeTab = 'zutaten'}
						class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
						style="background-color: {activeTab === 'zutaten' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {activeTab === 'zutaten' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
					>{t.recipe_ingredients} ({recipe.ingredients.length})</button>
					<button
						onclick={() => activeTab = 'anleitung'}
						class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
						style="background-color: {activeTab === 'anleitung' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {activeTab === 'anleitung' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
					>{t.recipe_instructions} ({recipe.steps.length})</button>
				</div>

				<!-- Zutaten -->
				{#if activeTab === 'zutaten'}
					{#if recipe.ingredients.length === 0}
						<p class="text-sm text-center py-6" style="color: var(--color-on-surface-variant)">{t.recipe_no_ingredients}</p>
					{:else}
						<ul class="rounded-xl overflow-hidden" data-recipe-ingredients style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
							{#each recipe.ingredients as ing (ing.id)}
								<li class="flex items-start gap-3 px-4 py-2.5">
									{#if ing.amount || ing.unit}
										<span class="text-sm font-semibold shrink-0 min-w-10 max-w-[35%] text-right break-words tabular-nums" style="color: var(--color-primary)">
											{scaleAmount(ing.amount, currentServings, originalServings) ?? ''}{ing.unit ? '\u00a0' + ing.unit : ''}
										</span>
									{/if}
									<span class="text-sm flex-1 min-w-0 break-words" style="color: var(--color-on-surface)">{ing.name}</span>
								</li>
							{/each}
						</ul>
					{/if}
				{/if}

				<!-- Anleitung -->
				{#if activeTab === 'anleitung'}
					{#if recipe.steps.length === 0}
						<p class="text-sm text-center py-6" style="color: var(--color-on-surface-variant)">{t.recipe_no_steps}</p>
					{:else}
						<div class="space-y-3">
							{#each recipe.steps as step (step.id)}
								<div class="flex gap-3 px-4 py-4 rounded-xl"
								     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
									<div class="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5"
									     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
										<span class="text-xs font-bold" style="color: var(--color-on-primary)">{step.stepNumber}</span>
									</div>
									<p class="text-sm flex-1 leading-relaxed" style="color: var(--color-on-surface)">{step.text}</p>
								</div>
							{/each}
						</div>
					{/if}
				{/if}

			</div>
		{/if}
	</div>
</div>

<AppBottomNav activeTab="recipes" showFab={false} />

{#if recipe}
	<RecipeShareModal recipeId={recipeId} open={shareModalOpen} onClose={() => shareModalOpen = false} />
	{#if listModalOpen}
		<RecipeAddToListModal
			{recipe}
			{excludedIngredients}
			{currentServings}
			{originalServings}
			selectionSaving={exclusionsSaving || exclusionsLoading}
			selectionUnavailable={!exclusionsLoaded}
			selectionSaveError={exclusionsSaveError || exclusionsLoadError}
			onToggleIngredient={toggleIngredient}
			onRetrySelection={() => { if (exclusionsLoaded) void saveExclusions(excludedIngredients); else void loadExclusions(); }}
			onClose={() => listModalOpen = false}
		/>
	{/if}
{/if}

<!-- Nutrition: Nährwerte zuordnen -->
{#if recipe && nutritionSheetOpen}
	<RecipeNutritionSheet
		recipeId={recipeId}
		ingredients={recipe.ingredients}
		servings={recipe.servings}
		onclose={() => (nutritionSheetOpen = false)}
		onsaved={() => { void loadNutrition(); }}
	/>
{/if}

<!-- Nutrition: Portionen tracken -->
{#if recipe && trackSheetOpen}
	<RecipeTrackSheet
		recipeTitle={recipe.title}
		recipeImageUrl={recipe.imageUrl}
		components={usableComponents}
		mappedServings={nutMappedServings}
		onclose={() => (trackSheetOpen = false)}
		onsaved={onTracked}
	/>
{/if}

<!-- Tracking-Bestätigung -->
{#if nutToast}
	<div class="fixed left-0 right-0 z-[70] flex justify-center px-4 pointer-events-none"
	     style="bottom: calc(env(safe-area-inset-bottom) + 5.5rem)">
		<div class="px-4 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 shadow-lg"
		     style="background: #FB923C; color: #fff">
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
			{nutToast}
		</div>
	</div>
{/if}

<!-- Overflow action sheet -->
{#if actionMenuOpen}
	<dialog use:showActionMenu onclose={() => actionMenuOpen = false}
		class="fixed inset-0 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 text-inherit backdrop:bg-transparent"
		aria-label={t.a11y_more}>
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => actionMenuOpen = false}></div>
		<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto max-h-[85dvh] overflow-y-auto rounded-t-3xl px-6 pt-3"
		     style="background-color: var(--modal-bg); bottom: 0; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
			<div class="flex justify-center mb-3">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button type="button" class="recipe-menu-row inset-row-divider" onclick={() => { actionMenuOpen = false; goto(`/rezepte/${recipeId}/bearbeiten`); }}>
					<Pencil size={18} aria-hidden="true" />{t.recipe_edit_title}
				</button>
				{#if !recipe?.categoryName}
					<button type="button" class="recipe-menu-row inset-row-divider" onclick={() => { actionMenuOpen = false; categorySheetOpen = true; }}>
						<Folder size={18} aria-hidden="true" />{t.recipe_category_change}
					</button>
				{/if}
				<button type="button" class="recipe-menu-row inset-row-divider" onclick={openTagEditor}>
					<Tag size={18} aria-hidden="true" />{recipe?.tags?.length ? t.recipe_tags_edit : t.recipe_tags_add}
				</button>
				<button
					onclick={() => { actionMenuOpen = false; shareModalOpen = true; }}
					class="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
						<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
					</svg>
					<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipe_share_title}</span>
				</button>
				{#if nutTrackerActive && nutMapped}
					<button
						onclick={() => { actionMenuOpen = false; nutritionSheetOpen = true; }}
						class="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M3 11h18"/><path d="M12 11a7 7 0 0 1-7 7h14a7 7 0 0 1-7-7Z"/><path d="M9 7c0-1 .5-1.5 1-2"/><path d="M13 7c0-1 .5-1.5 1-2"/>
						</svg>
						<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipe_nutrition_edit}</span>
					</button>
				{/if}
				{#if recipe?.cookCount && recipe.cookCount > 0}
					<button
						onclick={() => { actionMenuOpen = false; undoCooked(); }}
						class="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
						</svg>
						<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipe_cooked_undo}</span>
					</button>
				{/if}
				<button
					onclick={() => { actionMenuOpen = false; deleteRecipe(); }}
					class="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
					</svg>
					<span class="text-sm font-medium" style="color: var(--color-error)">{t.recipe_delete}</span>
				</button>
			</div>
		</div>
	</dialog>
{/if}

{#if recipe && categorySheetOpen}
	<RecipeCategoryAssignmentSheet categoryId={recipe.categoryId ?? null} categoryName={recipe.categoryName ?? null}
		onsave={saveRecipeCategory} onclose={() => categorySheetOpen = false} />
{/if}

<!-- Rating sheet -->
{#if recipe && ratingPopupOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => ratingPopupOpen = false}></div>
	<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pt-3"
	     style="background-color: var(--modal-bg); bottom: 0; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
		<div class="flex justify-center mb-3">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<p class="text-center text-sm font-semibold mb-4" style="color: var(--color-on-surface)">{t.recipe_rating}</p>
		<div class="flex items-center justify-center gap-2">
			{#each [1, 2, 3, 4, 5] as n}
				<button
					onclick={() => { setRating(n); ratingPopupOpen = false; }}
					disabled={isOfflineFallback}
					aria-label="{n}/5"
					class="w-12 h-12 flex items-center justify-center active:opacity-60 active:scale-90 transition-transform disabled:opacity-40"
				>
					<svg width="32" height="32" viewBox="0 0 24 24"
					     fill={(recipe.rating ?? 0) >= n ? 'var(--color-primary)' : 'none'}
					     stroke={(recipe.rating ?? 0) >= n ? 'var(--color-primary)' : 'var(--color-outline)'}
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
					</svg>
				</button>
			{/each}
		</div>
		{#if recipe.rating}
			<button
				onclick={() => { if (recipe?.rating) setRating(recipe.rating); ratingPopupOpen = false; }}
				class="w-full text-center text-sm py-3 mt-1 active:opacity-60"
				style="color: var(--color-on-surface-variant)"
			>{t.recipe_rating_clear}</button>
		{/if}
	</div>
{/if}

<style>
	.recipe-hero-controls {
		position: absolute;
		inset-inline: 12px;
		top: calc(env(safe-area-inset-top) + 12px);
		z-index: 10;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.recipe-hero-control {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 44px;
		min-height: 44px;
		color: white;
	}
	.recipe-hero-pill {
		display: grid;
		place-items: center;
		min-width: 36px;
		height: 36px;
		border-radius: 999px;
	}
	.recipe-hero-back .recipe-hero-pill { background: rgba(0, 0, 0, .55); }
	.recipe-hero-category {
		max-width: min(65%, 16rem);
		font-size: 13px;
		font-weight: 650;
	}
	.recipe-hero-category .recipe-hero-pill {
		display: block;
		max-width: 100%;
		padding-inline: 12px;
		background: #181818;
		line-height: 36px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	button.recipe-hero-control:active .recipe-hero-pill { opacity: .8; }
	button.recipe-hero-control:focus-visible { outline: none; }
	button.recipe-hero-control:focus-visible .recipe-hero-pill { outline: 2px solid white; outline-offset: -4px; }
	.recipe-actions { column-gap: 2px; }
	.recipe-action-labeled { padding-inline: 8px; }
	.recipe-servings-icon { display: none; }
	@media (min-width: 360px) {
		.recipe-actions { column-gap: 4px; }
		.recipe-action-labeled { padding-inline: 10px; }
		.recipe-servings-icon { display: block; }
	}
	.recipe-tags { display: flex; gap: 6px; margin-top: 4px; }
	.recipe-tags-preview { overflow-x: auto; }
	.recipe-tags-edit { flex-wrap: wrap; align-items: center; }
	.recipe-tag {
		flex-shrink: 0;
		display: inline-flex;
		align-items: center;
		max-width: 100%;
		gap: 4px;
		padding: 3px 9px;
		color: var(--color-on-surface-variant);
		background: var(--bubble-interactive-bg);
		border: 1px solid var(--bubble-interactive-border);
		border-radius: 999px;
		font-size: 12px;
	}
	.recipe-tag span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.recipe-tag-remove, .recipe-tag-done { min-height: 40px; }
	.recipe-tags-edit input {
		flex: 1;
		min-width: 7rem;
		min-height: 40px;
		padding-inline: 8px;
		outline: none;
		background: transparent;
		color: var(--color-on-surface);
		font-size: 16px;
	}
	.recipe-tag-done { padding-inline: 10px; color: var(--color-primary); font-size: 13px; font-weight: 650; }
	.recipe-menu-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 8px 16px;
		color: var(--color-on-surface);
		font-size: 14px;
		font-weight: 550;
		text-align: left;
	}
	.recipe-menu-row:active { background: var(--bubble-interactive-bg); }
</style>
