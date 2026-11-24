<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { t } from '#lib/i18n.svelte';
	import { recipeCategoryChoiceValid, type RecipeCategoryChoice } from '#lib/recipeCategories';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';
	import ManageSheetShell from '../supplements/ManageSheetShell.svelte';
	import RecipeCategoryPicker from './RecipeCategoryPicker.svelte';

	let { categoryId, categoryName, onsave, onclose }: {
		categoryId: string | null;
		categoryName: string | null;
		onsave: (choice: RecipeCategoryChoice) => Promise<void>;
		onclose: () => void;
	} = $props();
	let choice = $state<RecipeCategoryChoice>({ categoryId: untrack(() => categoryId) });
	let saving = $state(false);
	let error = $state('');
	let bottom = $state(0);
	let dialog: HTMLDialogElement;
	const canSave = $derived(recipeCategoryChoiceValid(choice) && (!('categoryId' in choice) || choice.categoryId !== categoryId));

	onMount(() => {
		dialog.showModal();
		return watchVisualViewportBottomOffset(offset => bottom = offset);
	});

	async function save() {
		if (!canSave || saving) return;
		saving = true;
		error = '';
		try {
			await onsave({ ...choice });
			dialog.close();
		} catch (reason) {
			error = reason instanceof Error ? reason.message : t.recipe_categories_save_error;
		} finally {
			saving = false;
		}
	}
</script>

<dialog bind:this={dialog} class="fixed inset-0 m-0 h-full w-full max-h-none max-w-none border-0 bg-transparent p-0 text-inherit backdrop:bg-transparent"
	aria-label={t.recipe_category_change} {onclose} oncancel={event => { if (saving) event.preventDefault(); }}>
	<ManageSheetShell title={t.recipe_category_change} accent="var(--color-primary)" onclose={() => { if (!saving) dialog.close(); }}
		bottom={`${bottom}px`} maxHeight={`min(90dvh, calc(100dvh - ${bottom}px))`}>
		{#snippet body()}
			<fieldset class="manage-settings-surface min-w-0 p-0" disabled={saving}>
				<RecipeCategoryPicker bind:value={choice} currentName={categoryName} />
			</fieldset>
			{#if error}<p role="alert" class="pt-2 text-sm" style="color: var(--color-error)">{error}</p>{/if}
		{/snippet}
		{#snippet footer()}
			<button type="button" class="manage-secondary" disabled={saving} onclick={() => dialog.close()}>{t.item_cancel}</button>
			<button type="button" class="manage-primary" disabled={!canSave || saving} onclick={save}>{saving ? t.recipe_saving : t.list_save}</button>
		{/snippet}
	</ManageSheetShell>
</dialog>
