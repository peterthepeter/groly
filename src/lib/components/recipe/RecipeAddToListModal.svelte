<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';
	import { scaleAmount, type Recipe } from '$lib/recipeUtils';

	let { recipe, excludedIngredients, currentServings, originalServings, open, onClose }: {
		recipe: Recipe;
		excludedIngredients: Set<string>;
		currentServings: number;
		originalServings: number;
		open: boolean;
		onClose: () => void;
	} = $props();

	type ListEntry = { id: string; name: string; iconId: string | null };

	let lists = $state<ListEntry[]>([]);
	let listsLoading = $state(false);
	let listSearch = $state('');
	let addingToList = $state(false);
	let newListMode = $state(false);
	let newListName = $state('');

	const filteredLists = $derived(
		listSearch.trim()
			? lists.filter(l => l.name.toLowerCase().includes(listSearch.toLowerCase()))
			: lists
	);

	async function loadLists() {
		listsLoading = true;
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) throw new Error();
			const data = await res.json();
			lists = data.lists ?? data ?? [];
		} catch {
			lists = [];
		}
		listsLoading = false;
	}

	async function addToList(listId: string) {
		if (addingToList) return;
		addingToList = true;
		try {
			const toAdd = recipe.ingredients
				.filter(ing => !excludedIngredients.has(ing.id))
				.map(ing => ({
					name: ing.name,
					quantityInfo: ing.amount || ing.unit
						? `${scaleAmount(ing.amount, currentServings, originalServings) ?? ''}${ing.unit ? ' ' + ing.unit : ''}`.trim() || null
						: null
				}));

			await Promise.all(toAdd.map(item =>
				fetch(`/api/lists/${listId}/items`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(item)
				})
			));
			goto(`/listen/${listId}`);
		} finally {
			addingToList = false;
		}
	}

	async function createNewListAndAdd() {
		const name = newListName.trim();
		if (addingToList || !name) return;
		addingToList = true;
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description: null, iconId: 'rezept' })
			});
			if (!res.ok) throw new Error();
			const newList = await res.json();
			addingToList = false;
			await addToList(newList.id);
		} catch {
			addingToList = false;
		}
	}

	$effect(() => {
		if (open && lists.length === 0) {
			newListMode = false;
			newListName = '';
			loadLists();
		}
	});
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color: rgba(0,0,0,0.6)"
	     onclick={(e) => { if (e.target === e.currentTarget && !addingToList) onClose(); }}>
		<div class="w-full max-w-[430px] rounded-t-3xl px-4 pb-10 pt-4"
		     style="background-color: var(--color-surface-low); max-height: 80vh; display: flex; flex-direction: column">
			<div class="flex justify-center mb-4 flex-shrink-0">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<h2 class="text-lg font-bold mb-3 px-2 flex-shrink-0" style="color: var(--color-on-surface)">{t.recipe_to_list_title}</h2>

			<!-- Search -->
			{#if lists.length > 4}
				<div class="flex items-center gap-2 px-4 rounded-xl mb-3 flex-shrink-0"
				     style="background-color: var(--color-surface-container); height: 44px">
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
					</svg>
					<input type="search" placeholder={t.recipe_list_search} bind:value={listSearch}
					       class="flex-1 bg-transparent outline-none"
					       style="color: var(--color-on-surface); font-size: 16px" />
				</div>
			{/if}

			<div class="overflow-y-auto flex-1 space-y-2 px-0">
				<!-- New list option -->
				{#if newListMode}
					<div class="flex items-center gap-2 px-4 py-3 rounded-xl"
					     style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={newListName}
							onkeydown={(e) => { if (e.key === 'Enter') createNewListAndAdd(); if (e.key === 'Escape') { newListMode = false; } }}
							class="flex-1 bg-transparent outline-none font-semibold"
							style="color: var(--color-on-surface); font-size: 16px"
							autofocus
						/>
						<button
							onclick={createNewListAndAdd}
							disabled={!newListName.trim() || addingToList}
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:opacity-70"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))"
						>
							{#if addingToList}
								<div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--color-on-primary); border-top-color: transparent"></div>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
						</button>
						<button
							onclick={() => newListMode = false}
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70"
							style="background-color: var(--color-surface-high)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
				{:else}
					<button
						onclick={() => { newListName = recipe.title; newListMode = true; }}
						disabled={addingToList}
						class="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70 disabled:opacity-40 transition-opacity"
						style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))"
					>
						<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
						     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round">
								<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
						</div>
						<span class="text-sm font-semibold" style="color: var(--color-primary)">{t.recipe_new_list}</span>
					</button>
				{/if}

				{#if listsLoading}
					<div class="flex justify-center py-4">
						<div class="w-5 h-5 rounded-full border-2 animate-spin"
						     style="border-color: var(--color-primary); border-top-color: transparent"></div>
					</div>
				{:else}
					{#each filteredLists as list (list.id)}
						<button
							onclick={() => addToList(list.id)}
							disabled={addingToList}
							class="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70 disabled:opacity-40 transition-opacity text-left"
							style="background-color: var(--color-surface-card)"
						>
							<span class="flex-1 text-sm font-medium truncate" style="color: var(--color-on-surface)">{list.name}</span>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						</button>
					{/each}
				{/if}
			</div>
		</div>
	</div>
{/if}
