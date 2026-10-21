<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import { goto } from '$app/navigation';
	import { t, today_reminders_label } from '#lib/i18n.svelte';
	import { toLocalDateKey, tsToDateKey } from '#lib/dates';
	import type { WeekOverride } from '#lib/supplementWeekPlan';
	import { matchSupplementReminderLogs } from '#lib/supplementReminderMatching';
	import SupplementWeekPlan, { type WeekSchedule } from './SupplementWeekPlan.svelte';

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
	let weekLogs = $state<LogRef[]>([]);
	let weekOverrides = $state<WeekOverride[]>([]);
	let scrollTail = $state(0);
	let weekSchedules = $state<WeekSchedule[] | null>(null);
	let weekLoading = $state(false);
	let weekError = $state(false);
	let reminderBody = $state<HTMLDivElement | null>(null);
	const hasReminderPlan = $derived(reminders.length > 0 || (weekSchedules?.length ?? 0) > 0 || weekError);

	function toggleReminders() {
		if (!remindersExpanded) void loadWeekPlan();
		remindersExpanded = !remindersExpanded;
	}

	async function loadWeekPlan() {
		if (weekLoading) return;
		weekLoading = true;
		weekError = false;
		try {
			const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
			const response = await fetch(`/api/supplement-reminders?week=1&timeZone=${encodeURIComponent(timeZone)}`);
			if (!response.ok) throw new Error('Week plan unavailable');
			const data = await response.json();
			weekSchedules = data.schedules ?? [];
			weekLogs = data.logs ?? [];
			weekOverrides = data.overrides ?? [];
			const today = toLocalDateKey(new Date());
			overrides = Object.fromEntries(weekOverrides.filter(override => override.date === today).map(override => [override.reminderTime, override.done]));
			if (todayLogs === null) loadedLogs = weekLogs.filter(log => tsToDateKey(log.loggedAt) === today);
		} catch {
			weekError = true;
		} finally {
			weekLoading = false;
		}
	}

	// Anchor once on opening, then release immediately when the user scrolls or interacts.
	$effect(() => {
		if (!remindersExpanded || weekLoading || weekError || !weekSchedules?.length || !reminderBody) return;
		const body = reminderBody;
		let stopped = false;
		let frame = 0;
		function anchorToday() {
			if (stopped) return;
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => {
				if (stopped) return;
				const days = body.querySelectorAll<HTMLElement>('.week-day');
				const today = body.querySelector<HTMLElement>('.week-day.today');
				const last = days[days.length - 1];
				if (!today || !last) return;
				// Leave enough scroll space to place even Sunday at the top.
				scrollTail = Math.max(0, body.clientHeight - last.offsetHeight);
				frame = requestAnimationFrame(() => {
					if (!stopped) body.scrollTop += today.getBoundingClientRect().top - body.getBoundingClientRect().top;
				});
			});
		}
		function stopAnchoring() { stopped = true; cancelAnimationFrame(frame); }
		const observer = new ResizeObserver(anchorToday);
		observer.observe(body);
		const plan = body.querySelector('.supplement-week-plan');
		if (plan) observer.observe(plan);
		for (const type of ['pointerdown', 'wheel', 'keydown']) body.addEventListener(type, stopAnchoring, { passive: true });
		anchorToday();
		void document.fonts?.ready.then(anchorToday);
		return () => {
			stopAnchoring(); observer.disconnect();
			for (const type of ['pointerdown', 'wheel', 'keydown']) body.removeEventListener(type, stopAnchoring);
		};
	});

	const effectiveLogs = $derived(todayLogs ?? loadedLogs);
	const weekCompletion = $derived({
		logs: [...weekLogs.filter(log => tsToDateKey(log.loggedAt) !== toLocalDateKey(new Date())), ...effectiveLogs],
		overrides: [...weekOverrides.filter(override => override.date !== toLocalDateKey(new Date())),
			...Object.entries(overrides).map(([reminderTime, done]) => ({ date: toLocalDateKey(new Date()), reminderTime, done }))]
	});

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
				// Keep the weekly plan accessible on days with no scheduled intake.
				if (reminders.length === 0) void loadWeekPlan();
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
		if (section === 'today') void goto('/tracker', { reset: false });
		else if (section === 'history') void goto('/tracker?tab=history', { reset: false });
		else void goto('/tracker/nutrition');
	}

	function accent(section: Section): string {
		if (activeSection !== section) return 'var(--color-on-surface-variant)';
		return section === 'nutrition' ? 'var(--color-tracker-nutrition)' : 'var(--color-primary)';
	}

	onMount(loadReminderState);
</script>

<div class="tracker-section-nav">
	<nav class:two-tabs={!nutritionEnabled} class="tracker-section-tabs inset-row-divider" aria-label={t.supplement_title}>
		<button type="button" onclick={() => navigate('today')} aria-current={activeSection === 'today' ? 'page' : undefined}
			style="color: {accent('today')}">
			{t.supplement_tab_today}
		</button>
		<button type="button" onclick={() => navigate('history')} aria-current={activeSection === 'history' ? 'page' : undefined}
			style="color: {accent('history')}">
			{t.supplement_tab_history}
		</button>
		{#if nutritionEnabled}
			<button type="button" onclick={() => navigate('nutrition')} aria-current={activeSection === 'nutrition' ? 'page' : undefined}
				style="color: {accent('nutrition')}">
				{t.nutrition_label}
			</button>
		{/if}
	</nav>

	{#if activeSection === 'history' && historyControls}
		<div class="tracker-section-history">{@render historyControls()}</div>
	{:else}
		<div class="tracker-section-actions" class:inset-row-divider={remindersExpanded && hasReminderPlan}>
			<button type="button" onclick={() => goto('/tracker/verwalten')}>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
				{t.supplement_manage}
			</button>
			{#if hasReminderPlan}
				<button type="button" onclick={toggleReminders} class="reminder-action"
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

		{#if remindersExpanded && hasReminderPlan}
			<div bind:this={reminderBody} class="tracker-reminder-body" aria-label={t.supplement_view_weekplan}>
				{#if weekLoading}
					<p class="tracker-reminder-message" role="status">{t.admin_loading}</p>
				{:else if weekError}
					<div class="tracker-reminder-message" role="alert">
						<p>{t.supplement_weekplan_load_error}</p>
						<button type="button" class="tracker-reminder-retry" onclick={loadWeekPlan}>{t.offline_retry}</button>
					</div>
				{:else if weekSchedules !== null}
					<SupplementWeekPlan schedules={weekSchedules} compact completion={weekCompletion}
						onToggleTime={(time) => { const reminder = reminders.find(reminder => reminder.time === time); if (reminder) void toggleReminder(reminder); }} />
					<div style:height={`${scrollTail}px`} aria-hidden="true"></div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<style>
	.tracker-section-nav { min-width: 0; }
	.tracker-section-tabs { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); padding: 0 8px; }
	.tracker-section-tabs.two-tabs { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	.tracker-section-tabs button { min-width: 0; min-height: 44px; padding: 8px 4px; background: transparent; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 600; transition: color 160ms cubic-bezier(0.2, 0.8, 0.2, 1); }
	.tracker-section-tabs button:active { opacity: .7; }
	.tracker-section-actions { display: flex; min-height: 40px; align-items: stretch; }
	.tracker-section-actions > button { display: flex; min-width: 0; flex: 1; align-items: center; justify-content: center; gap: 7px; padding: 6px 10px; color: var(--color-on-surface-variant); font-size: 13px; font-weight: 550; }
	.tracker-section-actions > button:active { opacity: .7; }
	.tracker-section-actions .reminder-action { color: var(--color-on-surface); font-weight: 550; }
	.reminder-action span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.reminder-action svg:last-child { flex: none; color: var(--color-on-surface-variant); transition: transform 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }
	.tracker-section-history { min-height: 40px; }
	.tracker-reminder-body { position: relative; height: min(40dvh, 18rem); overflow-y: auto; overscroll-behavior: contain; }
	.tracker-reminder-message { padding: 12px 16px 18px; font-size: 13px; text-align: center; color: var(--color-on-surface-variant); }
	.tracker-reminder-retry { min-height: 36px; padding: 6px 8px; color: var(--color-primary); }
	.tracker-section-nav button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
	@media (prefers-reduced-motion: reduce) {
		.tracker-section-tabs button, .reminder-action svg:last-child { transition: none; }
	}
</style>
