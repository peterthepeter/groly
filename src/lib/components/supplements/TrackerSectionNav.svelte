<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { t, today_reminders_label } from '$lib/i18n.svelte';
	import { toLocalDateKey } from '$lib/dates';
	import { matchSupplementReminderLogs } from '$lib/supplementReminderMatching';

	type Section = 'today' | 'history' | 'nutrition';
	type ReminderEntry = { scheduleId: string; supplementId: string; name: string };
	type Reminder = { time: string; entries: ReminderEntry[]; names: string[] };
	type LogRef = { supplementId: string; loggedAt: number };

	let {
		activeSection,
		nutritionEnabled,
		todayLogs = null,
		historyControls = null
	}: {
		activeSection: Section;
		nutritionEnabled: boolean;
		todayLogs?: LogRef[] | null;
		historyControls?: Snippet | null;
	} = $props();

	let reminders = $state<Reminder[]>([]);
	let overrides = $state<Record<string, boolean>>({});
	let loadedLogs = $state<LogRef[]>([]);
	let remindersExpanded = $state(false);

	const effectiveLogs = $derived(todayLogs ?? loadedLogs);

	function todayAtTime(time: string): number {
		const [hours, minutes] = time.split(':').map(Number);
		const date = new Date();
		date.setHours(hours, minutes, 0, 0);
		return date.getTime();
	}

	const doneMap = $derived.by(() => {
		const map = new Map<string, boolean>();
		const matchedSchedules = matchSupplementReminderLogs(
			reminders.flatMap(reminder => reminder.entries.map(entry => ({
				id: entry.scheduleId,
				supplementId: entry.supplementId,
				scheduledAt: todayAtTime(reminder.time)
			}))),
			effectiveLogs,
			Date.now()
		);
		for (const reminder of reminders) {
			if (reminder.time in overrides) {
				map.set(reminder.time, overrides[reminder.time]);
				continue;
			}
			const done = reminder.entries.every(entry => matchedSchedules.has(entry.scheduleId));
			map.set(reminder.time, done);
		}
		return map;
	});

	const pendingCount = $derived(reminders.filter((reminder) => !doneMap.get(reminder.time)).length);

	async function loadReminderState() {
		try {
			const now = new Date();
			const from = new Date(now); from.setHours(0, 0, 0, 0);
			const to = new Date(now); to.setHours(23, 59, 59, 999);
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const requests: Promise<Response>[] = [fetch(`/api/supplement-reminders?today=1&timeZone=${encodeURIComponent(timeZone)}`)];
			if (todayLogs === null) requests.push(fetch(`/api/supplement-logs?from=${from.getTime()}&to=${to.getTime()}`));
			const responses = await Promise.all(requests);
			let index = 0;
			const reminderResponse = responses[index++];
			if (reminderResponse.ok) {
				const data = await reminderResponse.json();
				reminders = data.todayReminders ?? [];
				overrides = data.overrides ?? {};
			}
			if (todayLogs === null) {
				const response = responses[index];
				if (response.ok) loadedLogs = (await response.json()).logs ?? [];
			}
		} catch {
			// The navigation remains usable offline; reminder details stay hidden.
		}
	}

	async function toggleReminder(reminder: Reminder) {
		const previous = overrides;
		const done = !(doneMap.get(reminder.time) ?? false);
		overrides = { ...overrides, [reminder.time]: done };
		try {
			const response = await fetch('/api/supplement-reminder-overrides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date: toLocalDateKey(new Date()), reminderTime: reminder.time, done })
			});
			if (!response.ok) overrides = previous;
		} catch {
			overrides = previous;
		}
	}

	function navigate(section: Section) {
		if (section === 'today') void goto('/tracker', { noScroll: true, keepFocus: true });
		else if (section === 'history') void goto('/tracker?tab=history', { noScroll: true, keepFocus: true });
		else void goto('/tracker/nutrition');
	}

	function accent(section: Section): string {
		if (activeSection !== section) return 'var(--color-on-surface-variant)';
		return section === 'nutrition' ? '#FB923C' : 'var(--color-primary)';
	}

	onMount(loadReminderState);
</script>

<div class="tracker-section-nav">
	<nav class:two-tabs={!nutritionEnabled} class="tracker-section-tabs" aria-label={t.supplement_title}>
		<button type="button" onclick={() => navigate('today')} aria-current={activeSection === 'today' ? 'page' : undefined}
			style="background-color: {activeSection === 'today' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {accent('today')}">
			{t.supplement_tab_today}
		</button>
		<button type="button" onclick={() => navigate('history')} aria-current={activeSection === 'history' ? 'page' : undefined}
			style="background-color: {activeSection === 'history' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {accent('history')}">
			{t.supplement_tab_history}
		</button>
		{#if nutritionEnabled}
			<button type="button" onclick={() => navigate('nutrition')} aria-current={activeSection === 'nutrition' ? 'page' : undefined}
				style="background-color: {activeSection === 'nutrition' ? 'color-mix(in srgb, #FB923C 9%, transparent)' : 'transparent'}; color: {accent('nutrition')}">
				{t.nutrition_label}
			</button>
		{/if}
	</nav>

	{#if activeSection === 'history' && historyControls}
		<div class="tracker-section-history">{@render historyControls()}</div>
	{:else}
		<div class="tracker-section-actions">
			<button type="button" onclick={() => goto('/tracker/verwalten')}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				{t.supplement_manage}
			</button>
			{#if reminders.length > 0}
				<button type="button" onclick={() => (remindersExpanded = !remindersExpanded)} class="reminder-action"
					aria-expanded={remindersExpanded}>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					</svg>
					<span>{today_reminders_label(pendingCount)}</span>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"
						style="transform: rotate({remindersExpanded ? 90 : 0}deg)"><polyline points="9 18 15 12 9 6"/></svg>
				</button>
			{/if}
		</div>

		{#if remindersExpanded && reminders.length > 0}
			<div class="tracker-reminder-list">
				{#each reminders as reminder (reminder.time)}
					{@const done = doneMap.get(reminder.time) ?? false}
					<button type="button" onclick={() => toggleReminder(reminder)} class:done>
						<span class="tracker-reminder-check">
							{#if done}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-surface-low)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>{/if}
						</span>
						<strong>{reminder.time}</strong>
						<span>{reminder.names.join(' · ')}</span>
					</button>
				{/each}
			</div>
		{/if}
	{/if}
</div>

<style>
	.tracker-section-nav { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.tracker-section-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 4px; padding: 4px; }
	.tracker-section-tabs.two-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.tracker-section-tabs button { min-width: 0; min-height: 36px; padding: 6px 4px; border-radius: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 13px; font-weight: 650; transition: background-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1), color 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
	.tracker-section-tabs button:active { opacity: .7; }
	.tracker-section-actions { display: flex; min-height: 40px; align-items: stretch; border-top: 1px solid var(--bubble-container-border); }
	.tracker-section-actions > button { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 7px; padding: 6px 10px; color: var(--color-primary); font-size: 13px; font-weight: 650; }
	.tracker-section-actions > button:active { opacity: .7; }
	.tracker-section-actions .reminder-action { color: var(--color-on-surface); font-weight: 550; }
	.reminder-action span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.reminder-action svg:last-child { flex: none; color: var(--color-on-surface-variant); transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
	.tracker-section-history { border-top: 1px solid var(--bubble-container-border); }
	.tracker-reminder-list { display: flex; flex-direction: column; gap: 2px; padding: 8px 16px 10px; border-top: 1px solid var(--bubble-container-border); }
	.tracker-reminder-list button { display: grid; grid-template-columns: 16px auto minmax(0, 1fr); align-items: center; gap: 10px; min-height: 30px; text-align: left; }
	.tracker-reminder-list button.done { opacity: .5; }
	.tracker-reminder-check { display: flex; width: 16px; height: 16px; align-items: center; justify-content: center; border: 1.5px solid var(--color-primary); border-radius: 999px; }
	.done .tracker-reminder-check { border-color: var(--color-on-surface-variant); background: var(--color-on-surface-variant); }
	.tracker-reminder-list strong { color: var(--color-primary); font-size: 14px; font-variant-numeric: tabular-nums; }
	.tracker-reminder-list button.done strong, .tracker-reminder-list button.done > span:last-child { color: var(--color-on-surface-variant); text-decoration: line-through; }
	.tracker-reminder-list button > span:last-child { overflow: hidden; color: var(--color-on-surface); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
</style>
