<script lang="ts">
	import { flushSync, onMount } from 'svelte';
	import { page } from '$app/state';
	import { t } from '#lib/i18n.svelte';
	import { RECIPE_CATEGORY_LIMIT, RECIPE_CATEGORY_NAME_LIMIT, type RecipeCategory, type RecipeCategoryChoice } from '#lib/recipeCategories';
	import { loadRecipeCategoryChoices } from '#lib/recipeCategoryUi';
	import SettingsSelectRow from '../SettingsSelectRow.svelte';

	let { value = $bindable(), currentName = null }: {
		value: RecipeCategoryChoice;
		currentName?: string | null;
	} = $props();
	let categories = $state<RecipeCategory[] | null>(null);
	let failed = $state(false);
	let controller: AbortController;
	let nameInput = $state<HTMLInputElement>();

	const selected = $derived('newCategoryName' in value ? ':new' : value.categoryId ?? '');
	const options = $derived([
		{ value: '', label: t.recipe_category_none },
		...(categories ?? []).map(category => ({ value: category.id, label: category.name })),
		...(categories && categories.length < RECIPE_CATEGORY_LIMIT ? [{ value: ':new', label: t.recipe_category_new }] : [])
	]);

	function selectCategory(option: string) {
		if (option !== ':new') {
			value = { categoryId: option || null };
			return;
		}
		// Mount and focus inside the option's click so iOS can open the keyboard.
		if (!('newCategoryName' in value)) flushSync(() => { value = { newCategoryName: '' }; });
		nameInput?.focus({ preventScroll: true });
		nameInput?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
	}

	async function load() {
		controller?.abort();
		const request = new AbortController();
		controller = request;
		failed = false;
		try {
			const result = await loadRecipeCategoryChoices(page.data.user?.id ?? null, request.signal);
			if (!request.signal.aborted) categories = result;
		} catch {
			if (!request.signal.aborted) failed = true;
		}
	}

	onMount(() => {
		void load();
		return () => controller?.abort();
	});
</script>

{#if categories}
	<div class="category-select">
		<SettingsSelectRow label={t.recipe_category}
			value={options.some(option => option.value === selected) ? selected : ''}
			{options} onchange={selectCategory} />
	</div>
	{#if 'newCategoryName' in value}
		<div class="category-name">
			<input type="text" autocomplete="off" aria-label={t.recipe_category_name} placeholder={t.recipe_category_name}
				maxlength={RECIPE_CATEGORY_NAME_LIMIT} bind:this={nameInput} bind:value={value.newCategoryName} />
		</div>
	{/if}
{:else}
	<div class="category-placeholder" aria-busy={!failed}>
		<span>{t.recipe_category}</span>
		{#if failed}
			<button type="button" aria-label={t.recipe_categories_load_error} onclick={load}>{t.offline_retry}</button>
		{:else if currentName}
			<span class="category-current">{currentName}</span>
		{/if}
	</div>
{/if}

<style>
	.category-select :global(.settings-select-value) { max-width: 64%; }
	.category-name { border-top: 1px solid var(--bubble-container-border); margin-inline: 16px; }
	.category-name input { width: 100%; min-height: 44px; padding-inline: 4px; font-size: 16px; color: var(--color-on-surface); background: transparent; outline: none; }
	.category-placeholder { min-height: 44px; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding-inline: 20px; font-weight: 550; }
	.category-placeholder button { min-height: 44px; color: var(--color-primary); }
	.category-current { color: var(--color-on-surface-variant); overflow-wrap: anywhere; }
</style>
