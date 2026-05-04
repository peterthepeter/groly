<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import MeditationTimerSheet from './MeditationTimerSheet.svelte';
	import MeditationEditLogSheet from './MeditationEditLogSheet.svelte';
	import MeditationReminderSheet from './MeditationReminderSheet.svelte';
	import MeditationTrackerEditSheet from './MeditationTrackerEditSheet.svelte';

	let {
		logs,
		goalMinutes,
		onlogged,
		ondeleted
	}: {
		logs: { id: string; durationSeconds: number; loggedAt: number }[];
		goalMinutes: number;
		onlogged: () => void;
		ondeleted: (id: string) => void;
	} = $props();

	let expanded = $state(false);
	let editSheet = $state<{ id: string; durationSeconds: number; time: string } | null>(null);
	let timerOpen = $state(false);
	let timerDuration = $state(10);
	let reminderSheetOpen = $state(false);
	let trackerEditOpen = $state(false);
	let hasReminders = $state(false);
	let showCustomInput = $state(false);
	let customTime = $state('00:10');

	const totalSeconds = $derived(logs.reduce((sum, l) => sum + l.durationSeconds, 0));
	const totalMinutes = $derived(Math.floor(totalSeconds / 60));
	const goalSeconds = $derived(goalMinutes * 60);
	const progressPercent = $derived(Math.min(100, Math.round((totalSeconds / goalSeconds) * 100)));

	let animatedPercent = $state(0);
	let isMounted = $state(false);

	onMount(() => {
		requestAnimationFrame(() => requestAnimationFrame(() => {
			animatedPercent = progressPercent;
			isMounted = true;
		}));
	});

	$effect(() => {
		if (isMounted) animatedPercent = progressPercent;
	});

	const sortedLogs = $derived(logs.slice().sort((a, b) => a.loggedAt - b.loggedAt));
	const presets = [5, 10, 15, 20];

	$effect(() => {
		fetch('/api/meditation-reminders')
			.then(r => r.ok ? r.json() : null)
			.then(d => { if (d?.schedules?.length > 0) hasReminders = true; })
			.catch(() => {});
	});

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatDurationShort(s: number): string {
		const m = Math.floor(s / 60);
		const sec = s % 60;
		if (sec === 0) return `${m} min`;
		return `${m}:${String(sec).padStart(2, '0')} min`;
	}

	function toHHMM(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function openEdit(log: { id: string; durationSeconds: number; loggedAt: number }) {
		editSheet = { id: log.id, durationSeconds: log.durationSeconds, time: toHHMM(log.loggedAt) };
	}

	function startTimer(minutes: number) {
		timerDuration = minutes;
		timerOpen = true;
		showCustomInput = false;
		customTime = '00:10';
	}

	function submitCustom() {
		const [h, m] = customTime.split(':').map(Number);
		const totalMin = (h || 0) * 60 + (m || 0);
		if (totalMin <= 0) return;
		startTimer(totalMin);
	}

	function onTimerSaved() {
		onlogged();
	}
</script>

<div class="rounded-2xl px-4 py-3 flex flex-col" style="background-color: var(--color-surface-card)">

	<!-- Expanded log entries -->
	{#if expanded && sortedLogs.length > 0}
		<div class="mb-3 pb-3 border-b space-y-1.5" style="border-color: var(--color-outline-variant)">
			{#each sortedLogs as log (log.id)}
				<div class="flex items-center justify-between text-xs">
					<span style="color: var(--color-on-surface-variant)">
						<span style="color: #9F7AEA">{formatDurationShort(log.durationSeconds)}</span>
						{t.supplement_log_at} {formatTime(log.loggedAt)}
					</span>
					<div class="flex items-center gap-0.5 shrink-0">
						<button
							onclick={() => openEdit(log)}
							class="p-1 rounded active:opacity-50"
							aria-label="Bearbeiten"
							style="color: var(--color-on-surface-variant)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
							</svg>
						</button>
						<button
							onclick={() => ondeleted(log.id)}
							class="p-1 rounded active:opacity-50"
							aria-label={t.meditation_log_delete}
							style="color: var(--color-on-surface-variant)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
								<path d="M10 11v6"/><path d="M14 11v6"/>
								<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}

	<!-- Header row -->
	<div class="flex items-center gap-2">
		<button
			onclick={() => trackerEditOpen = true}
			class="font-semibold text-sm shrink-0 active:opacity-70"
			style="color: var(--color-on-surface)"
		>{t.meditation_title}</button>
		<div class="flex gap-1 flex-1 justify-end">
			{#each presets as min}
				<button
					onclick={() => startTimer(min)}
					class="px-2 py-0.5 rounded-xl text-xs font-semibold active:opacity-70 transition-opacity"
					style="background-color: var(--color-surface-container); color: #9F7AEA"
				>{min}m</button>
			{/each}
			<button
				onclick={() => { showCustomInput = !showCustomInput; customTime = '00:10'; }}
				class="px-2 py-0.5 rounded-xl text-xs font-semibold active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>{t.water_custom}</button>
		</div>
		{#if logs.length > 0}
			<button
				onclick={() => expanded = !expanded}
				class="shrink-0 w-7 h-7 flex items-center justify-center active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? t.meditation_collapse : t.meditation_expand}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
				     style="transition: transform 0.2s; transform: rotate({expanded ? '-90' : '0'}deg)">
					<polyline points="9 6 15 12 9 18"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Progress row -->
	<div class="mt-0.5">
		<div class="flex items-center gap-1.5 mb-1">
			<p class="text-xs" style="color: #9F7AEA">{totalMinutes} / {goalMinutes} min</p>
			{#if hasReminders}
				<button
					onclick={() => reminderSheetOpen = true}
					class="flex items-center justify-center active:opacity-60"
					aria-label="Erinnerungen"
					style="color: #9F7AEA"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					</svg>
				</button>
			{/if}
		</div>
		<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
			<div
				class="h-full rounded-full"
				style="width: {animatedPercent}%; background: linear-gradient(90deg, rgba(159,122,234,0.35), rgba(159,122,234,0.75)); transition: width {isMounted ? '0.3s ease' : '0.9s cubic-bezier(0.25,0.46,0.45,0.94)'}"
			></div>
		</div>
	</div>

	{#if showCustomInput}
		<div class="flex gap-2 mt-2 items-center">
			<input
				type="time"
				bind:value={customTime}
				class="flex-1 px-3 rounded-xl border-0 outline-none text-center"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 40px"
				onkeydown={(e) => { if (e.key === 'Enter') submitCustom(); }}
			/>
			<button
				onclick={submitCustom}
				class="h-10 px-4 rounded-xl text-sm font-semibold active:opacity-70 shrink-0"
				style="background: linear-gradient(135deg, #9F7AEA, #7C3AED); color: white"
			>{t.meditation_start}</button>
		</div>
	{/if}
</div>

<MeditationTimerSheet bind:open={timerOpen} durationMinutes={timerDuration} onsaved={onTimerSaved} />
<MeditationEditLogSheet bind:sheet={editSheet} onreload={onlogged} />
<MeditationReminderSheet bind:open={reminderSheetOpen} />
<MeditationTrackerEditSheet bind:open={trackerEditOpen} />
