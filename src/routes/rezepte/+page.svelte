<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import FabWithShortcuts from '$lib/components/FabWithShortcuts.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import MealPlanner from '$lib/components/MealPlanner.svelte';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { cacheRecipes, getOfflineRecipes } from '$lib/sync/manager';

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
		isFavorite?: boolean;
		rating?: number | null;
		cookCount?: number;
		lastCookedAt?: number | null;
		tags?: string[];
	};

	type SortKey = 'updated' | 'cooked' | 'cookCount' | 'rating' | 'title';
	const SORT_STORAGE_KEY = 'groly_recipe_sort';
	type PendingShare = {
		id: string;
		recipeId: string;
		recipeTitle: string;
		recipeImageUrl: string | null;
		senderUsername: string;
		createdAt: number;
	};

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
	let sortKey = $state<SortKey>('updated');
	let sortSheetOpen = $state(false);
	let activeTagFilters = $state<string[]>([]);
	let overlayHeight = $state(0);
	const activeTab = $derived($page.url.searchParams.get('tab') === 'mealplan' ? 'mealplan' : 'recipes');

	const todayHour = new Date().getHours();
	const todayGreeting = $derived(todayHour < 12 ? t.greeting_morning : todayHour < 18 ? t.greeting_day : todayHour < 22 ? t.greeting_evening : t.greeting_night);
	const todayDayName = $derived(new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' }).format(new Date()));
	const todayDateStr = $derived(new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long' }).format(new Date()));
	const recipeInfoLine = $derived(
		loading || recipes.length === 0 ? '' :
		currentLang() === 'de'
			? `${recipes.length} ${recipes.length === 1 ? 'Rezept' : 'Rezepte'} gespeichert`
			: `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} saved`
	);
	let mealPlanEditMode = $state(false);

	function closeSearch() {
		searchOpen = false;
		searchQuery = '';
		activeTagFilters = [];
	}

	const sortedRecipes = $derived.by(() => {
		const arr = [...recipes];
		switch (sortKey) {
			case 'cooked':
				return arr.sort((a, b) => (b.lastCookedAt ?? 0) - (a.lastCookedAt ?? 0));
			case 'cookCount':
				return arr.sort((a, b) => (b.cookCount ?? 0) - (a.cookCount ?? 0));
			case 'rating':
				return arr.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
			case 'title':
				return arr.sort((a, b) => a.title.localeCompare(b.title, currentLang() === 'de' ? 'de' : 'en'));
			case 'updated':
			default:
				return arr.sort((a, b) => b.updatedAt - a.updatedAt);
		}
	});

	const allTags = $derived(
		Array.from(new Set(recipes.flatMap((r) => r.tags ?? []))).sort((a, b) =>
			a.localeCompare(b, currentLang() === 'de' ? 'de' : 'en')
		)
	);

	const filteredRecipes = $derived.by(() => {
		let arr = sortedRecipes;
		if (activeTagFilters.length > 0) {
			arr = arr.filter((r) => activeTagFilters.every((tag) => (r.tags ?? []).includes(tag)));
		}
		const q = searchQuery.trim().toLowerCase();
		if (q) arr = arr.filter((r) => r.title.toLowerCase().includes(q));
		return arr;
	});

	const favoriteRecipes = $derived(filteredRecipes.filter((r) => r.isFavorite));
	const otherRecipes = $derived(filteredRecipes.filter((r) => !r.isFavorite));

	function loadSortPref() {
		try {
			const stored = localStorage.getItem(SORT_STORAGE_KEY);
			if (stored === 'updated' || stored === 'cooked' || stored === 'cookCount' || stored === 'rating' || stored === 'title') {
				sortKey = stored;
			}
		} catch {}
	}

	function setSortKey(k: SortKey) {
		sortKey = k;
		sortSheetOpen = false;
		try { localStorage.setItem(SORT_STORAGE_KEY, k); } catch {}
	}

	function toggleTagFilter(tag: string) {
		activeTagFilters = activeTagFilters.includes(tag)
			? activeTagFilters.filter((t) => t !== tag)
			: [...activeTagFilters, tag];
	}

	function formatLastCooked(ts: number | null | undefined): string {
		if (!ts) return '';
		return new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short' }).format(new Date(ts));
	}

	const totalTime = (r: Recipe) => {
		const mins = (r.prepTime ?? 0) + (r.cookTime ?? 0);
		return mins > 0 ? `${mins} ${t.recipe_minutes}` : null;
	};

	async function loadRecipes() {
		try {
			const res = await fetch('/api/recipes');
			if (!res.ok) throw new Error();
			const json = await res.json();
			recipes = json.recipes ?? [];
			limit = json.limit ?? 50;
			try { await cacheRecipes(json.recipes ?? []); } catch (e) { console.error('cacheRecipes failed:', e); }
		} catch {
			const cached = await getOfflineRecipes();
			recipes = cached;
			limit = cached.length;
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

	beforeNavigate(({ type, cancel }) => {
		if (type === 'popstate') {
			if (searchOpen) { closeSearch(); cancel(); return; }
			if (addSheetOpen) { addSheetOpen = false; cancel(); return; }
		} else {
			addSheetOpen = false;
			closeSearch();
		}
	});

	onMount(() => {
		loadSortPref();
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
		title={activeTab === 'mealplan' ? t.meal_plan_tab : t.recipes_title}
		subtitle={activeTab === 'recipes' ? `${recipes.length} / ${limit}` : ''}
		onMenuOpen={() => menuOpen = true}
		onSearch={activeTab === 'recipes' && !searchOpen ? () => searchOpen = true : null}
	>
		{#snippet actions()}
			{#if activeTab === 'recipes'}
				<button
					onclick={() => sortSheetOpen = true}
					class="w-9 h-9 flex-shrink-0 flex items-center justify-center active:opacity-60 transition-opacity"
					aria-label={t.recipes_sort_label}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="3" y1="6" x2="21" y2="6"/>
						<line x1="3" y1="12" x2="15" y2="12"/>
						<line x1="3" y1="18" x2="9" y2="18"/>
					</svg>
				</button>
			{/if}
		{/snippet}
	</AppHeader>

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
			{#if allTags.length > 0}
				<div class="mt-2 flex items-center gap-1.5 overflow-x-auto pb-1" style="scrollbar-width: none">
					{#each allTags as tag (tag)}
						{@const active = activeTagFilters.includes(tag)}
						<button
							onclick={() => toggleTagFilter(tag)}
							class="flex-shrink-0 h-7 px-3 rounded-full text-xs font-semibold active:opacity-60 transition-colors"
							style="background-color: {active ? 'var(--color-primary)' : 'var(--color-surface-container)'}; color: {active ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
						>{tag}</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}


	<!-- Hero header + sticky tab overlay + scroll area -->
	<div class="relative flex-1 min-h-0">
		<!-- Greeting hero (background, peeks through above bottom-anchored content) -->
		{#if activeTab === 'recipes' && !searchOpen && userSettings.greetingEnabled}
			<div class="absolute left-0 right-0 flex flex-col justify-end px-6 pb-4" style="top: calc(env(safe-area-inset-top) + 5.25rem + 3.5rem); height: 22vh; min-height: 100px; max-height: 160px; z-index: 0">
				<p class="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style="color: var(--color-on-surface-variant)">{todayDayName} · {todayDateStr}</p>
				<p class="text-2xl font-light leading-tight" style="color: var(--color-on-surface)">{todayGreeting}, {data.user?.username ?? ''}</p>
				{#if recipeInfoLine}
					<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant); opacity: 0.65">{recipeInfoLine}</p>
				{/if}
			</div>
		{/if}

		<!-- Sticky overlay: tab switcher, always visible at top, content scrolls under -->
		<div class="absolute left-0 right-0 z-10 px-4 pb-3"
		     bind:clientHeight={overlayHeight}
		     style="top: calc(env(safe-area-inset-top) + 5.25rem); background: color-mix(in srgb, var(--color-bg) 60%, transparent); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);">
			<div class="flex gap-1 p-1 rounded-2xl" style="background-color: var(--color-surface-container)">
				<button
					onclick={() => goto($page.url.pathname, { noScroll: true, keepFocus: true })}
					class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:opacity-70"
					style="background-color: {activeTab === 'recipes' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'recipes' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				>{t.recipes_title}</button>
				<button
					onclick={() => { goto(`${$page.url.pathname}?tab=mealplan`, { noScroll: true, keepFocus: true }); closeSearch(); }}
					class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all active:opacity-70"
					style="background-color: {activeTab === 'mealplan' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'mealplan' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				>{t.meal_plan_tab}</button>
			</div>
		</div>


	<!-- Meal plan -->
	{#if activeTab === 'mealplan'}
		<div class="absolute inset-0 overflow-y-auto px-4" style="z-index: 1; padding-top: calc(env(safe-area-inset-top) + 5.25rem + {overlayHeight}px); padding-bottom: 5.5rem">
			<MealPlanner {recipes} bind:editMode={mealPlanEditMode} />
		</div>

	<!-- Recipes: content scrolls under sticky overlay -->
	{:else}
		<div class="absolute inset-0 overflow-y-auto px-4" style="z-index: 1; padding-top: calc(env(safe-area-inset-top) + 5.25rem + {overlayHeight}px); padding-bottom: 5.5rem">
		<div class="min-h-full flex flex-col justify-end">

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
					<p class="text-xs mb-3" style="color: var(--color-on-surface-variant)">{t.recipes_empty_hint}</p>
					<button
						onclick={() => goto('/einstellungen')}
						class="text-xs active:opacity-60 transition-opacity"
						style="color: var(--color-primary)"
					>{t.disable_hint_recipes}</button>
				{/if}
			</div>
		{:else}
			{#snippet recipeRow(recipe: Recipe)}
				{@const metaText = totalTime(recipe) || recipe.description}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					onclick={() => goto(`/rezepte/${recipe.id}`)}
					class="w-full flex items-center gap-3 px-4 py-1 text-left active:opacity-70 transition-opacity cursor-pointer"
				>
					<div class="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
					     style="background-color: var(--color-surface-container)">
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
					<div class="flex-1 min-w-0 flex flex-col justify-center">
						<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{recipe.title}</div>
						{#if recipe.rating || metaText}
							<div class="text-xs mt-0.5 truncate flex items-center gap-1" style="color: var(--color-on-surface-variant)">
								{#if recipe.rating}
									<svg width="11" height="11" viewBox="0 0 24 24" fill="var(--color-primary)" stroke="var(--color-primary)" stroke-width="1.5" stroke-linejoin="round" class="flex-shrink-0">
										<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
									</svg>
									<span style="color: var(--color-primary)">{recipe.rating}</span>
									{#if metaText}<span aria-hidden="true">·</span>{/if}
								{/if}
								{#if metaText}<span class="truncate">{metaText}</span>{/if}
							</div>
						{/if}
					</div>
					{#if sortKey === 'cookCount' && (recipe.cookCount ?? 0) > 0}
						<div class="flex-shrink-0 flex items-center gap-1 -mr-1">
							<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>
							</svg>
							<span class="text-xs font-medium" style="color: var(--color-primary)">{recipe.cookCount}×</span>
						</div>
					{:else if sortKey === 'cooked' && recipe.lastCookedAt}
						<div class="flex-shrink-0 -mr-1">
							<span class="text-xs font-medium" style="color: var(--color-primary)">{formatLastCooked(recipe.lastCookedAt)}</span>
						</div>
					{/if}
				</div>
			{/snippet}

			<!-- Bottom-up: non-favorites bubble above, favorites bubble below (near thumb) -->
			{#if otherRecipes.length > 0}
				<div class="rounded-2xl overflow-hidden mb-2" style="background-color: var(--color-surface-card)">
					<div class="px-4 pt-3 pb-1 flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-on-surface-variant)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-on-surface-variant)">{t.recipes_title}</p>
					</div>
					{#each otherRecipes as recipe (recipe.id)}
						{@render recipeRow(recipe)}
					{/each}
					<div class="h-2"></div>
				</div>
			{/if}
			{#if favoriteRecipes.length > 0}
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
					<div class="px-4 pt-3 pb-1 flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-primary)">{t.recipe_favorite}</p>
					</div>
					{#each favoriteRecipes as recipe (recipe.id)}
						{@render recipeRow(recipe)}
					{/each}
					<div class="h-2"></div>
				</div>
			{/if}
		{/if}

		</div><!-- end inner flex-col -->
		</div><!-- end recipes scroll -->
	{/if}<!-- end tab switch -->
	</div><!-- end relative wrapper -->

	<AppBottomNav
		activeTab="recipes"
		onFabTap={activeTab === 'mealplan' ? () => { mealPlanEditMode = !mealPlanEditMode; } : (activeTab === 'recipes' ? () => addSheetOpen = true : null)}
		showFab={activeTab === 'mealplan' || activeTab === 'recipes'}
		fabLabel={activeTab === 'mealplan' ? t.meal_plan_edit : t.recipe_add}
		fabVariant={activeTab === 'mealplan' ? 'edit' : 'add'}
	/>
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Add Recipe Sheet -->
{#if addSheetOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => addSheetOpen = false}></div>
	<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pt-3"
	     style="background-color: var(--color-surface-low); bottom: 0; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
		<div class="flex justify-center mb-2">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<h2 class="text-lg font-bold mb-3" style="color: var(--color-on-surface)">{t.recipe_add}</h2>
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
			<button
				onclick={() => { addSheetOpen = false; goto('/rezepte/import'); }}
				class="w-full flex items-center gap-3 px-4 py-2.5 active:opacity-70 transition-opacity"
			>
				<div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
				     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
						<path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
					</svg>
				</div>
				<div class="text-left">
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_import_url}</div>
					<div class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipe_import_url_hint}</div>
				</div>
			</button>
			<button
				onclick={() => { addSheetOpen = false; goto('/rezepte/neu'); }}
				class="w-full flex items-center gap-3 px-4 py-2.5 active:opacity-70 transition-opacity"
			>
				<div class="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
				     style="background-color: var(--color-surface-high)">
					<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</div>
				<div class="text-left">
					<div class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.recipe_create_manual}</div>
					<div class="text-xs" style="color: var(--color-on-surface-variant)">{t.recipe_create_manual_hint}</div>
				</div>
			</button>
		</div>
	</div>
{/if}


<!-- Sort Sheet -->
{#if sortSheetOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => sortSheetOpen = false}></div>
	<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pt-3"
	     style="background-color: var(--color-surface-low); bottom: 0; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
		<div class="flex justify-center mb-2">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<h2 class="text-lg font-bold mb-3" style="color: var(--color-on-surface)">{t.recipes_sort_label}</h2>
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
			{#each [
				{ key: 'updated' as SortKey, label: t.recipes_sort_updated },
				{ key: 'cooked' as SortKey, label: t.recipes_sort_cooked },
				{ key: 'cookCount' as SortKey, label: t.recipes_sort_cook_count },
				{ key: 'rating' as SortKey, label: t.recipes_sort_rating },
				{ key: 'title' as SortKey, label: t.recipes_sort_title }
			] as opt}
				<button
					onclick={() => setSortKey(opt.key)}
					class="w-full flex items-center justify-between px-4 py-2 text-left active:opacity-60"
					style="color: {sortKey === opt.key ? 'var(--color-primary)' : 'var(--color-on-surface)'}"
				>
					<span class="text-sm" style="font-weight: {sortKey === opt.key ? 600 : 500}">{opt.label}</span>
					{#if sortKey === opt.key}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					{/if}
				</button>
			{/each}
		</div>
	</div>
{/if}
