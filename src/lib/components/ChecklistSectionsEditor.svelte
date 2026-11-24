<script lang="ts">
	import { Plus, Trash2 } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import { CHECKLIST_SECTION_LIMIT, CHECKLIST_SECTION_NAME_LIMIT, orderChecklistRows, type ChecklistSection } from '#lib/checklists';
	import { generateClientId } from '#lib/sync/manager';
	import ReorderableListRows from './ReorderableListRows.svelte';
	import SettingsSelectRow from './SettingsSelectRow.svelte';

	let { sections = $bindable(), defaultSectionId = $bindable() }: {
		sections: ChecklistSection[];
		defaultSectionId: string | null;
	} = $props();
	let sectionName = $state('');
	const sectionOptions = $derived([{ value: '', label: t.checklist_no_section },
		...sections.map(section => ({ value: section.id, label: section.name || t.checklist_section }))]);
	const canAdd = $derived(Boolean(sectionName.trim()) && sections.length < CHECKLIST_SECTION_LIMIT &&
		!sections.some(section => section.name.trim().toLowerCase() === sectionName.trim().toLowerCase()));

	function addSection() {
		if (!canAdd) return;
		sections = [...sections, { id: generateClientId(), name: sectionName.trim() }];
		sectionName = '';
	}

	function removeSection(sectionId: string) {
		if (!confirm(t.checklist_section_remove_confirm)) return;
		sections = sections.filter(section => section.id !== sectionId);
		if (defaultSectionId === sectionId) defaultSectionId = null;
	}
</script>

<div class="manage-settings-surface sections-surface">
	<div class="inset-row-divider">
		<SettingsSelectRow label={t.checklist_default_section} value={defaultSectionId ?? ''} options={sectionOptions}
			onchange={value => defaultSectionId = value || null} />
	</div>
	<ReorderableListRows items={sections} enabled={sections.length > 1} onreorder={ids => sections = orderChecklistRows(sections, ids)}>
		{#snippet row(section, grip)}
			<div class="checklist-section-row">
				<input class="manage-settings-input" aria-label={t.checklist_section_name} maxlength={CHECKLIST_SECTION_NAME_LIMIT} bind:value={section.name} />
				{#if grip}{@render grip()}{/if}
				<button type="button" class="section-remove" aria-label={t.checklist_section_remove} onclick={() => removeSection(section.id)}><Trash2 size={17} aria-hidden="true" /></button>
			</div>
		{/snippet}
	</ReorderableListRows>
	{#if sections.length < CHECKLIST_SECTION_LIMIT}
		<div class="checklist-section-row">
			<input class="manage-settings-input" placeholder={t.checklist_section_name} aria-label={t.checklist_section_name}
				maxlength={CHECKLIST_SECTION_NAME_LIMIT} bind:value={sectionName}
				onkeydown={event => { if (event.key === 'Enter') { event.preventDefault(); addSection(); } }} />
			<button type="button" aria-label={t.checklist_section_add} disabled={!canAdd} onclick={addSection}><Plus size={19} aria-hidden="true" /></button>
		</div>
	{/if}
</div>

<style>
	.sections-surface { border-radius: 16px; }
	.sections-surface :global(.settings-select-label) { font-weight: 600; }
	.checklist-section-row { display: flex; align-items: center; padding: 0 6px 0 20px; }
	.checklist-section-row input { flex: 1; min-width: 0; min-height: 44px; color: var(--color-on-surface); }
	.checklist-section-row button { flex: 0 0 44px; min-height: 44px; display: grid; place-items: center; color: var(--color-on-surface-variant); }
	.checklist-section-row button:focus-visible, .checklist-section-row input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
	.checklist-section-row button:active { background: var(--bubble-interactive-bg); }
	.checklist-section-row .section-remove { color: var(--color-error); }
	.checklist-section-row button:disabled { opacity: .35; }
</style>
