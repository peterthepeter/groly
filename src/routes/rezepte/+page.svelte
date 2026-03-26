<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
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

	let recipes = $state<Recipe[]>([]);
	let limit = $state(50);
	let pendingShares = $state<PendingShare[]>([]);
	let loading = $state(true);
	let menuOpen = $state(false);
	let addSheetOpen = $state(false);
	let searchQuery = $state('');
	let sharesLoading = $state<Record<string, boolean>>({});

	const filteredRecipes = $derived(
		searchQuery.trim()
			? recipes.filter(r => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
			: recipes
	);

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
		loadRecipes();
		loadShares();
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={t.recipes_title}
		subtitle="{recipes.length} / {limit}"
		onMenuOpen={() => menuOpen = true}
	/>

	<div class="flex-1 flex flex-col justify-end overflow-y-auto px-4 min-h-0"
	     style="padding-top: calc(env(safe-area-inset-top) + 4rem); padding-bottom: 5rem">

		<!-- Pending Shares -->
		{#each pendingShares as share (share.id)}
			<div class="mb-3 rounded-2xl px-4 py-3 flex items-center gap-3"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-card));">
				<div class="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
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

		<!-- Search (shows when >5 recipes) -->
		{#if recipes.length > 5}
			<div class="mb-4 flex items-center gap-2 px-4 rounded-xl"
			     style="background-color: var(--color-surface-container); height: 44px">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
					<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
				</svg>
				<input
					type="search"
					placeholder={t.recipes_search_placeholder}
					bind:value={searchQuery}
					class="flex-1 bg-transparent outline-none"
					style="color: var(--color-on-surface); font-size: 16px"
				/>
			</div>
		{/if}

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
		{:else}
			<div class="space-y-2">
				{#each filteredRecipes as recipe (recipe.id)}
					<button
						onclick={() => goto(`/rezepte/${recipe.id}`)}
						class="w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl text-left active:opacity-70 transition-opacity"
						style="background-color: var(--color-surface-card)"
					>
						<!-- Thumbnail -->
						<div class="w-10 h-10 rounded-xl flex-shrink-0 overflow-hidden"
						     style="background-color: var(--color-surface-container)">
							{#if recipe.imageUrl}
								<img src={recipe.imageUrl} alt={recipe.title} class="w-full h-full object-cover" />
							{:else}
								<div class="w-full h-full flex items-center justify-center font-bold text-base"
								     style="color: var(--color-primary); font-family: 'Plus Jakarta Sans', sans-serif">
									{recipe.title[0]?.toUpperCase() ?? '?'}
								</div>
							{/if}
						</div>

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{recipe.title}</div>
							<div class="text-xs mt-0.5 truncate" style="color: var(--color-on-surface-variant)">
								{totalTime(recipe) ?? recipe.description ?? ''}
							</div>
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
	</div>

	<!-- Bottom Nav -->
	<div class="fixed bottom-0 left-0 right-0 z-30 max-w-[430px] mx-auto flex justify-center px-6 pointer-events-none"
	     style="padding-bottom: 16px">
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

			<!-- FAB -->
			<button
				onclick={() => addSheetOpen = true}
				class="w-14 h-14 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform"
				style="background-color: var(--color-primary)"
				aria-label={t.recipe_add}
			>
				<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round">
					<line x1="12" y1="5" x2="12" y2="19"/>
					<line x1="5" y1="12" x2="19" y2="12"/>
				</svg>
			</button>

			<!-- Rezepte Tab (active) -->
			<button
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
