<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';

	type ReminderEntry = {
		id: string | null;
		days: number[];
		time: string;
		saving: boolean;
		saved: boolean;
		deleting: boolean;
	};

	type ReminderSheetType = { supplementId: string; supplementName: string };

	let {
		reminderSheet = $bindable<ReminderSheetType | null>(null),
		reminderEntries = $bindable<ReminderEntry[]>([]),
		reminderLoading = $bindable(false),
		onrefreshindicators
	}: {
		reminderSheet: ReminderSheetType | null;
		reminderEntries: ReminderEntry[];
		reminderLoading: boolean;
		onrefreshindicators: () => void;
	} = $props();

	// Days in display order: Mo Di Mi Do Fr Sa So
	const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const DAY_LABELS = $derived([
		t.supplement_day_mo, t.supplement_day_di, t.supplement_day_mi,
		t.supplement_day_do, t.supplement_day_fr, t.supplement_day_sa, t.supplement_day_so
	]);

	function addReminderEntry() {
		reminderEntries = [...reminderEntries, { id: null, days: [1, 2, 3, 4, 5], time: '08:00', saving: false, saved: false, deleting: false }];
	}

	function toggleDay(entry: ReminderEntry, day: number) {
		if (entry.days.includes(day)) {
			entry.days = entry.days.filter(d => d !== day);
		} else {
			entry.days = [...entry.days, day];
		}
	}

	async function saveReminderEntry(entry: ReminderEntry) {
		if (!reminderSheet || entry.days.length === 0) return;
		entry.saving = true;
		try {
			if (entry.id) {
				await fetch(`/api/supplement-reminders/${entry.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ days: entry.days, time: entry.time })
				});
			} else {
				const res = await fetch('/api/supplement-reminders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ supplementId: reminderSheet.supplementId, days: entry.days, time: entry.time })
				});
				if (res.ok) {
					const resData = await res.json();
					entry.id = resData.id;
				}
			}
			entry.saved = true;
			setTimeout(() => { entry.saved = false; }, 1500);
			onrefreshindicators();
		} finally {
			entry.saving = false;
		}
	}

	async function deleteReminderEntry(entry: ReminderEntry) {
		if (entry.id === null) {
			reminderEntries = reminderEntries.filter(e => e !== entry);
			return;
		}
		entry.deleting = true;
		try {
			await fetch(`/api/supplement-reminders/${entry.id}`, { method: 'DELETE' });
			reminderEntries = reminderEntries.filter(e => e !== entry);
			onrefreshindicators();
		} finally {
			entry.deleting = false;
		}
	}
</script>

{#if reminderSheet}
	<ManageSheetShell accent="var(--color-primary)" title={reminderSheet.supplementName} subtitle={t.supplement_reminders_title} onclose={() => reminderSheet = null}>
		{#snippet body()}
			{#if reminderLoading}
				<div class="flex justify-center py-6">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
				</div>
			{:else}
				{#if reminderEntries.length === 0}
					<p class="text-sm text-center py-4" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_empty}</p>
				{/if}

				<div class="manage-stack">
					{#each reminderEntries as entry}
						<div class="manage-reminder-card reminder-flat-card">
							<!-- Day chips -->
							<div class="reminder-days">
								<p class="manage-settings-label mb-1.5 px-0.5">{t.supplement_reminders_days_label}</p>
								<div class="manage-chip-grid">
									{#each DAY_ORDER as day, i}
										<button
											onclick={() => toggleDay(entry, day)}
											class="manage-chip active:opacity-70"
											data-selected={entry.days.includes(day)}
										>
											{DAY_LABELS[i]}
										</button>
									{/each}
								</div>
							</div>

							<!-- Time + actions -->
							<div class="single-time-reminder-row">
								<label class="reminder-time-cell">
									<span class="manage-settings-label">{t.supplement_reminders_time_label}</span>
									<span class="reminder-time-field">
										<input type="time" bind:value={entry.time} class="reminder-time-picker" />
										<span class="reminder-time-value">{entry.time}</span>
									</span>
								</label>
								<button
									onclick={() => deleteReminderEntry(entry)}
									disabled={entry.deleting}
									class="reminder-delete active:opacity-60 disabled:opacity-40"
									aria-label={t.supplement_reminders_delete}
								>
									{#if entry.deleting}
										<div class="h-4 w-4 animate-spin rounded-full border-2" style="border-color: var(--color-error); border-top-color: transparent"></div>
									{:else}
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
										</svg>
									{/if}
								</button>
								<button
									onclick={() => saveReminderEntry(entry)}
									disabled={entry.saving || entry.days.length === 0}
									class="reminder-save active:opacity-70 disabled:opacity-40"
								>
									{#if entry.saving}
										…
									{:else if entry.saved}
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										{t.supplement_reminders_save}
									{/if}
								</button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}
		{#snippet footer()}
				<button
					onclick={() => reminderSheet = null}
					class="manage-secondary active:opacity-70"
				>
					{t.close}
				</button>
				<button
					onclick={addReminderEntry}
					class="manage-primary gap-2 active:opacity-70"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					{t.supplement_reminders_add}
				</button>
		{/snippet}
	</ManageSheetShell>
{/if}
