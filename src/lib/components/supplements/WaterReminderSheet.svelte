<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';

	type ReminderEntry = {
		id: string | null;
		days: number[];
		startTime: string;
		endTime: string;
		intervalMinutes: number;
		saving: boolean;
		saved: boolean;
		deleting: boolean;
	};

	let {
		open = $bindable<boolean>(false)
	}: {
		open: boolean;
	} = $props();

	const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const DAY_LABELS = $derived([
		t.supplement_day_mo, t.supplement_day_di, t.supplement_day_mi,
		t.supplement_day_do, t.supplement_day_fr, t.supplement_day_sa, t.supplement_day_so
	]);

	const INTERVALS: { value: number; label: string }[] = [
		{ value: 10,  label: '10 min' },
		{ value: 15,  label: '15 min' },
		{ value: 20,  label: '20 min' },
		{ value: 30,  label: '30 min' },
		{ value: 45,  label: '45 min' },
		{ value: 60,  label: '1 h'    },
		{ value: 90,  label: '90 min' },
		{ value: 120, label: '2 h'    },
	];

	let entries = $state<ReminderEntry[]>([]);
	let loading = $state(false);

	$effect(() => {
		if (open) loadEntries();
	});

	async function loadEntries() {
		loading = true;
		entries = [];
		try {
			const res = await fetch('/api/water-reminders');
			if (res.ok) {
				const d = await res.json();
				entries = d.schedules.map((sc: { id: string; days: string; startTime: string; endTime: string; intervalMinutes: number }) => ({
					id: sc.id,
					days: JSON.parse(sc.days) as number[],
					startTime: sc.startTime,
					endTime: sc.endTime,
					intervalMinutes: sc.intervalMinutes,
					saving: false,
					saved: false,
					deleting: false
				}));
			}
		} finally {
			loading = false;
		}
	}

	function addEntry() {
		entries = [...entries, {
			id: null,
			days: [1, 2, 3, 4, 5],
			startTime: '08:00',
			endTime: '20:00',
			intervalMinutes: 90,
			saving: false,
			saved: false,
			deleting: false
		}];
	}

	function toggleDay(entry: ReminderEntry, day: number) {
		if (entry.days.includes(day)) {
			entry.days = entry.days.filter(d => d !== day);
		} else {
			entry.days = [...entry.days, day];
		}
	}

	async function saveEntry(entry: ReminderEntry) {
		if (entry.days.length === 0) return;
		entry.saving = true;
		try {
			const payload = {
				days: entry.days,
				startTime: entry.startTime,
				endTime: entry.endTime,
				intervalMinutes: entry.intervalMinutes
			};
			if (entry.id) {
				await fetch(`/api/water-reminders/${entry.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				const res = await fetch('/api/water-reminders', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
				if (res.ok) {
					const d = await res.json();
					entry.id = d.id;
				}
			}
			entry.saved = true;
			setTimeout(() => { entry.saved = false; }, 1500);
		} finally {
			entry.saving = false;
		}
	}

	async function deleteEntry(entry: ReminderEntry) {
		if (entry.id === null) {
			entries = entries.filter(e => e !== entry);
			return;
		}
		entry.deleting = true;
		try {
			await fetch(`/api/water-reminders/${entry.id}`, { method: 'DELETE' });
			entries = entries.filter(e => e !== entry);
		} finally {
			entry.deleting = false;
		}
	}
</script>

{#if open}
	<ManageSheetShell accent="#60A5FA" title={t.water_title} subtitle={t.supplement_reminders_title} onclose={() => open = false}>
		{#snippet body()}
			{#if loading}
				<div class="flex justify-center py-6">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: #60A5FA; border-top-color: transparent"></div>
				</div>
			{:else}
				{#if entries.length === 0}
					<p class="text-sm text-center py-4" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_empty}</p>
				{/if}

				<div class="manage-stack">
					{#each entries as entry}
						<div class="manage-reminder-card reminder-flat-card">

							<!-- Weekdays -->
							<div class="reminder-days">
								<p class="manage-settings-label mb-1.5 px-0.5">{t.supplement_reminders_days_label}</p>
								<div class="manage-chip-grid">
									{#each DAY_ORDER as day, i}
										<button
											onclick={() => toggleDay(entry, day)}
										class="manage-chip active:opacity-70"
										data-selected={entry.days.includes(day)}
										>{DAY_LABELS[i]}</button>
									{/each}
								</div>
							</div>

							<!-- Schedule -->
							<div class="reminder-schedule-row">
								<label class="reminder-time-cell">
									<span class="manage-settings-label">{t.water_reminder_from}</span>
									<span class="reminder-time-field">
										<input type="time" bind:value={entry.startTime} class="reminder-time-picker" />
										<span class="reminder-time-value">{entry.startTime}</span>
									</span>
								</label>
								<label class="reminder-time-cell">
									<span class="manage-settings-label">{t.water_reminder_until}</span>
									<span class="reminder-time-field">
										<input type="time" bind:value={entry.endTime} class="reminder-time-picker" />
										<span class="reminder-time-value">{entry.endTime}</span>
									</span>
								</label>
								<label class="reminder-interval-cell">
									<span class="manage-settings-label">{t.water_reminder_interval}</span>
									<select bind:value={entry.intervalMinutes} class="reminder-interval-select">
										{#each INTERVALS as opt}
											<option value={opt.value}>{opt.label}</option>
										{/each}
									</select>
								</label>
							</div>

							<!-- Save + Delete -->
							<div class="reminder-entry-actions">
								<button
									onclick={() => deleteEntry(entry)}
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
									onclick={() => saveEntry(entry)}
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
					onclick={() => open = false}
					class="manage-secondary active:opacity-70"
				>{t.close}</button>
				<button
					onclick={addEntry}
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
