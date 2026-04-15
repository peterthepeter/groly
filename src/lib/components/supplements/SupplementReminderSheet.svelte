<script lang="ts">
	import { t } from '$lib/i18n.svelte';

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
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => reminderSheet = null}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl overflow-y-auto"
	     style="background-color: var(--color-surface-low); max-height: 90vh">
		<div class="p-6 space-y-4">
			<div class="flex justify-center mb-1">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<div class="flex items-center gap-2">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
				<p class="font-semibold text-base" style="color: var(--color-on-surface)">
					{t.supplement_reminders_title} · {reminderSheet.supplementName}
				</p>
			</div>

			{#if reminderLoading}
				<div class="flex justify-center py-6">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
				</div>
			{:else}
				{#if reminderEntries.length === 0}
					<p class="text-sm text-center py-4" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_empty}</p>
				{/if}

				<div class="space-y-3">
					{#each reminderEntries as entry}
						<div class="rounded-2xl p-4 space-y-3" style="background-color: var(--color-surface-card)">
							<!-- Day chips -->
							<div>
								<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_days_label}</p>
								<div class="flex gap-1.5 flex-wrap">
									{#each DAY_ORDER as day, i}
										<button
											onclick={() => toggleDay(entry, day)}
											class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors active:opacity-70"
											style="background-color: {entry.days.includes(day) ? 'var(--color-primary)' : 'var(--color-surface-container)'}; color: {entry.days.includes(day) ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
										>
											{DAY_LABELS[i]}
										</button>
									{/each}
								</div>
							</div>

							<!-- Time + actions -->
							<div>
								<p class="text-xs font-medium mb-1.5" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_time_label}</p>
								<div class="flex items-center gap-2">
									<input
										type="time"
										bind:value={entry.time}
										class="w-32 px-3 rounded-xl border-0 outline-none"
										style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 42px"
									/>
									<button
										onclick={() => saveReminderEntry(entry)}
										disabled={entry.saving || entry.days.length === 0}
										class="flex-1 rounded-xl text-sm font-semibold active:opacity-70 disabled:opacity-40 transition-all"
										style="background: {entry.saved ? 'var(--color-primary)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))'}; color: var(--color-on-primary); height: 42px"
									>
										{#if entry.saving}
											…
										{:else if entry.saved}
											<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline">
												<polyline points="20 6 9 17 4 12"/>
											</svg>
										{:else}
											{t.supplement_reminders_save}
										{/if}
									</button>
									<button
										onclick={() => deleteReminderEntry(entry)}
										disabled={entry.deleting}
										class="rounded-xl active:opacity-60 disabled:opacity-40 flex items-center justify-center"
										style="color: var(--color-error); width: 42px; height: 42px; background-color: var(--color-surface-container)"
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
						</div>
					{/each}
				</div>

			{/if}

			<!-- Close + Add Reminder row -->
			<div class="flex gap-2">
				<button
					onclick={() => reminderSheet = null}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>
					{t.close}
				</button>
				<button
					onclick={addReminderEntry}
					class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-primary-container); color: var(--color-primary)"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					{t.supplement_reminders_add}
				</button>
			</div>
		</div>
	</div>
{/if}
