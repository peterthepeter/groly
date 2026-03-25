<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n.svelte';
	import { scaleAmount, type Recipe } from '$lib/recipeUtils';
	import RecipeShareModal from '$lib/components/recipe/RecipeShareModal.svelte';
	import RecipeAddToListModal from '$lib/components/recipe/RecipeAddToListModal.svelte';

	let recipe = $state<Recipe | null>(null);
	let loading = $state(true);
	let activeTab = $state<'zutaten' | 'anleitung'>('zutaten');
	let currentServings = $state(4);
	let originalServings = $state(4);

	let shareModalOpen = $state(false);
	let listModalOpen = $state(false);

	let excludedIngredients = $state(new Set<string>());

	function toggleIngredient(id: string) {
		const next = new Set(excludedIngredients);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		excludedIngredients = next;
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
		} catch {
			goto('/rezepte');
		}
		loading = false;
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
					ingredients: recipe.ingredients.map(i => ({ amount: i.amount, unit: i.unit, name: i.name })),
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

	onMount(() => loadRecipe());
</script>

<div class="h-screen flex flex-col overflow-hidden max-w-[430px] mx-auto" style="background-color: var(--color-bg)">
	<!-- Fixed top bar -->
	<div class="fixed top-0 left-0 right-0 z-40 max-w-[430px] mx-auto px-4 pb-2"
	     style="padding-top: calc(env(safe-area-inset-top) + 1rem)">
		<div class="flex items-center justify-between rounded-2xl px-4 py-3"
		     style="background-color: var(--color-surface-low)">
			<button
				onclick={() => goto('/rezepte')}
				class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
				style="background-color: var(--color-surface-high)"
				aria-label="Zurück"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
			<div class="flex items-center gap-2">
				{#if recipe}
					<button
						onclick={() => shareModalOpen = true}
						class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
						style="background-color: var(--color-surface-high)"
						aria-label="Teilen"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
						</svg>
					</button>
					<button
						onclick={() => goto(`/rezepte/${recipeId}/bearbeiten`)}
						class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
						style="background-color: var(--color-surface-high)"
						aria-label="Bearbeiten"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
					</button>
				{/if}
			</div>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto min-h-0" style="padding-top: calc(env(safe-area-inset-top) + 5.5rem); padding-bottom: calc(env(safe-area-inset-bottom) + 2rem)">
		{#if loading}
			<div class="flex justify-center py-16">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if recipe}
			<!-- Hero Image -->
			<div class="w-full h-48 flex-shrink-0 overflow-hidden"
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
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
					<h1
						class="text-xl font-bold mb-1 cursor-text"
						style="color: var(--color-on-surface)"
						onclick={startEditTitle}
					>{recipe.title}</h1>
				{/if}
				{#if recipe.sourceUrl}
					<a href={recipe.sourceUrl} target="_blank" rel="noopener noreferrer"
					   class="text-xs underline" style="color: var(--color-primary); text-decoration-color: var(--color-primary)">
						{t.recipe_original_link}
					</a>
				{/if}
				{#if recipe.description}
					<p class="text-sm mt-2" style="color: var(--color-on-surface-variant)">{recipe.description}</p>
				{/if}

				<!-- Meta row -->
				<div class="flex items-center gap-3 mt-4 flex-wrap">
					{#if recipe.prepTime}
						<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
						     style="background-color: var(--color-surface-container)">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
							</svg>
							<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipe_prep_time} {recipe.prepTime} {t.recipe_minutes}</span>
						</div>
					{/if}
					{#if recipe.cookTime}
						<div class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
						     style="background-color: var(--color-surface-container)">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/>
							</svg>
							<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipe_cook_time} {recipe.cookTime} {t.recipe_minutes}</span>
						</div>
					{/if}

					<!-- Servings Stepper -->
					<div class="flex items-center gap-2 ml-auto">
						<button
							onclick={() => { if (currentServings > 1) currentServings--; }}
							disabled={currentServings <= 1}
							class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
							style="background-color: var(--color-surface-high)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
								<line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
						</button>
						<div class="flex items-center gap-1">
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
							</svg>
							<span class="text-sm font-bold w-5 text-center" style="color: var(--color-on-surface)">{currentServings}</span>
						</div>
						<button
							onclick={() => currentServings++}
							class="w-8 h-8 rounded-full flex items-center justify-center active:opacity-60"
							style="background-color: var(--color-surface-high)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
								<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
						</button>
					</div>
				</div>

				<!-- Auf Liste Button -->
				{#if recipe.ingredients.length > 0}
					<button
						onclick={() => listModalOpen = true}
						disabled={selectedCount === 0}
						class="w-full mt-4 py-3.5 rounded-full font-semibold text-sm shadow-lg active:scale-95 transition-transform disabled:opacity-40"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>
						<div class="flex items-center justify-center gap-2">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
							</svg>
							{t.recipe_add_to_list}
							{#if selectedCount < recipe.ingredients.length}
								<span class="text-xs opacity-80">({selectedCount}/{recipe.ingredients.length})</span>
							{/if}
						</div>
					</button>
				{/if}

				<!-- Tabs -->
				<div class="flex gap-1 mt-4 mb-4 p-1 rounded-xl" style="background-color: var(--color-surface-container)">
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
						<div class="space-y-2">
							{#each recipe.ingredients as ing (ing.id)}
								{@const excluded = excludedIngredients.has(ing.id)}
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<!-- svelte-ignore a11y_no_static_element_interactions -->
								<div
									class="flex items-center gap-3 px-4 py-3 rounded-xl transition-opacity active:opacity-60 cursor-pointer"
									style="background-color: var(--color-surface-card); opacity: {excluded ? 0.38 : 1}"
									onclick={() => toggleIngredient(ing.id)}
								>
									<div class="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0"
									     style="background-color: {excluded ? 'transparent' : 'var(--color-primary)'}; border: 1.5px solid {excluded ? 'var(--color-outline)' : 'var(--color-primary)'}">
										{#if !excluded}
											<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="20 6 9 17 4 12"/>
											</svg>
										{/if}
									</div>
									{#if ing.amount || ing.unit}
										<span class="text-sm font-bold flex-shrink-0 min-w-12 text-right"
										      style="color: {excluded ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}">
											{scaleAmount(ing.amount, currentServings, originalServings) ?? ''}{ing.unit ? '\u00a0' + ing.unit : ''}
										</span>
									{/if}
									<span class="text-sm flex-1" style="color: var(--color-on-surface)">{ing.name}</span>
								</div>
							{/each}
						</div>
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

				<!-- Delete -->
				<div class="mt-8 pb-4">
					<button
						onclick={deleteRecipe}
						class="w-full py-3.5 rounded-full text-sm font-semibold"
						style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
					>{t.recipe_delete}</button>
				</div>
			</div>
		{/if}
	</div>
</div>

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
