<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import FabWithShortcuts from '$lib/components/FabWithShortcuts.svelte';
	import MealPlanner from '$lib/components/MealPlanner.svelte';
	import { t } from '$lib/i18n.svelte';

	let { data } = $props();

	type Recipe = {
		id: string;
		title: string;
		description: string | null;
		imageUrl: string | null;
		servings: number;
		prepTime: number | null;
		cookTime: number | null;
		updatedAt: number;
	};
	type PendingShare = {
		id: string;
		recipeId: string;
		recipeTitle: string;
		recipeImageUrl: string | null;
		senderUsername: string;
		createdAt: number;
	};

	const STORAGE_KEY = 'groly_recipe_order';

	let recipes = $state<Recipe[]>([]);
	let limit = $state(50);
	let pendingShares = $state<PendingShare[]>([]);
	let loading = $state(true);
	let menuOpen = $state(false);
	let addSheetOpen = $state(false);
	let searchQuery = $state('');
	let searchOpen = $state(false);
	let keyboardOpen = $state(false);
	let sharesLoading = $state<Record<string, boolean>>({});
	let sortMode = $state(false);
	let customOrder = $state<string[]>([]);
	let activeTab = $state<'recipes' | 'mealplan'>($page.url.searchParams.get('tab') === 'mealplan' ? 'mealplan' : 'recipes');

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
	}

	// Apply custom order to recipes
	const orderedRecipes = $derived(
		customOrder.length > 0
			? (() => {
				const mapped = customOrder.map(id => recipes.find(r => r.id === id)).filter(Boolean) as Recipe[];
				const missing = recipes.filter(r => !customOrder.includes(r.id));
				return [...mapped, ...missing];
			})()
			: recipes
	);

	const filteredRecipes = $derived(
		sortMode
			? orderedRecipes
			: searchQuery.trim()
				? orderedRecipes.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
				: orderedRecipes
	);

	const totalTime = (r: Recipe) => {
		const mins = (r.prepTime ?? 0) + (r.cookTime ?? 0);
		return mins > 0 ? `${mins} ${t.recipe_minutes}` : null;
	};

	function loadCustomOrder() {
		try {
			const stored = localStorage.getItem(STORAGE_KEY);
			customOrder = stored ? JSON.parse(stored) : [];
		} catch { customOrder = []; }
	}

	function saveCustomOrder() {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(customOrder));
	}

	function enterSortMode() {
		closeSearch();
		customOrder = orderedRecipes.map(r => r.id);
		sortMode = true;
	}

	function exitSortMode() {
		saveCustomOrder();
		sortMode = false;
	}

	function moveUp(index: number) {
		if (index === 0) return;
		const next = [...customOrder];
		[next[index - 1], next[index]] = [next[index], next[index - 1]];
		customOrder = next;
	}

	function moveDown(index: number) {
		if (index === customOrder.length - 1) return;
		const next = [...customOrder];
		[next[index], next[index + 1]] = [next[index + 1], next[index]];
		customOrder = next;
	}

	// Long-press auf Rezepte-Tab → Sortier-Modus
	let recipesTabPressTimer: ReturnType<typeof setTimeout> | null = null;
	let recipesTabLongFired = false;

	function handleRecipesTabPointerDown() {
		recipesTabLongFired = false;
		recipesTabPressTimer = setTimeout(() => {
			recipesTabLongFired = true;
			recipesTabPressTimer = null;
			if (sortMode) exitSortMode(); else enterSortMode();
		}, 500);
	}
	function handleRecipesTabPointerUp() {
		if (recipesTabPressTimer) { clearTimeout(recipesTabPressTimer); recipesTabPressTimer = null; }
	}
	function handleRecipesTabClick() {
		if (recipesTabLongFired) { recipesTabLongFired = false; return; }
		// short tap: already on recipes page
	}

	async function loadRecipes() {
		try {
			const res = await fetch('/api/recipes');
			if (!res.ok) throw new Error();
			const json = await res.json();
			recipes = json.recipes ?? [];
			limit = json.limit ?? 50;
		} catch {
			recipes = [];
		}
		loading = false;
	}

	async function loadShares() {
		try {
			const res = await fetch('/api/recipes/shares');
			if (!res.ok) return;
			pendingShares = await res.json();
		} catch {}
	}

	async function acceptShare(share: PendingShare) {
		if (sharesLoading[share.id]) return;
		sharesLoading = { ...sharesLoading, [share.id]: true };
		try {
			const res = await fetch(`/api/recipes/shares/${share.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'accept' })
			});
			if (res.ok) {
				const data = await res.json();
				pendingShares = pendingShares.filter(s => s.id !== share.id);
				await loadRecipes();
				if (data.recipeId) goto(`/rezepte/${data.recipeId}`);
			}
		} finally {
			sharesLoading = { ...sharesLoading, [share.id]: false };
		}
	}

	async function declineShare(share: PendingShare) {
		if (sharesLoading[share.id]) return;
		sharesLoading = { ...sharesLoading, [share.id]: true };
		try {
			const res = await fetch(`/api/recipes/shares/${share.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'decline' })
			});
			if (res.ok) pendingShares = pendingShares.filter(s => s.id !== share.id);
		} finally {
			sharesLoading = { ...sharesLoading, [share.id]: false };
		}
	}

	onMount(() => {
		loadCustomOrder();
		loadRecipes();
		loadShares();

		if (window.visualViewport) {
			const onViewportResize = () => {
				keyboardOpen = (window.innerHeight - window.visualViewport!.height) > 100;
			};
			window.visualViewport.addEventListener('resize', onViewportResize);
			return () => window.visualViewport?.removeEventListener('resize', onViewportResize);
		}
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={sortMode ? t.sort_mode_title : activeTab === 'mealplan' ? t.meal_plan_tab : t.recipes_title}
		subtitle={sortMode ? t.sort_mode_subtitle : activeTab === 'recipes' ? `${recipes.length} / ${limit}` : ''}
		onMenuOpen={() => { if (!sortMode) menuOpen = true; }}
		onSearch={recipes.length > 5 && !sortMode && activeTab === 'recipes' && !searchOpen ? () => searchOpen = true : null}
	>
		{#snippet actions()}
			{#if sortMode}
				<button
					onclick={exitSortMode}
					class="px-4 py-1.5 rounded-full text-sm font-semibold"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{t.sort_mode_done}
				</button>
			{/if}
		{/snippet}
	</AppHeader>

	<!-- Spacer that clears the fixed AppHeader (same height calculation as Settings page) -->
	<div class="flex-shrink-0" style="height: calc(env(safe-area-inset-top) + 5.5rem)"></div>

	<!-- Search bar (fixed, below header, only when open) -->
	{#if searchOpen && activeTab === 'recipes'}
		<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto px-4 py-2"
		     style="top: calc(env(safe-area-inset-top) + 5.25rem); background-color: var(--color-bg)">
			<div class="flex items-center gap-2 px-4 rounded-2xl"
			     style="background-color: var(--color-surface-container); height: 44px">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<!-- svelte-ignore a11y_autofocus -->
				<input
					type="search"
					placeholder={t.recipes_search_placeholder}
					bind:value={searchQuery}
					onkeydown={(e) => e.key === 'Escape' && closeSearch()}
					autofocus
					class="flex-1 bg-transparent outline-none text-sm"
					style="color: var(--color-on-surface); font-size: 16px"
				/>
				<button onclick={closeSearch} class="w-7 h-7 flex items-center justify-center rounded-lg active:opacity-60 flex-shrink-0"
				        style="background-color: var(--color-surface-high)" aria-label="Suche schließen">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round">
						<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
					</svg>
				</button>
			</div>
		</div>
		<!-- Extra spacer for the search bar height -->
		<div class="flex-shrink-0 h-14"></div>
	{/if}

	<!-- Tab switcher — outside scroll area, always visible -->
	{#if !sortMode}
		<div class="flex-shrink-0 px-4 mb-3">
			<div class="flex gap-1 p-1 rounded-2xl" style="background-color: var(--color-surface-container)">
				<button
					onclick={() => activeTab = 'recipes'}
					class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:opacity-70"
					style="background-color: {activeTab === 'recipes' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'recipes' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
					onpointerdown={handleRecipesTabPointerDown}
					onpointerup={handleRecipesTabPointerUp}
					onpointercancel={handleRecipesTabPointerUp}
					oncontextmenu={(e) => e.preventDefault()}
				>{t.recipes_title}</button>
				<button
					onclick={() => { activeTab = 'mealplan'; closeSearch(); }}
					class="flex-1 py-2 rounded-xl text-xs font-semibold transition-all active:opacity-70"
					style="background-color: {activeTab === 'mealplan' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'mealplan' ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
				>{t.meal_plan_tab}</button>
			</div>
		</div>
	{/if}

	<!-- Meal plan: bottom-anchored scroll (same as recipes) -->
	{#if activeTab === 'mealplan'}
		<div class="flex-1 min-h-0 flex flex-col justify-end overflow-y-auto px-4">
			<MealPlanner {recipes} />
			<div class="flex-shrink-0" style="height: 5rem"></div>
		</div>

	<!-- Recipes: bottom-anchored scroll (list builds upward), top-anchored when searching -->
	{:else}
		<div class="flex-1 min-h-0 flex flex-col overflow-y-auto px-4" class:justify-end={!searchQuery.trim() || !keyboardOpen} style="padding-bottom: 5rem">

		<!-- Pending Shares -->
		{#each pendingShares as share (share.id)}
			<div class="mb-3 rounded-2xl px-4 py-3 flex items-center gap-3"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-card));">
				<div class="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden"
				     style="background-color: var(--color-surface-high)">
					{#if share.recipeImageUrl}
						<img src={share.recipeImageUrl} alt="" class="w-full h-full object-cover" />
					{:else}
						<div class="w-full h-full flex items-center justify-center font-bold text-sm"
						     style="color: var(--color-primary)">{share.recipeTitle[0]?.toUpperCase()}</div>
					{/if}
				</div>
				<div class="flex-1 min-w-0">
					<div class="text-xs font-semibold truncate" style="color: var(--color-primary)">{share.senderUsername} {t.recipe_shares_from}</div>
					<div class="text-sm truncate font-medium" style="color: var(--color-on-surface)">{share.recipeTitle}</div>
				</div>
				<div class="flex gap-2 flex-shrink-0">
					<button
						onclick={() => declineShare(share)}
						disabled={sharesLoading[share.id]}
						class="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
						style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					>{t.recipe_decline}</button>
					<button
						onclick={() => acceptShare(share)}
						disabled={sharesLoading[share.id]}
						class="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-40"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>{t.recipe_accept}</button>
				</div>
			</div>
		{/each}

		<!-- Search (shows when >5 recipes and not in sort mode) -->
		{#if loading}
			<div class="flex justify-center py-12">
				<div class="w-6 h-6 rounded-full border-2 animate-spin"
				     style="border-color: var(--color-primary); border-top-color: transparent"></div>
			</div>
		{:else if filteredRecipes.length === 0}
			<div class="flex flex-col items-center justify-center py-16 text-center">
				<div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
				     style="background-color: var(--color-surface-container)">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
						<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
					</svg>
				</div>
				{#if searchQuery}
					<p class="text-sm font-medium" style="color: var(--color-on-surface)">{t.recipes_no_results} „{searchQuery}"</p>
				{:else}
					<p class="text-sm font-semibold mb-1" style="color: var(--color-on-surface)">{t.recipes_empty}</p>
					<p class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipes_empty_hint}</p>
				{/if}
			</div>
		{:else if sortMode}
			<!-- Sort Mode -->
			<div class="space-y-2">
				{#each filteredRecipes as recipe, i (recipe.id)}
					<div class="flex items-center gap-2">
						<!-- Sort controls -->
						<div class="flex flex-col gap-0.5 flex-shrink-0">
							<button
								onclick={() => moveUp(i)}
								disabled={i === 0}
								class="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-20 active:opacity-60"
								style="color: var(--color-on-surface-variant)"
								aria-label="Nach oben"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="18 15 12 9 6 15"/>
								</svg>
							</button>
							<button
								onclick={() => moveDown(i)}
								disabled={i === filteredRecipes.length - 1}
								class="w-8 h-8 flex items-center justify-center rounded-lg disabled:opacity-20 active:opacity-60"
								style="color: var(--color-on-surface-variant)"
								aria-label="Nach unten"
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="6 9 12 15 18 9"/>
								</svg>
							</button>
						</div>

						<!-- Card (nicht navigierbar im Sort-Modus) -->
						<div class="flex-1 flex items-center gap-3 px-4 rounded-2xl"
						     style="background-color: var(--color-surface-card); min-height: 3.75rem; padding-top: 0.875rem; padding-bottom: 0.875rem">
							<!-- Thumbnail -->
							<div class="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
							     style="background-color: {recipe.imageUrl ? 'var(--color-surface-container)' : 'transparent'}">
								{#if recipe.imageUrl}
									<img src={recipe.imageUrl} alt={recipe.title} class="w-full h-full object-cover" />
								{:else}
									<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
										<path d="M8 2v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/>
										<line x1="10" y1="8" x2="10" y2="22"/>
										<line x1="7" y1="2" x2="7" y2="6"/>
										<line x1="13" y1="2" x2="13" y2="6"/>
										<path d="M17 2c0 0 2 1.5 2 5s-2 5-2 5v10"/>
									</svg>
								{/if}
							</div>

							<!-- Info -->
							<div class="flex-1 min-w-0 flex flex-col justify-center">
								<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{recipe.title}</div>
								{#if totalTime(recipe) || recipe.description}
									<div class="text-xs mt-0.5 truncate" style="color: var(--color-on-surface-variant)">
										{totalTime(recipe) || recipe.description}
									</div>
								{/if}
							</div>

							<!-- Drag indicator -->
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
								<line x1="3" y1="8" x2="21" y2="8"/>
								<line x1="3" y1="16" x2="21" y2="16"/>
							</svg>
						</div>
					</div>
				{/each}
			</div>
		{:else}
			<!-- Normal Mode -->
			<div class="space-y-2">
				{#each filteredRecipes as recipe (recipe.id)}
					<button
						onclick={() => goto(`/rezepte/${recipe.id}`)}
						class="w-full flex items-center gap-3 px-4 rounded-2xl text-left active:opacity-70 transition-opacity"
						style="background-color: var(--color-surface-card); min-height: 3.75rem; padding-top: 0.875rem; padding-bottom: 0.875rem"
					>
						<!-- Thumbnail -->
						<div class="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
						     style="background-color: {recipe.imageUrl ? 'var(--color-surface-container)' : 'transparent'}">
							{#if recipe.imageUrl}
								<img src={recipe.imageUrl} alt={recipe.title} class="w-full h-full object-cover" />
							{:else}
								<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
									<path d="M8 2v4a2 2 0 0 0 2 2h0a2 2 0 0 0 2-2V2"/>
									<line x1="10" y1="8" x2="10" y2="22"/>
									<line x1="7" y1="2" x2="7" y2="6"/>
									<line x1="13" y1="2" x2="13" y2="6"/>
									<path d="M17 2c0 0 2 1.5 2 5s-2 5-2 5v10"/>
								</svg>
							{/if}
						</div>

						<!-- Info -->
						<div class="flex-1 min-w-0 flex flex-col justify-center">
							<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{recipe.title}</div>
							{#if totalTime(recipe) || recipe.description}
								<div class="text-xs mt-0.5 truncate" style="color: var(--color-on-surface-variant)">
									{totalTime(recipe) || recipe.description}
								</div>
							{/if}
						</div>

						<!-- Servings badge -->
						<div class="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg"
						     style="background-color: var(--color-surface-container)">
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
							</svg>
							<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{recipe.servings}</span>
						</div>

						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</button>
				{/each}
			</div>
		{/if}

		</div><!-- end recipes scroll -->
	{/if}<!-- end tab switch -->

	<!-- Bottom Nav -->
	<div class="fixed left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
	     style="bottom: calc(-1 * env(safe-area-inset-bottom, 0px)); padding-bottom: calc(env(safe-area-inset-bottom, 0px) + 8px); background: linear-gradient(to top, var(--color-bg) 40%, transparent)">
		<div class="flex items-center gap-3 pointer-events-auto">
			<!-- Listen Tab -->
			<button
				onclick={() => goto('/')}
				class="flex items-center gap-2 px-6 h-14 rounded-full glass active:opacity-70 transition-opacity select-none"
				style="background-color: color-mix(in srgb, var(--color-surface-container) 85%, transparent)"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
					<line x1="3" y1="6" x2="21" y2="6"/>
					<path d="M16 10a4 4 0 0 1-8 0"/>
				</svg>
				<span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-on-surface-variant)">{t.nav_lists}</span>
			</button>

			<!-- FAB (nur im Rezepte-Tab) -->
			{#if activeTab === 'recipes'}
				<FabWithShortcuts onTap={() => { if (!sortMode) addSheetOpen = true; }} label={t.recipe_add} />
			{/if}

			<!-- Rezepte Tab (active) mit Long-Press -->
			<button
				onclick={handleRecipesTabClick}
				onpointerdown={handleRecipesTabPointerDown}
				onpointerup={handleRecipesTabPointerUp}
				onpointercancel={handleRecipesTabPointerUp}
				oncontextmenu={(e) => e.preventDefault()}
				class="flex items-center gap-2 px-6 h-14 rounded-full glass select-none"
				style="background-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-container)); outline: 1.5px solid color-mix(in srgb, var(--color-primary) 40%, transparent)"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
				</svg>
				<span class="text-xs font-semibold tracking-widest uppercase" style="color: var(--color-primary)">{t.nav_recipes}</span>
			</button>
		</div>
	</div>
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Add Recipe Sheet -->
{#if addSheetOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => addSheetOpen = false}></div>
	<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-10 pt-4"
	     style="background-color: var(--color-surface-low); bottom: 0">
		<div class="flex justify-center mb-5">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<h2 class="text-lg font-bold mb-5" style="color: var(--color-on-surface)">{t.recipe_add}</h2>
		<div class="space-y-3">
			<button
				onclick={() => { addSheetOpen = false; goto('/rezepte/import'); }}
				class="w-full flex items-center gap-4 px-5 py-4 rounded-2xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container)"
			>
				<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
				     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
					</svg>
				</div>
				<div class="text-left">
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_import_url}</div>
					<div class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">{t.recipe_import_url_hint}</div>
				</div>
			</button>
			<button
				onclick={() => { addSheetOpen = false; goto('/rezepte/neu'); }}
				class="w-full flex items-center gap-4 px-5 py-4 rounded-2xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container)"
			>
				<div class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
				     style="background-color: var(--color-surface-high)">
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</div>
				<div class="text-left">
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_create_manual}</div>
					<div class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">{t.recipe_create_manual_hint}</div>
				</div>
			</button>
		</div>
	</div>
{/if}
