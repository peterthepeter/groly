<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';

	const MOOD_COLOR = '#F472B6';

	type ReminderEntry = {
		id: string | null;
		days: number[];
		time: string;
		onlyIfNotRated: boolean;
		saving: boolean;
		saved: boolean;
		deleting: boolean;
	};

	let {
		open = $bindable<boolean>(false)
	}: {
		open: boolean;
	} = $props();

	let entries = $state<ReminderEntry[]>([]);
	let loading = $state(false);

	// Mo Di Mi Do Fr Sa So
	const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
	const DAY_LABELS = $derived([
		t.supplement_day_mo, t.supplement_day_di, t.supplement_day_mi,
		t.supplement_day_do, t.supplement_day_fr, t.supplement_day_sa, t.supplement_day_so
	]);

	$effect(() => {
		if (open) loadEntries();
	});

	async function loadEntries() {
		loading = true;
		entries = [];
		try {
			const res = await fetch('/api/mood-reminders');
			if (res.ok) {
				const d = await res.json();
				entries = d.schedules.map((sc: { id: string; days: string; time: string; onlyIfNotRated: boolean }) => ({
					id: sc.id,
					days: JSON.parse(sc.days),
					time: sc.time,
					onlyIfNotRated: sc.onlyIfNotRated,
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
			time: '20:00',
			onlyIfNotRated: true,
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
			const payload = { days: entry.days, time: entry.time, onlyIfNotRated: entry.onlyIfNotRated };
			if (entry.id) {
				await fetch(`/api/mood-reminders/${entry.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				const res = await fetch('/api/mood-reminders', {
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
			await fetch(`/api/mood-reminders/${entry.id}`, { method: 'DELETE' });
			entries = entries.filter(e => e !== entry);
		} finally {
			entry.deleting = false;
		}
	}
</script>

{#if open}
	<ManageSheetShell accent={MOOD_COLOR} title={t.mood_tracker_label} subtitle={t.supplement_reminders_title} onclose={() => open = false}>
		{#snippet body()}
			{#if loading}
				<div class="flex justify-center py-6">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: {MOOD_COLOR}; border-top-color: transparent"></div>
				</div>
			{:else}
				{#if entries.length === 0}
					<p class="text-sm text-center py-4" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_empty}</p>
				{/if}

				<div class="manage-stack">
					{#each entries as entry}
						<div class="manage-reminder-card">

							<div>
								<p class="manage-label">{t.supplement_reminders_days_label}</p>
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

							<div>
								<p class="manage-label">{t.supplement_reminders_time_label}</p>
								<input
									type="time"
									bind:value={entry.time}
									class="manage-input"
								/>
							</div>

							<div class="manage-row justify-between">
								<span class="text-sm" style="color: var(--color-on-surface)">{t.mood_reminder_only_if_not_rated}</span>
								<button
									type="button"
									onclick={() => entry.onlyIfNotRated = !entry.onlyIfNotRated}
									class="manage-toggle"
									data-active={entry.onlyIfNotRated}
									aria-label={t.mood_reminder_only_if_not_rated}
								>
									<span></span>
								</button>
							</div>

							<div class="manage-reminder-actions">
								<button
									onclick={() => saveEntry(entry)}
									disabled={entry.saving || entry.days.length === 0}
									class="manage-primary active:opacity-70 disabled:opacity-40"
								>
									{#if entry.saving}
										…
									{:else if entry.saved}
										<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									{:else}
										{t.supplement_reminders_save}
									{/if}
								</button>
								<button
									onclick={() => deleteEntry(entry)}
									disabled={entry.deleting}
									class="manage-icon-button active:opacity-60 disabled:opacity-40"
									aria-label={t.supplement_reminders_delete}
								>
									{#if entry.deleting}
										<div class="w-5 h-5 rounded-full border-2 animate-spin" style="border-color: var(--color-error); border-top-color: transparent"></div>
									{:else}
										<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
										</svg>
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
