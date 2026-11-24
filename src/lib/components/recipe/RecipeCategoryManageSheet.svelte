<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { Plus, Trash2 } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import {
		parseRecipeCategoryName, recipeCategoryDraftValid, RECIPE_CATEGORY_LIMIT, RECIPE_CATEGORY_NAME_LIMIT, type RecipeCategory
	} from '#lib/recipeCategories';
	import { loadRecipeCategoryCatalog, recipeCategoryErrorMessage } from '#lib/recipeCategoryUi';
	import { generateClientId } from '#lib/sync/manager';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';
	import ReorderableListRows from '../ReorderableListRows.svelte';
	import ManageSheetShell from '../supplements/ManageSheetShell.svelte';

	let { onsaved, onclose }: { onsaved: (categories: RecipeCategory[]) => void; onclose: () => void } = $props();
	let dialog: HTMLDialogElement;
	let base = $state<RecipeCategory[] | null>(null);
	let draft = $state<RecipeCategory[]>([]);
	let name = $state('');
	let saving = $state(false);
	let error = $state('');
	let bottom = $state(0);
	const controller = new AbortController();
	const newName = $derived(parseRecipeCategoryName(name));
	const canAdd = $derived(!!newName && draft.length < RECIPE_CATEGORY_LIMIT &&
		!draft.some(category => category.name.trim().toLowerCase() === newName.toLowerCase()));
	const canSave = $derived(base !== null && recipeCategoryDraftValid(draft) && JSON.stringify(base) !== JSON.stringify(draft));

	async function load() {
		error = '';
		try {
			const rows = await loadRecipeCategoryCatalog(page.data.user?.id ?? null, controller.signal);
			base = rows;
			draft = rows.map(row => ({ ...row }));
		} catch {
			if (!controller.signal.aborted) error = t.recipe_categories_load_error;
		}
	}

	onMount(() => {
		dialog.showModal();
		void load();
		const unwatch = watchVisualViewportBottomOffset(offset => bottom = offset);
		return () => { controller.abort(); unwatch(); };
	});

	function add() {
		if (!canAdd || !newName) return;
		draft = [...draft, { id: generateClientId(), name: newName }];
		name = '';
	}

	function remove(id: string) {
		if (base?.some(row => row.id === id) && !confirm(t.recipe_category_remove_confirm)) return;
		draft = draft.filter(row => row.id !== id);
	}

	function reorder(ids: string[]) {
		const byId = new Map(draft.map(category => [category.id, category]));
		draft = ids.map(id => byId.get(id)!);
	}

	async function save() {
		if (!canSave || saving) return;
		saving = true;
		error = '';
		try {
			const response = await fetch('/api/recipes/categories', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ base, categories: draft })
			});
			const result = await response.json();
			if (!response.ok) {
				error = recipeCategoryErrorMessage(result.code) ?? t.recipe_categories_save_error;
				return;
			}
			onsaved(result.categories);
			dialog.close();
		} catch {
			error = t.recipe_categories_save_error;
		} finally {
			saving = false;
		}
	}
</script>

<dialog bind:this={dialog} class="fixed inset-0 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 text-inherit backdrop:bg-transparent"
	aria-label={t.recipe_categories_manage} {onclose} oncancel={event => { if (saving) event.preventDefault(); }}>
	<ManageSheetShell title={t.recipe_categories_manage} accent="var(--color-primary)" onclose={() => { if (!saving) dialog.close(); }}
		bottom={`${bottom}px`} maxHeight={`min(90dvh, calc(100dvh - ${bottom}px))`}>
		{#snippet body()}
			{#if base}
				{#if !draft.length}<p class="empty-hint">{t.recipe_categories_empty}</p>{/if}
				<fieldset class="manage-settings-surface min-w-0 p-0" disabled={saving}>
					<ReorderableListRows items={draft} enabled={!saving && draft.length > 1} onreorder={reorder}>
						{#snippet row(category, grip)}
							<div class="category-row inset-row-divider">
								<input class="manage-settings-input" aria-label={t.recipe_category_name}
									maxlength={RECIPE_CATEGORY_NAME_LIMIT} bind:value={category.name} />
								{#if grip}{@render grip()}{/if}
								<button type="button" class="remove" aria-label={t.recipe_category_remove}
									onclick={() => remove(category.id)}><Trash2 size={17} aria-hidden="true" /></button>
							</div>
						{/snippet}
					</ReorderableListRows>
					{#if draft.length < RECIPE_CATEGORY_LIMIT}
						<div class="category-row">
							<input class="manage-settings-input" aria-label={t.recipe_category_new} placeholder={t.recipe_category_name}
								maxlength={RECIPE_CATEGORY_NAME_LIMIT} bind:value={name}
								onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }} />
							<button type="button" aria-label={t.recipe_category_add} disabled={!canAdd}
								onclick={add}><Plus size={19} aria-hidden="true" /></button>
						</div>
					{/if}
				</fieldset>
			{:else if error}
				<button class="manage-secondary w-full" type="button" onclick={load}>{t.offline_retry}</button>
			{/if}
			{#if error}<p role="alert" class="pt-2 text-sm" style="color: var(--color-error)">{error}</p>{/if}
		{/snippet}
		{#snippet footer()}
			<button type="button" class="manage-secondary" disabled={saving} onclick={() => dialog.close()}>{t.item_cancel}</button>
			<button type="button" class="manage-primary" disabled={!canSave || saving} onclick={save}>{saving ? t.recipe_saving : t.list_save}</button>
		{/snippet}
	</ManageSheetShell>
</dialog>

<style>
	.empty-hint { margin: 0 0 8px; font-size: 13px; color: var(--color-on-surface-variant); }
	.category-row { display: flex; align-items: center; padding: 0 6px 0 16px; }
	.category-row input { min-width: 0; min-height: 44px; flex: 1; color: var(--color-on-surface); }
	.category-row input:focus { outline: none; }
	.category-row button { display: grid; place-items: center; flex: 0 0 44px; min-height: 44px; color: var(--color-on-surface-variant); }
	.category-row button.remove { color: var(--color-error); }
	.category-row button:disabled { opacity: .35; }
	.category-row button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
</style>
