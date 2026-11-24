<script lang="ts">
	import { onMount } from 'svelte';
	import { ArrowLeft, ArrowUpDown, ChevronRight, ListOrdered, RotateCcw, Trash2 } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import { validChecklistSections, type ChecklistSettings } from '#lib/checklists';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';
	import ChecklistSectionsEditor from './ChecklistSectionsEditor.svelte';
	import ManageSheetShell from './supplements/ManageSheetShell.svelte';

	let { owner, canReset, resetError, settings, onmode, onreset, onsavesettings, onclose }: {
		owner: boolean;
		canReset: boolean;
		resetError: boolean;
		settings: ChecklistSettings;
		onmode: (mode: 'sort' | 'delete') => void;
		onreset: () => void;
		onsavesettings: (settings: ChecklistSettings) => Promise<void>;
		onclose: () => void;
	} = $props();
	let dialog: HTMLDialogElement;
	let editingSections = $state(false);
	let draft = $state<ChecklistSettings>({ checklistSections: [], defaultSectionId: null });
	let bottomOffset = $state(0);
	let saving = $state(false);
	let saveError = $state(false);
	const title = $derived(editingSections ? t.checklist_sections : t.supplement_manage);

	onMount(() => {
		dialog.showModal();
		return watchVisualViewportBottomOffset(offset => bottomOffset = offset);
	});

	function openSections() {
		draft = { checklistSections: settings.checklistSections.map(section => ({ ...section })), defaultSectionId: settings.defaultSectionId };
		saveError = false;
		editingSections = true;
	}

	async function saveSections() {
		if (saving || !validChecklistSections(draft.checklistSections)) return;
		saving = true;
		saveError = false;
		try {
			const next = { checklistSections: draft.checklistSections.map(({ id, name }) => ({ id, name: name.trim() })), defaultSectionId: draft.defaultSectionId };
			if (JSON.stringify(next) !== JSON.stringify(settings)) await onsavesettings(next);
			editingSections = false;
		} catch { saveError = true; }
		finally { saving = false; }
	}
</script>

<dialog bind:this={dialog} aria-label={title} onclose={onclose} oncancel={event => { if (saving) event.preventDefault(); }}>
	<ManageSheetShell {title} accent="var(--color-primary)" onclose={() => { if (!saving) dialog.close(); }}
		bottom={`${bottomOffset}px`} maxHeight={`min(90dvh, calc(100dvh - ${bottomOffset}px))`}>
		{#snippet body()}
			{#if editingSections}
				<fieldset class="section-draft" disabled={saving}>
					<ChecklistSectionsEditor bind:sections={draft.checklistSections} bind:defaultSectionId={draft.defaultSectionId} />
				</fieldset>
			{:else}
				<div class="manage-settings-surface">
					{#if owner}
						<button type="button" class="manage-settings-row inset-row-divider" onclick={openSections}>
							<ListOrdered size={18} aria-hidden="true" />{t.checklist_sections}<ChevronRight class="sections-chevron" size={16} aria-hidden="true" />
						</button>
					{/if}
					<button type="button" class="manage-settings-row inset-row-divider" onclick={() => onmode('sort')}><ArrowUpDown size={18} />{t.checklist_sort}</button>
					<button type="button" class="manage-settings-row" class:inset-row-divider={owner} onclick={() => onmode('delete')}><Trash2 size={18} />{t.checklist_delete_entries}</button>
					{#if owner}<button type="button" class="manage-settings-row" disabled={!canReset} onclick={onreset}><RotateCcw size={18} />{t.checklist_reset}</button>{/if}
				</div>
			{/if}
			{#if editingSections ? saveError : resetError}<p role="alert" class="pt-2 text-center text-sm" style="color: var(--color-error)">{t.checklist_edit_error}</p>{/if}
		{/snippet}
		{#snippet footer()}
			{#if editingSections}
				<button type="button" class="manage-secondary flex items-center justify-center gap-2" disabled={saving}
					onclick={() => editingSections = false}><ArrowLeft size={18} aria-hidden="true" />{t.a11y_back}</button>
				<button type="button" class="manage-primary" disabled={saving || !validChecklistSections(draft.checklistSections)}
					onclick={saveSections}>{saving ? t.list_saving : t.list_save}</button>
			{:else}
				<button type="button" class="manage-secondary col-span-2" onclick={() => dialog.close()}>{t.close}</button>
			{/if}
		{/snippet}
	</ManageSheetShell>
</dialog>

<style>
	dialog { position: fixed; inset: 0; margin: 0; padding: 0; width: 100%; height: 100%; max-width: none; max-height: none; border: 0; background: transparent; color: var(--color-on-surface); }
	dialog::backdrop { background: transparent; }
	.manage-settings-row { display: flex; align-items: center; gap: 10px; padding-inline: 16px; border-top: 0; width: 100%; min-height: 44px; font-size: 14px; font-weight: 550; text-align: left; }
	button:disabled { opacity: .45; }
	.section-draft { min-width: 0; padding: 0; border: 0; }
	.manage-settings-row :global(.sections-chevron) { margin-left: auto; color: var(--color-on-surface-variant); }
</style>
