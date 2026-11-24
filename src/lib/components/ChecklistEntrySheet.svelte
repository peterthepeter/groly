<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { Bell } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import ItemEditSheet from './ItemEditSheet.svelte';
	import SettingsSelectRow from './SettingsSelectRow.svelte';
	import SettingsToggleRow from './SettingsToggleRow.svelte';
	import './reminder-time.css';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';
	import { CHECKLIST_NOTE_LIMIT, type ChecklistEntryEdit, type ChecklistEntryFields, type ChecklistSection } from '#lib/checklists';
	import { formatDateKey, formatClockTime, toLocalDateKey, toLocalTimeKey } from '#lib/dates';
	import { userSettings } from '#lib/userSettings.svelte';

	let { sections, item, favorites, pushAvailable, readOnly, onedit, ondelete, onfavorite, onclose }: {
		sections: ChecklistSection[];
		item: ChecklistEntryFields;
		favorites: { name: string }[];
		pushAvailable: boolean | null;
		readOnly: boolean;
		onedit: (changes: ChecklistEntryEdit) => Promise<void>;
		ondelete: () => Promise<void>;
		onfavorite: (name: string, remove: boolean) => Promise<void>;
		onclose: () => void;
	} = $props();

	const initial = untrack(() => ({ name: item.name, section: item.sectionId ?? '',
		note: item.checklistNote ?? null, remindAt: item.remindAt ?? null }));
	let name = $state(initial.name);
	let note = $state(initial.note ?? '');
	let sectionId = $state(initial.section);
	let reminder = $state(Boolean(initial.remindAt));
	const current = new Date();
	const nextMinute = Math.ceil((current.getTime() + 60_000) / 60_000) * 60_000;
	const initialDate = new Date(initial.remindAt ?? nextMinute);
	let date = $state(toLocalDateKey(initialDate));
	let time = $state(toLocalTimeKey(initialDate));
	let bottomOffset = $state(0);
	let saving = $state(false);
	let error = $state('');
	const activeFavorite = $derived(favorites.find(entry => entry.name.toLowerCase() === item.name.trim().toLowerCase()));
	const options = $derived([{ value: '', label: t.checklist_no_section }, ...sections.map(section => ({ value: section.id, label: section.name }))]);
	const selectedSection = $derived(options.find(option => option.value === sectionId) ?? options[0]);
	onMount(() => watchVisualViewportBottomOffset(offset => bottomOffset = offset));

	async function save() {
		if (!name.trim() || saving) return;
		error = '';
		const remindAt = reminder && !item.isChecked ? new Date(`${date}T${time}`).getTime() : null;
		const reminderChanged = remindAt !== initial.remindAt;
		if (reminderChanged && remindAt !== null && (!Number.isFinite(remindAt) || remindAt <= Date.now())) {
			error = t.checklist_reminder_past;
			return;
		}
		saving = true;
		try {
			const checklistNote = note.trim() || null;
			await onedit({ name: name.trim(), sectionId: selectedSection.value || null,
				...(checklistNote !== initial.note ? { checklistNote } : {}), ...(reminderChanged ? { remindAt } : {}) });
		} catch { error = t.checklist_edit_error; } finally { saving = false; }
	}

	async function favorite(value: string, remove: boolean) {
		if (saving) return;
		saving = true;
		error = '';
		try { await onfavorite(value, remove); } catch { error = t.checklist_edit_error; } finally { saving = false; }
	}

	async function deleteEntry() {
		if (saving || !confirm(t.checklist_entry_delete_confirm)) return;
		saving = true;
		try { await ondelete(); } catch { error = t.checklist_edit_error; } finally { saving = false; }
	}
</script>

<ItemEditSheet title={readOnly ? t.checklist_entry_details : t.checklist_entry_edit} saveLabel={t.item_save} deleteLabel={t.checklist_entry_delete}
	onClose={() => { if (!saving) onclose(); }} onDelete={readOnly ? null : deleteEntry} onSave={readOnly ? undefined : save}
	saveDisabled={!name.trim()} busy={saving} {error} {bottomOffset} isFavorite={Boolean(activeFavorite)}
	onToggleFavorite={readOnly ? null : () => favorite(activeFavorite?.name ?? item.name, Boolean(activeFavorite))}>
	{#snippet fields()}
		{#if readOnly}
			<div class="entry-details">
				<p class="font-semibold">{item.name}</p>
				{#if item.checklistNote}<p class="detail-note">{item.checklistNote}</p>{/if}
			</div>
		{:else}
			<div class="checklist-editor">
				<SettingsSelectRow label={t.checklist_section} value={selectedSection.value} options={options} onchange={value => sectionId = value} />
				<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
				<input class="block h-11 w-full bg-transparent px-4 text-base font-medium outline-none" style="color: var(--color-on-surface)"
					type="text" aria-label={t.checklist_entry} placeholder={t.checklist_entry}
					bind:value={name} autocomplete="off" onkeydown={event => {
						if (event.key === 'Enter') { event.preventDefault(); void save(); }
						if (event.key === 'Escape' && !saving) onclose();
					}} />
				<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
				<textarea class="block min-h-11 w-full resize-none bg-transparent px-4 py-2.5 text-base outline-none"
					style="color: var(--color-on-surface)" rows="2" maxlength={CHECKLIST_NOTE_LIMIT}
					aria-label={t.checklist_note} placeholder={t.checklist_note} bind:value={note}
					onkeydown={event => { if (event.key === 'Escape' && !saving) onclose(); }}></textarea>
				{#if !item.isChecked}
					<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
					<SettingsToggleRow label={t.checklist_reminder} checked={reminder} onchange={() => reminder = !reminder}>
						{#snippet icon()}<Bell size={18} aria-hidden="true" />{/snippet}
					</SettingsToggleRow>
					{#if reminder}
						<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
						<div class="reminder-schedule-row checklist-reminder-schedule">
							<label class="reminder-time-cell">
								<span class="reminder-label">{t.checklist_reminder_date}</span>
								<span class="reminder-time-field">
									<input class="reminder-time-picker" type="date" aria-label={t.checklist_reminder_date} bind:value={date} />
									<span class="reminder-time-value" aria-hidden="true">{date ? formatDateKey(date, userSettings.dateFormat) : '–'}</span>
								</span>
							</label>
							<label class="reminder-time-cell">
								<span class="reminder-label">{t.checklist_reminder_time}</span>
								<span class="reminder-time-field">
									<input class="reminder-time-picker" type="time" aria-label={t.checklist_reminder_time} bind:value={time} />
									<span class="reminder-time-value" aria-hidden="true">{time ? formatClockTime(time, userSettings.timeFormat) : '–'}</span>
								</span>
							</label>
						</div>
						{#if pushAvailable === false}<p class="hint">{t.checklist_reminder_no_push}</p>{/if}
					{/if}
				{/if}
			</div>
		{/if}
	{/snippet}
</ItemEditSheet>

<style>
	.entry-details { padding: 12px 16px; overflow-wrap: anywhere; }
	.entry-details p { margin: 0; }
	.entry-details .detail-note { margin-top: 6px; color: var(--color-on-surface-variant); white-space: pre-wrap; }
	.checklist-editor :global(.settings-select-row) { padding-inline: 16px; }
	.checklist-reminder-schedule:global(.reminder-schedule-row) {
		--manage-accent: var(--color-primary);
		grid-template-columns: repeat(2, minmax(0, 1fr));
		padding-inline: 16px;
		border-top: 0;
	}
	.reminder-label { display: block; font-size: 11px; font-weight: 600; line-height: 14px; color: var(--color-on-surface-variant); }
	.checklist-reminder-schedule :global(.reminder-time-picker::-webkit-calendar-picker-indicator) { position: absolute; inset: 0; width: auto; height: auto; margin: 0; padding: 0; }
	.hint { margin: 0; padding: 5px 16px 8px; color: var(--color-on-surface-variant); font-size: 12px; }
</style>
