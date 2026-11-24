<script lang="ts">
	import type { Snippet } from 'svelte';
	import ReorderableListRows from './ReorderableListRows.svelte';
	import { Bell, Ellipsis } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import { compareChecklistEntries, type ChecklistEntryFields, type ChecklistSection } from '#lib/checklists';
	import { formatDateKey, formatClockTime, toLocalDateKey, toLocalTimeKey } from '#lib/dates';
	import { userSettings } from '#lib/userSettings.svelte';
	import SelectionCheckbox from './SelectionCheckbox.svelte';

	let { entries, sections, readOnly, onlyOpen, query, highlightedId, mode, canOrderSections, selected, onselect, onorder, ondelete, ontoggle, onedit }: {
		entries: ChecklistEntryFields[];
		sections: ChecklistSection[];
		readOnly: boolean;
		onlyOpen: boolean;
		query: string;
		highlightedId: string | null;
		mode: 'sort' | 'delete' | null;
		canOrderSections: boolean;
		selected: Set<string>;
		onselect: (id: string) => void;
		onorder: (ids: string[], sectionId?: string | null) => void;
		ondelete: (id: string) => void;
		ontoggle: (id: string) => void;
		onedit: (id: string) => void;
	} = $props();

	const groups = $derived.by(() => {
		const filter = query.trim().toLowerCase();
		const visible = entries.filter(entry =>
			(!onlyOpen || !entry.isChecked) && entry.name.toLowerCase().includes(filter))
			.sort(compareChecklistEntries);
		const bySection = new Map<string | null, ChecklistEntryFields[]>();
		const knownIds = new Set(sections.map(section => section.id));
		for (const entry of visible) {
			const key = entry.sectionId && knownIds.has(entry.sectionId) ? entry.sectionId : null;
			const group = bySection.get(key) ?? [];
			group.push(entry);
			bySection.set(key, group);
		}
		return bySection;
	});
	const visibleSections = $derived(sections.filter(section => mode === 'sort' || groups.has(section.id)));
	let revealed = $state<string | null>(null);
	let gesture: { x: number; y: number; id: string; pointer: number } | null = null;
	let suppressTap = false;
	function startSwipe(event: PointerEvent, id: string) {
		suppressTap = false;
		if (mode || readOnly || !event.isPrimary || event.button !== 0) return;
		gesture = { x: event.clientX, y: event.clientY, id, pointer: event.pointerId };
	}
	function endSwipe(event: PointerEvent) {
		if (!gesture || event.pointerId !== gesture.pointer) return;
		const dx = event.clientX - gesture.x;
		const dy = event.clientY - gesture.y;
		if (Math.abs(dx) >= 36 && Math.abs(dx) > 1.5 * Math.abs(dy)) {
			revealed = dx < 0 ? gesture.id : null;
			suppressTap = true;
		}
		gesture = null;
	}
	function reminderText(entry: ChecklistEntryFields) {
		switch (entry.reminderStatus) {
			case 'syncing': return t.checklist_reminder_sync;
			case 'sent': return t.checklist_reminder_sent;
			case 'missed': return t.checklist_reminder_missed;
			default: {
				const due = new Date(entry.remindAt!);
				const date = formatDateKey(toLocalDateKey(due), userSettings.dateFormat);
				const time = formatClockTime(toLocalTimeKey(due), userSettings.timeFormat);
				return `${date} · ${time}`;
			}
		}
	}
</script>

{#snippet entryRow(entry: ChecklistEntryFields, grip: Snippet | null)}
	<div class="entry" class:highlighted={entry.id === highlightedId} data-checklist-entry={entry.id}
		role="group" aria-label={entry.name} onpointerdown={event => startSwipe(event, entry.id)}
		onpointerup={endSwipe} onpointercancel={() => { gesture = null; }}
		onclickcapture={event => { if (suppressTap) { event.preventDefault(); event.stopPropagation(); suppressTap = false; } }}>
		<label class:completed={entry.isChecked && mode !== 'delete'} class:interactive={!readOnly && mode !== 'sort'}>
			<SelectionCheckbox label={entry.name} checked={mode === 'delete' ? selected.has(entry.id) : entry.isChecked} disabled={readOnly || mode === 'sort'}
				onchange={() => { revealed = null; mode === 'delete' ? onselect(entry.id) : ontoggle(entry.id); }} />
			<span class="entry-text">
				<span class="entry-name">{entry.name}</span>
				{#if entry.checklistNote}<span class="entry-note">{entry.checklistNote}</span>{/if}
				{#if !mode && entry.remindAt}
					<span class="entry-reminder"><Bell size={13} aria-hidden="true" class="entry-bell" />{reminderText(entry)}</span>
				{/if}
			</span>
		</label>
		{#if mode}
			{#if grip}{@render grip()}{/if}
		{:else if !readOnly && revealed === entry.id}
			<button class="delete" type="button" onclick={() => { revealed = null; ondelete(entry.id); }}>{t.item_delete}</button>
		{:else if !readOnly || entry.checklistNote}
			<button type="button" aria-label={`${readOnly ? t.checklist_entry_details : t.checklist_entry_edit} · ${entry.name}`}
				onclick={() => { revealed = null; onedit(entry.id); }}>
				<Ellipsis size={18} aria-hidden="true" />
			</button>
		{/if}
	</div>
{/snippet}

{#snippet group(id: string | null, name: string, grip: Snippet | null)}
	{@const rows = groups.get(id) ?? []}
	<section aria-label={name || t.list_type_checklist}>
		{#if name}<div class="group-heading"><h2>{name}</h2>{#if grip}{@render grip()}{/if}</div>{/if}
		{#if rows.length}
			<div class="shopping-items-surface">
				{#if mode === 'sort'}
					<ReorderableListRows items={rows} enabled={rows.length > 1} onreorder={ids => onorder(ids, id)} row={entryRow} />
				{:else}
					{#each rows as entry, index (entry.id)}
						<div class:inset-row-divider={index < rows.length - 1}>{@render entryRow(entry, null)}</div>
					{/each}
				{/if}
			</div>
		{/if}
	</section>
{/snippet}

{#if visibleSections.length || groups.has(null)}
	<div class="checklist-groups">
		{#if mode === 'sort' && canOrderSections}
			<ReorderableListRows items={visibleSections} enabled={visibleSections.length > 1} onreorder={ids => onorder(ids)}>
				{#snippet row(section, grip)}{@render group(section.id, section.name, grip)}{/snippet}
			</ReorderableListRows>
		{:else}
			{#each visibleSections as section (section.id)}{@render group(section.id, section.name, null)}{/each}
		{/if}
		{#if groups.has(null)}{@render group(null, sections.length ? t.checklist_no_section : '', null)}{/if}
	</div>
{:else}
	<p class="py-12 text-center text-sm" style="color: var(--color-on-surface-variant)">{query.trim() ? t.checklist_no_results : onlyOpen ? t.checklist_no_open : readOnly ? t.checklist_empty_read : t.checklist_empty}</p>
{/if}

<style>
	.checklist-groups > :global(div > .dragging) { border-radius: var(--radius-lg); overflow: hidden; }
	.checklist-groups > :global(div > .dragging > section > .shopping-items-surface) { background: transparent; }
	.group-heading { display: flex; align-items: center; justify-content: space-between; padding-right: 8px; }
	.entry { touch-action: pan-y; }
	.entry :global(.list-order-grip) { margin-right: 0; }
	.entry button.delete { align-self: stretch; padding: 0 16px; color: var(--color-error); background: var(--bubble-interactive-bg); }

	.checklist-groups { display: grid; gap: 10px; padding-top: 8px; }
	h2 { margin: 0 4px 4px; font: inherit; font-size: 12px; font-weight: 650; color: var(--color-on-surface-variant); overflow-wrap: anywhere; }
	.entry { display: flex; min-height: 44px; align-items: stretch; scroll-margin: 100px 0 90px; }
	.entry.highlighted { background: var(--bubble-interactive-bg); }
	label { position: relative; display: flex; min-width: 0; flex: 1; align-items: center; gap: 12px; padding: 8px 12px 8px 16px; }
	.entry-text { display: grid; grid-template-columns: minmax(0, 1fr); min-width: 0; gap: 2px; }
	.entry-name { font-size: 14px; font-weight: 600; line-height: 20px; overflow-wrap: anywhere; hyphens: auto; }
	.entry-note, .entry-reminder { color: var(--color-on-surface-variant); font-size: 12px; line-height: 16px; }
	.entry-note { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.entry-reminder { display: flex; align-items: center; gap: 5px; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
	.entry-reminder :global(.entry-bell) { flex: none; color: var(--color-primary); }
	label.interactive { cursor: pointer; }
	.completed .entry-name { text-decoration: line-through; color: var(--color-on-surface-variant); }
	.completed .entry-note { opacity: .8; }
	button { display: flex; align-items: center; justify-content: center; flex: none; min-width: 44px; padding: 0 10px; color: var(--color-on-surface-variant); }
	button:active { background: var(--bubble-interactive-bg); }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
</style>
