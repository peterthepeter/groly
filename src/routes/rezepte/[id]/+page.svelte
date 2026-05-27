<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { scaleAmount, type Recipe } from '$lib/recipeUtils';
	import RecipeShareModal from '$lib/components/recipe/RecipeShareModal.svelte';
	import RecipeAddToListModal from '$lib/components/recipe/RecipeAddToListModal.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import { cacheRecipeDetail, getOfflineRecipeDetail } from '$lib/sync/manager';
	import { userSettings } from '$lib/userSettings.svelte';
	import { acquireWakeLock, releaseWakeLock } from '$lib/wakeLock';

	let wakeLockHeld = false;

	let recipe = $state<Recipe | null>(null);
	let loading = $state(true);
	let activeTab = $state<'zutaten' | 'anleitung'>('zutaten');
	let currentServings = $state(4);
	let originalServings = $state(4);

	let shareModalOpen = $state(false);
	let listModalOpen = $state(false);
	let isOfflineFallback = $state(false);

	let excludedIngredients = $state(new Set<string>());
	let cookSaving = $state(false);
	let tagInput = $state('');
	let editingTags = $state(false);
	let actionMenuOpen = $state(false);

	function formatLastCooked(ts: number | null | undefined): string {
		if (!ts) return '';
		return new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(new Date(ts));
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
			isFavorite: recipe.isFavorite ?? false,
			rating: recipe.rating ?? null,
			tags: recipe.tags ?? [],
			...overrides
		};
	}

	async function toggleFavorite() {
		if (!recipe) return;
		const next = !recipe.isFavorite;
		recipe = { ...recipe, isFavorite: next };
		try {
			await fetch(`/api/recipes/${recipeId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(buildPutBody({ isFavorite: next }))
			});
		} catch {
			recipe = recipe ? { ...recipe, isFavorite: !next } : recipe;
		}
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
		try {
			const res = await fetch(`/api/recipes/${recipeId}/exclusions`);
			if (res.ok) {
				const data = await res.json();
				excludedIngredients = new Set(data.excludedIds);
			}
		} catch {}
	}

	async function saveExclusions(excluded: Set<string>) {
		try {
			await fetch(`/api/recipes/${recipeId}/exclusions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ excludedIds: [...excluded] })
			});
		} catch {}
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

	const recipeId = $derived($page.params.id ?? '');

	async function loadRecipe() {
		try {
			const res = await fetch(`/api/recipes/${recipeId}`);
			if (!res.ok) { goto('/rezepte'); return; }
			const data = await res.json();
			recipe = data;
			currentServings = data.servings;
			originalServings = data.servings;
			cacheRecipeDetail(data).catch(() => {});
			await loadExclusions();
		} catch {
			const cached = await getOfflineRecipeDetail(recipeId);
			if (cached) {
				recipe = cached as Recipe;
				currentServings = cached.servings;
				originalServings = cached.servings;
				isOfflineFallback = true;
			} else {
				goto('/rezepte');
				return;
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
		void loadRecipe();
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
				<!-- Floating back button -->
				<button
					onclick={() => goto('/rezepte')}
					class="absolute z-10 flex items-center justify-center w-9 h-9 rounded-xl active:opacity-70"
					style="top: calc(env(safe-area-inset-top) + 0.75rem); left: 0.75rem; background-color: rgba(0,0,0,0.42); backdrop-filter: blur(6px)"
					aria-label="Zurück"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="15 18 9 12 15 6"/>
					</svg>
				</button>
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

				<!-- Rating + meta line -->
				<div class="flex items-center gap-1.5 mt-1 flex-wrap" aria-label={t.recipe_rating}>
					{#each [1, 2, 3, 4, 5] as n}
						<button
							onclick={() => setRating(n)}
							disabled={isOfflineFallback}
							aria-label="{n}/5"
							class="w-6 h-6 -mx-0.5 flex items-center justify-center active:opacity-60 disabled:opacity-40"
						>
							<svg width="17" height="17" viewBox="0 0 24 24"
							     fill={(recipe.rating ?? 0) >= n ? 'var(--color-primary)' : 'none'}
							     stroke={(recipe.rating ?? 0) >= n ? 'var(--color-primary)' : 'var(--color-outline)'}
							     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
							</svg>
						</button>
					{/each}
					<div class="ml-auto flex items-center gap-2">
						{#if recipe.lastCookedAt || recipe.prepTime || recipe.cookTime}
							<span class="text-xs" style="color: var(--color-on-surface-variant)">
								{#if recipe.prepTime || recipe.cookTime}
									{((recipe.prepTime ?? 0) + (recipe.cookTime ?? 0))} {t.recipe_minutes}
								{/if}
								{#if recipe.lastCookedAt}
									{#if recipe.prepTime || recipe.cookTime}<span aria-hidden="true"> · </span>{/if}
									{#if recipe.cookCount && recipe.cookCount > 0}{recipe.cookCount}× · {/if}{formatLastCooked(recipe.lastCookedAt)}
								{/if}
							</span>
						{/if}
						<button
							onclick={logCooked}
							disabled={isOfflineFallback || cookSaving}
							aria-label={t.recipe_cooked_today}
							title={t.recipe_cooked_today}
							class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-40 active:scale-95 transition-transform"
							style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
							</svg>
						</button>
					</div>
				</div>

				<!-- Action row: stepper · favorite · overflow · cart · cooked -->
				<div class="flex items-center gap-1 mt-1">
					<!-- Servings stepper -->
					<button
						onclick={() => changeServings(-1)}
						disabled={currentServings <= 1}
						aria-label="Portionen verringern"
						class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
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
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
						</svg>
						<span class="text-sm font-bold w-5 text-center" style="color: var(--color-on-surface)">{currentServings}</span>
					</div>
					<button
						onclick={() => changeServings(1)}
						aria-label="Portionen erhöhen"
						class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
							<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
						</svg>
					</button>

					<div class="ml-auto flex items-center gap-1">
						<!-- Favorite -->
						<button
							onclick={toggleFavorite}
							disabled={isOfflineFallback}
							aria-label={recipe.isFavorite ? t.recipe_favorite_remove : t.recipe_favorite_add}
							class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
						>
							<svg width="16" height="16" viewBox="0 0 24 24"
							     fill={recipe.isFavorite ? 'var(--color-primary)' : 'none'}
							     stroke={recipe.isFavorite ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}
							     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
							</svg>
						</button>

						<!-- Overflow menu (edit / share / delete) -->
						<button
							onclick={() => actionMenuOpen = true}
							disabled={isOfflineFallback}
							aria-label="Mehr"
							class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="var(--color-on-surface-variant)">
								<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
							</svg>
						</button>

						<!-- Cart pill -->
						{#if recipe.ingredients.length > 0}
							<button
								onclick={() => listModalOpen = true}
								disabled={selectedCount === 0}
								aria-label="Auf Einkaufsliste"
								class="flex items-center gap-1.5 px-2.5 h-8 rounded-full text-xs font-semibold active:opacity-60 disabled:opacity-40 active:scale-95 transition-transform"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
								</svg>
								<span>{selectedCount}/{recipe.ingredients.length}</span>
							</button>
						{/if}
					</div>
				</div>

				<!-- Tags -->
				<div class="mt-1 flex flex-col gap-2">

					<!-- Tags row -->
					<div class="flex items-center gap-1.5 flex-wrap">
						{#each (recipe.tags ?? []) as tag (tag)}
							<button
								onclick={() => editingTags && removeTag(tag)}
								disabled={isOfflineFallback}
								class="h-7 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1 active:opacity-60 disabled:opacity-40"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
							>
								<span>{tag}</span>
								{#if editingTags}
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round">
										<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
								{/if}
							</button>
						{/each}
						{#if editingTags}
							<input
								type="text"
								bind:value={tagInput}
								placeholder={t.recipe_tags_placeholder}
								onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
								class="h-7 px-2.5 rounded-full text-xs outline-none"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; min-width: 6rem"
							/>
							<button
								onclick={async () => { if (tagInput.trim()) await addTag(); editingTags = false; tagInput = ''; }}
								class="h-7 px-2.5 rounded-full text-xs font-semibold active:opacity-60"
								style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
							>{t.sort_mode_done}</button>
						{:else}
							<button
								onclick={() => editingTags = true}
								disabled={isOfflineFallback}
								class="h-7 px-2.5 rounded-full text-xs font-semibold flex items-center gap-1 active:opacity-60 disabled:opacity-40"
								style="background-color: transparent; color: var(--color-primary); border: 1px dashed var(--color-outline)"
							>
								<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
									<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
								<span>{recipe.tags && recipe.tags.length > 0 ? t.recipe_tags_add : t.recipe_tags}</span>
							</button>
						{/if}
					</div>
				</div>

				<!-- Tabs -->
				<div class="flex gap-1 mt-3 mb-3 p-1 rounded-xl" style="background-color: var(--color-surface-container)">
					<button
						onclick={() => activeTab = 'zutaten'}
						class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
						style="background-color: {activeTab === 'zutaten' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'zutaten' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
					>{t.recipe_ingredients} ({recipe.ingredients.length})</button>
					<button
						onclick={() => activeTab = 'anleitung'}
						class="flex-1 py-2 rounded-lg text-sm font-semibold transition-all"
						style="background-color: {activeTab === 'anleitung' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'anleitung' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
					>{t.recipe_instructions} ({recipe.steps.length})</button>
				</div>

				<!-- Zutaten -->
				{#if activeTab === 'zutaten'}
					{#if recipe.ingredients.length === 0}
						<p class="text-sm text-center py-6" style="color: var(--color-on-surface-variant)">{t.recipe_no_ingredients}</p>
					{:else}
						{@const activeIngs = recipe.ingredients.filter(i => !excludedIngredients.has(i.id))}
						{@const excludedIngs = recipe.ingredients.filter(i => excludedIngredients.has(i.id))}
						{#snippet ingRow(ing: NonNullable<typeof recipe>['ingredients'][0], i: number)}
							{@const excluded = excludedIngredients.has(ing.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div
								class="flex items-center gap-3 px-4 py-2.5 active:opacity-60 cursor-pointer"
								onclick={() => toggleIngredient(ing.id)}
							>
								<div class="w-4.5 h-4.5 rounded-md flex items-center justify-center flex-shrink-0"
								     style="background-color: {excluded ? 'transparent' : 'var(--color-primary)'}; border: 1.5px solid {excluded ? 'var(--color-outline)' : 'var(--color-primary)'}">
									{#if !excluded}
										<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"/>
										</svg>
									{/if}
								</div>
								{#if ing.amount || ing.unit}
									<span class="text-sm font-semibold flex-shrink-0 min-w-10 text-right"
									      style="color: {excluded ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}">
										{scaleAmount(ing.amount, currentServings, originalServings) ?? ''}{ing.unit ? '\u00a0' + ing.unit : ''}
									</span>
								{/if}
								<span class="text-sm flex-1" style="color: {excluded ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)'}; text-decoration: {excluded ? 'line-through' : 'none'}">{ing.name}</span>
							</div>
						{/snippet}

						<!-- Active ingredients -->
						{#if activeIngs.length > 0}
							<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-card)">
								{#each activeIngs as ing, i}
									{@render ingRow(ing, i)}
								{/each}
							</div>
						{/if}

						<!-- Excluded ingredients -->
						{#if excludedIngs.length > 0}
							<div class="mt-3">
<div class="rounded-xl overflow-hidden opacity-60" style="background-color: var(--color-surface-card)">
									{#each excludedIngs as ing, i}
										{@render ingRow(ing, i)}
									{/each}
								</div>
							</div>
						{/if}
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
								     style="background-color: var(--color-surface-card)">
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
	<RecipeAddToListModal
		{recipe}
		{excludedIngredients}
		{currentServings}
		{originalServings}
		open={listModalOpen}
		onClose={() => listModalOpen = false}
	/>
{/if}

<!-- Overflow action sheet -->
{#if actionMenuOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => actionMenuOpen = false}></div>
	<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pt-3"
	     style="background-color: var(--color-surface-low); bottom: 0; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
		<div class="flex justify-center mb-3">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
			<button
				onclick={() => { actionMenuOpen = false; goto(`/rezepte/${recipeId}/bearbeiten`); }}
				class="w-full flex items-center gap-3 px-4 py-3 active:opacity-60"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipe_edit_title}</span>
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
{/if}
