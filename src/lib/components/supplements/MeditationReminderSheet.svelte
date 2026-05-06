<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	type ReminderEntry = {
		id: string | null;
		time: string;
		onlyIfNotMeditated: boolean;
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

	$effect(() => {
		if (open) loadEntries();
	});

	async function loadEntries() {
		loading = true;
		entries = [];
		try {
			const res = await fetch('/api/meditation-reminders');
			if (res.ok) {
				const d = await res.json();
				entries = d.schedules.map((sc: { id: string; time: string; onlyIfNotMeditated: boolean }) => ({
					id: sc.id,
					time: sc.time,
					onlyIfNotMeditated: sc.onlyIfNotMeditated,
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
			time: '07:00',
			onlyIfNotMeditated: true,
			saving: false,
			saved: false,
			deleting: false
		}];
	}

	async function saveEntry(entry: ReminderEntry) {
		entry.saving = true;
		try {
			const payload = { time: entry.time, onlyIfNotMeditated: entry.onlyIfNotMeditated };
			if (entry.id) {
				await fetch(`/api/meditation-reminders/${entry.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload)
				});
			} else {
				const res = await fetch('/api/meditation-reminders', {
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
			await fetch(`/api/meditation-reminders/${entry.id}`, { method: 'DELETE' });
			entries = entries.filter(e => e !== entry);
		} finally {
			entry.deleting = false;
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => open = false}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl overflow-y-auto"
	     style="background-color: var(--color-surface-low); max-height: 90vh">
		<div class="p-6 space-y-4">
			<div class="flex justify-center mb-1">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<div class="flex items-center gap-2">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9F7AEA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
				<p class="font-semibold text-base" style="color: var(--color-on-surface)">
					{t.supplement_reminders_title} · {t.meditation_title}
				</p>
			</div>

			{#if loading}
				<div class="flex justify-center py-6">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: #9F7AEA; border-top-color: transparent"></div>
				</div>
			{:else}
				{#if entries.length === 0}
					<p class="text-sm text-center py-4" style="color: var(--color-on-surface-variant)">{t.supplement_reminders_empty}</p>
				{/if}

				<div class="space-y-3">
					{#each entries as entry}
						<div class="rounded-2xl p-4 space-y-3" style="background-color: var(--color-surface-card)">

							<div>
								<p class="text-xs font-medium mb-1.5" style="color: var(--color-on-surface-variant)">{t.meditation_reminder_time}</p>
								<input
									type="time"
									bind:value={entry.time}
									class="w-full px-3 rounded-xl border-0 outline-none"
									style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 42px"
								/>
							</div>

							<div class="flex items-center justify-between gap-3">
								<span class="text-sm" style="color: var(--color-on-surface)">{t.meditation_reminder_only_if_not_meditated}</span>
								<button
									type="button"
									onclick={() => entry.onlyIfNotMeditated = !entry.onlyIfNotMeditated}
									class="shrink-0 w-10 h-5 rounded-full relative overflow-hidden transition-colors"
									style="background-color: {entry.onlyIfNotMeditated ? '#9F7AEA' : 'var(--color-surface-container)'}"
									aria-label={t.meditation_reminder_only_if_not_meditated}
								>
									{#if entry.onlyIfNotMeditated}
										<span class="absolute top-0.5 h-4 w-4 rounded-full" style="background-color: white; transform: translateX(1.25rem)"></span>
									{/if}
								</button>
							</div>

							<div class="flex gap-2 pt-1">
								<button
									onclick={() => saveEntry(entry)}
									disabled={entry.saving}
									class="flex-1 rounded-xl text-sm font-semibold active:opacity-70 disabled:opacity-40 transition-all flex items-center justify-center"
									style="background: {entry.saved ? '#9F7AEA' : 'linear-gradient(135deg, #9F7AEA, #7C3AED)'}; color: white; height: 42px"
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
					{/each}
				</div>
			{/if}

			<div class="flex gap-2">
				<button
					onclick={() => open = false}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.close}</button>
				<button
					onclick={addEntry}
					class="flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: rgba(159,122,234,0.15); color: #9F7AEA"
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
