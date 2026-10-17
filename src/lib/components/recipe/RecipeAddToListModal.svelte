<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { goto } from '$app/navigation';
	import { t, recipeShoppingAddLabel } from '#lib/i18n.svelte';
	import { scaleAmount, type Recipe } from '#lib/recipeUtils';
	import { fetchWithTimeout, generateClientId } from '#lib/sync/manager';
	import ManageSheetShell from '#lib/components/supplements/ManageSheetShell.svelte';

	let { recipe, excludedIngredients, currentServings, originalServings, selectionSaving, selectionUnavailable, selectionSaveError, onToggleIngredient, onRetrySelection, onClose }: {
		recipe: Recipe;
		excludedIngredients: Set<string>;
		currentServings: number;
		originalServings: number;
		selectionSaving: boolean;
		selectionUnavailable: boolean;
		selectionSaveError: boolean;
		onToggleIngredient: (id: string) => void;
		onRetrySelection: () => void;
		onClose: () => void;
	} = $props();

	type ListEntry = { id: string; name: string };
	let lists = $state<ListEntry[]>([]);
	let listsLoading = $state(true);
	let listsError = $state(false);
	let listSearch = $state('');
	let selectedListId = $state('');
	let newListName = $state('');
	let addingToList = $state(false);
	let addError = $state(false);
	let dialog: HTMLDivElement;
	const itemIds = new Map<string, string>();
	// Freeze the grouping for this opening; live toggles never move a row.
	const openingExclusions = untrack(() => new Set(excludedIngredients));
	const shoppingIngredients = $derived([
		...recipe.ingredients.filter(ingredient => !openingExclusions.has(ingredient.id)),
		...recipe.ingredients.filter(ingredient => openingExclusions.has(ingredient.id))
	]);
	const selectedIngredients = $derived(recipe.ingredients.filter(ingredient => !excludedIngredients.has(ingredient.id)));
	const filteredLists = $derived(lists.filter(list => list.id === selectedListId || list.name.toLowerCase().includes(listSearch.trim().toLowerCase())));
	const canAdd = $derived(selectedIngredients.length > 0 && !addingToList && !selectionSaving && !selectionSaveError && !listsLoading && !listsError && Boolean(selectedListId) && (selectedListId !== '__new__' || Boolean(newListName.trim())));

	async function loadLists() {
		listsLoading = true;
		listsError = false;
		try {
			const response = await fetchWithTimeout('/api/lists');
			if (!response.ok) throw new Error('Lists unavailable');
			const data = await response.json();
			lists = data.lists ?? data ?? [];
			if (selectedListId !== '__new__' && !lists.some(list => list.id === selectedListId)) selectedListId = '';
		} catch {
			listsError = true;
		} finally {
			listsLoading = false;
		}
	}

	async function submit() {
		if (!canAdd) return;
		addingToList = true;
		addError = false;
		try {
			let listId = selectedListId;
			if (listId === '__new__') {
				const response = await fetchWithTimeout('/api/lists', {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name: newListName.trim(), description: null, iconId: 'rezept' })
				});
				if (!response.ok) throw new Error('List could not be created');
				const created = await response.json();
				if (typeof created.id !== 'string') throw new Error('Invalid list response');
				listId = created.id;
				lists = [...lists, { id: listId, name: newListName.trim() }];
				selectedListId = listId;
			}
			const results = await Promise.allSettled(selectedIngredients.map(ingredient => {
				// A retry reuses the ID, including when a successful POST lost its
				// response. The existing item endpoint handles this idempotently.
				const key = `${listId}/${ingredient.id}`;
				let id = itemIds.get(key);
				if (!id) { id = generateClientId(); itemIds.set(key, id); }
				const quantityInfo = `${scaleAmount(ingredient.amount, currentServings, originalServings) ?? ''}${ingredient.unit ? ' ' + ingredient.unit : ''}`.trim() || null;
				return fetchWithTimeout(`/api/lists/${listId}/items`, {
					method: 'POST', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ id, name: ingredient.name, quantityInfo })
				});
			}));
			if (results.some(result => result.status === 'rejected' || !result.value.ok)) throw new Error('Ingredients could not be added');
			onClose();
			await goto(`/listen/${listId}`);
		} catch {
			addError = true;
		} finally {
			addingToList = false;
		}
	}

	function close() { if (!addingToList) onClose(); }
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); close(); }
		if (event.key !== 'Tab') return;
		const controls = Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), select:not([disabled])')).filter(element => element.getClientRects().length > 0);
		const first = controls[0], last = controls.at(-1);
		if (!first) { event.preventDefault(); return; }
		if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
		else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
	}

	onMount(() => {
		const previousFocus = document.activeElement as HTMLElement | null;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		dialog.querySelector<HTMLInputElement>('input[type="checkbox"]')?.focus({ preventScroll: true });
		void loadLists();
		return () => {
			document.body.style.overflow = previousOverflow;
			if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} />
<div bind:this={dialog} role="dialog" aria-modal="true" aria-label={t.recipe_shopping_title}>
	<ManageSheetShell accent="var(--color-primary)" title={t.recipe_shopping_title} subtitle={recipe.title} onclose={close} maxHeight="90dvh">
		{#snippet body()}
			<div class="manage-stack">
				<p class="shopping-hint" role="status">{selectionSaving ? t.recipe_shopping_saving : t.recipe_shopping_hint}</p>
				<div class="manage-settings-surface" data-shopping-ingredients>
					{#each shoppingIngredients as ingredient (ingredient.id)}
						<label class="manage-settings-row shopping-ingredient">
							<input class="shopping-native-check" type="checkbox" checked={!excludedIngredients.has(ingredient.id)} onchange={() => onToggleIngredient(ingredient.id)} disabled={addingToList || selectionUnavailable} aria-label={ingredient.name} />
							<span class="shopping-check" aria-hidden="true" style:background-color={excludedIngredients.has(ingredient.id) ? 'transparent' : 'var(--color-primary)'} style:border-color={excludedIngredients.has(ingredient.id) ? 'var(--color-outline)' : 'var(--color-primary)'}>
								{#if !excludedIngredients.has(ingredient.id)}
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
								{/if}
							</span>
							{#if ingredient.amount || ingredient.unit}
								<span class="shopping-amount" style:color={excludedIngredients.has(ingredient.id) ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}>{scaleAmount(ingredient.amount, currentServings, originalServings) ?? ''}{ingredient.unit ? '\u00a0' + ingredient.unit : ''}</span>
							{/if}
							<span class="shopping-name">{ingredient.name}</span>
						</label>
					{/each}
				</div>
			</div>
		{/snippet}
		{#snippet footer()}
			<div class="col-span-2 shopping-target">
				<label class="manage-label" for="recipe-shopping-list">{t.recipe_shopping_list}</label>
				{#if lists.length > 4}
					<input type="search" class="manage-input" aria-label={t.recipe_list_search} placeholder={t.recipe_list_search} bind:value={listSearch} disabled={addingToList} />
				{/if}
				<div class="shopping-select-field">
				<select id="recipe-shopping-list" class="manage-select" bind:value={selectedListId} disabled={listsLoading || listsError || addingToList} onchange={() => { if (selectedListId === '__new__' && !newListName) newListName = recipe.title; }}>
					<option value="" disabled>{t.recipe_shopping_choose_list}</option>
					{#each filteredLists as list (list.id)}<option value={list.id}>{list.name}</option>{/each}
					<option value="__new__">{t.recipe_new_list}</option>
				</select>
				</div>
				{#if listSearch.trim() && filteredLists.length === 0}<p class="shopping-hint">{t.recipe_shopping_no_lists}</p>{/if}
				{#if selectedListId === '__new__'}
					<label class="manage-label" for="recipe-shopping-list-name">{t.recipe_shopping_list_name}</label>
					<input id="recipe-shopping-list-name" class="manage-input" type="text" bind:value={newListName} disabled={addingToList} onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); void submit(); } }} />
				{/if}
			</div>
			{#if listsError || selectionSaveError || addError}
				<div class="col-span-2 shopping-error" role="alert">
					<p>{listsError ? t.recipe_shopping_load_error : selectionSaveError ? (selectionUnavailable ? t.recipe_shopping_load_selection_error : t.recipe_shopping_save_error) : t.recipe_shopping_add_error}</p>
					{#if listsError || selectionSaveError}<button type="button" onclick={() => { if (listsError) void loadLists(); if (selectionSaveError) onRetrySelection(); }}>{t.recipe_shopping_retry}</button>{/if}
				</div>
			{/if}
			<button type="button" class="manage-secondary shopping-action disabled:opacity-40" onclick={close} disabled={addingToList}>{t.close}</button>
			<button type="button" class="manage-primary shopping-action disabled:opacity-40" style="color: var(--color-on-primary)" onclick={submit} disabled={!canAdd}>{addingToList ? '…' : recipeShoppingAddLabel(selectedIngredients.length)}</button>
		{/snippet}
	</ManageSheetShell>
</div>

<style>
	.shopping-hint { font-size: 12px; line-height: 1.45; color: var(--color-on-surface-variant); }
	.shopping-ingredient { min-height: 40px; padding-block: 4px; position: relative; display: flex; align-items: center; gap: 10px; cursor: pointer; }
	.shopping-native-check { position: absolute; inset: 0; width: 100%; height: 100%; margin: 0; opacity: 0; cursor: inherit; }
	.shopping-check { display: flex; width: 18px; height: 18px; flex: none; align-items: center; justify-content: center; border: 1.5px solid; border-radius: 5px; }
	.shopping-ingredient input:focus-visible + .shopping-check { outline: 2px solid var(--color-primary); outline-offset: 3px; }
	.shopping-ingredient:has(input:disabled) { cursor: default; }
	.shopping-amount { flex: none; max-width: 32%; font-size: 14px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
	.shopping-name { min-width: 0; flex: 1; font-size: 14px; line-height: 1.4; color: var(--color-on-surface); overflow-wrap: anywhere; }
	.shopping-select-field { position: relative; color: var(--color-on-surface-variant); }
	.shopping-select-field::after { content: ''; position: absolute; right: 16px; top: 50%; width: 7px; height: 7px; border: solid currentColor; border-width: 0 1.5px 1.5px 0; transform: translateY(-70%) rotate(45deg); pointer-events: none; }
	.shopping-select-field select { appearance: none; padding-right: 38px; }
	.shopping-target { display: grid; min-width: 0; gap: 5px; }
	.shopping-target :global(input), .shopping-target :global(select) { min-height: 44px; }
	.shopping-target :global(.manage-label) { margin-bottom: 0; }
	.shopping-action { min-height: 44px; height: auto; padding: 8px 10px; line-height: 1.3; }
	.shopping-error { font-size: 12px; line-height: 1.4; color: var(--color-error); }
	.shopping-error button { min-height: 40px; text-decoration: underline; color: var(--color-on-surface); }
</style>
