<script lang="ts">
	import { t, currentLang, nutrients_show_more } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import { userSettings } from '$lib/userSettings.svelte';
	import { onMount, onDestroy } from 'svelte';
	import MoodHistoryView from './MoodHistoryView.svelte';
	import type { CaffeineLog, MeditationLog } from '$lib/db/schema';
	import { computeAdherence, computeTrackerStats, eachDayInRange, parseDaysMask, type ScheduleLite, type SupplementMeta } from '$lib/trackerStats';
	import { tsToDateKey, todayKey } from '$lib/dates';

	type Log = { id: string; supplementId: string; amount: number; loggedAt: number; note?: string | null };
	type NutrientStat = { total: number; unit: string; name: string };
	type SupplementStat = { name: string; unit: string; total: number };
	type SuppEntry = { id: string; name: string; unit: string; total: number };

	let {
		loading,
		period,
		date,
		rangeFrom = 0,
		rangeTo = 0,
		nutrients,
		supplementStats,
		logs,
		schedules = [],
		allSupplements = [],
		waterLogs,
		caffeineLogs,
		meditationLogs,
		onMoodReload,
		onEditLog,
		onEditCaffeineLog,
		onEditWaterLog
	}: {
		loading: boolean;
		period: 'day' | 'week' | 'month';
		date: string;
		rangeFrom?: number;
		rangeTo?: number;
		nutrients: Record<string, NutrientStat>;
		supplementStats: Record<string, SupplementStat>;
		logs: Log[];
		schedules?: ScheduleLite[];
		allSupplements?: SupplementMeta[];
		waterLogs: { id: string; amountMl: number; loggedAt: number }[];
		caffeineLogs: CaffeineLog[];
		meditationLogs: MeditationLog[];
		onMoodReload: () => void;
		onEditLog: (log: Log, sup: SuppEntry) => void;
		onEditCaffeineLog?: (log: CaffeineLog) => void;
		onEditWaterLog?: (log: { id: string; amountMl: number; loggedAt: number }) => void;
	} = $props();

	const NUTRIENTS_VISIBLE = 10;

	let moodHasDayEntry = $state(false);
	let supplementsCardExpanded = $state(true);
	let trackerCardExpanded = $state(true);
	let nutrientsCardExpanded = $state(true);
	let nutrientsExpanded = $state(false);
	let waterHistoryCardExpanded = $state(false);
	let caffeineHistoryCardExpanded = $state(false);
	let meditationHistoryCardExpanded = $state(false);
	let expandedSuppIds = $state(new Set<string>());
	let caffeineSelectedIdx = $state<number | null>(null);
	let meditationSelectedIdx = $state<number | null>(null);
	let waterSelectedIdx = $state<number | null>(null);
	let supplementSelectedIdx = $state<number | null>(null);
	let focusedLogId = $state<string | null>(null);

	// Now-marker (updates every minute) for the 24h timelines
	let nowTs = $state(Date.now());
	let nowTimer: ReturnType<typeof setInterval> | null = null;
	onMount(() => { nowTimer = setInterval(() => { nowTs = Date.now(); }, 60_000); });
	onDestroy(() => { if (nowTimer) clearInterval(nowTimer); });
	const isToday = $derived(date === todayKey());
	const nowPercent = $derived.by(() => {
		const d = new Date(nowTs);
		return ((d.getHours() + d.getMinutes() / 60) / 24) * 100;
	});

	function focusLog(id: string, isExpanded: boolean, expandSetter: (v: boolean) => void) {
		if (focusedLogId === id && isExpanded) {
			focusedLogId = null;
			expandSetter(false);
		} else {
			focusedLogId = id;
			expandSetter(true);
		}
	}

	// Reset per-supplement expand state + tracker selection when period/date changes
	$effect(() => {
		void period;
		void date;
		expandedSuppIds = new Set();
		caffeineSelectedIdx = null;
		meditationSelectedIdx = null;
		waterSelectedIdx = null;
		supplementSelectedIdx = null;
	});

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatNutrientValue(val: number, unit: string): string {
		// Auto-promote mg → g when ≥ 1000 mg (and μg → mg when ≥ 1000 μg)
		const u = unit.toLowerCase();
		if (u === 'mg' && val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + ' g';
		if ((u === 'µg' || u === 'mcg' || u === 'ug') && val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + ' mg';
		const v = val % 1 === 0 ? val.toString() : val.toFixed(1);
		return `${v} ${unit}`;
	}

	function toMcg(total: number, unit: string): number {
		const u = unit.toLowerCase();
		if (u === 'g') return total * 1_000_000;
		if (u === 'mg') return total * 1_000;
		return total;
	}

	function toggleSupp(id: string) {
		const next = new Set(expandedSuppIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedSuppIds = next;
	}

	function focusSupplementLog(log: Log) {
		const isExpanded = expandedSuppIds.has(log.supplementId);
		if (focusedLogId === log.id && isExpanded) {
			focusedLogId = null;
			const next = new Set(expandedSuppIds);
			next.delete(log.supplementId);
			expandedSuppIds = next;
		} else {
			focusedLogId = log.id;
			const next = new Set(expandedSuppIds);
			next.add(log.supplementId);
			expandedSuppIds = next;
		}
	}

	const logsBySuppId = $derived.by(() => {
		const map = new Map<string, Log[]>();
		for (const log of logs) {
			if (!map.has(log.supplementId)) map.set(log.supplementId, []);
			map.get(log.supplementId)!.push(log);
		}
		return map;
	});

	const nutrientEntries = $derived(
		Object.entries(nutrients).map(([, val]) => ({
			name: val.name,
			unit: val.unit,
			total: val.total
		})).sort((a, b) => toMcg(b.total, b.unit) - toMcg(a.total, a.unit))
	);
	const nutrientEntriesVisible = $derived(nutrientEntries.slice(0, NUTRIENTS_VISIBLE));
	const nutrientEntriesHidden = $derived(nutrientEntries.slice(NUTRIENTS_VISIBLE));
	const maxNutrientMcg = $derived(nutrientEntries.length > 0 ? toMcg(nutrientEntries[0].total, nutrientEntries[0].unit) : 1);
	function nutrientPct(total: number, unit: string): number {
		if (maxNutrientMcg === 0) return 0;
		return Math.max(2, Math.min(100, (toMcg(total, unit) / maxNutrientMcg) * 100));
	}

	const supplementStatEntries = $derived(
		Object.entries(supplementStats)
			.map(([id, val]) => ({ id, ...val }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	// Day-view: merged list — supplements taken today AND supplements with a schedule for today (even if not taken yet)
	const dayCombinedSupplements = $derived.by(() => {
		if (period !== 'day') return supplementStatEntries;
		const byId = new Map(supplementStatEntries.map(s => [s.id, { ...s }]));
		const allById = new Map(allSupplements.map(s => [s.id, s]));
		for (const [suppId] of supplementSchedulesForDay) {
			if (byId.has(suppId)) continue;
			const meta = allById.get(suppId);
			if (!meta) continue;
			byId.set(suppId, { id: suppId, name: meta.name, unit: meta.unit, total: 0 });
		}
		return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
	});

	const waterTotal = $derived(waterLogs.reduce((s, l) => s + l.amountMl, 0));
	const caffeineTotalMg = $derived(caffeineLogs.reduce((s, l) => s + l.caffeineMg, 0));
	const caffeineTotalMl = $derived(caffeineLogs.reduce((s, l) => s + l.amountMl, 0));
	const meditationTotalSeconds = $derived(meditationLogs.reduce((s, l) => s + l.durationSeconds, 0));

	const meditationByDay = $derived.by(() => {
		if (!meditationHistoryCardExpanded || period !== 'week') return [] as [string, { totalSeconds: number; sessions: { id: string; durationSeconds: number; loggedAt: number }[] }][];
		const map = new Map<string, { totalSeconds: number; sessions: { id: string; durationSeconds: number; loggedAt: number }[] }>();
		for (const log of meditationLogs) {
			const key = tsToDateKey(log.loggedAt);
			if (!map.has(key)) map.set(key, { totalSeconds: 0, sessions: [] });
			const entry = map.get(key)!;
			entry.totalSeconds += log.durationSeconds;
			entry.sessions.push(log);
		}
		for (const entry of map.values()) entry.sessions.sort((a, b) => a.loggedAt - b.loggedAt);
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	});

	// Week/Month: per-supplement adherence (taken/planned days + daily ●/◐/○)
	const adherence = $derived.by(() => {
		if (period === 'day' || rangeFrom === 0 || rangeTo === 0) return [];
		return computeAdherence(allSupplements, schedules, logs, { from: rangeFrom, to: rangeTo });
	});

	// Week/Month: tracker stats (caffeine mg/day, meditation min/day)
	const caffeineStats = $derived.by(() => {
		if (period === 'day' || rangeFrom === 0) return null;
		return computeTrackerStats(
			caffeineLogs.map(l => ({ value: l.caffeineMg, loggedAt: l.loggedAt })),
			{ from: rangeFrom, to: rangeTo }
		);
	});

	const meditationStats = $derived.by(() => {
		if (period === 'day' || rangeFrom === 0) return null;
		return computeTrackerStats(
			meditationLogs.map(l => ({ value: Math.round(l.durationSeconds / 60), loggedAt: l.loggedAt })),
			{ from: rangeFrom, to: rangeTo }
		);
	});

	const waterStats = $derived.by(() => {
		if (period === 'day' || rangeFrom === 0) return null;
		return computeTrackerStats(
			waterLogs.map(l => ({ value: l.amountMl, loggedAt: l.loggedAt })),
			{ from: rangeFrom, to: rangeTo }
		);
	});

	// Day labels + today-index for the current range (used by tracker bars + supplement dots)
	const rangeDays = $derived.by(() => {
		if (period === 'day' || rangeFrom === 0 || rangeTo === 0) return [] as string[];
		return eachDayInRange({ from: rangeFrom, to: rangeTo });
	});


	const todayIdx = $derived.by(() => {
		if (rangeDays.length === 0) return -1;
		return rangeDays.indexOf(todayKey());
	});

	const dayLabels = $derived.by(() => {
		if (rangeDays.length === 0) return [] as string[];
		if (period === 'week') {
			// Mo Di Mi … in user locale
			return rangeDays.map(k => new Date(k + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'short' }).replace('.', '').slice(0, 2));
		}
		// month: only show every 5th day + the 1st (today gets dot highlight instead of a label, avoids collisions like "2021")
		return rangeDays.map((k, i) => {
			const day = parseInt(k.slice(-2), 10);
			const isLast = i === rangeDays.length - 1;
			// Show 1, 5, 10, 15, 20, 25, 30 — and last day only if it's not adjacent to a labeled day
			if (day === 1 || day % 5 === 0) return String(day);
			if (isLast && day % 5 !== 1 && day % 5 !== 0) return String(day);
			return '';
		});
	});

	function fmtNumber(v: number, digits = 0): string {
		if (digits === 0) return Math.round(v).toString();
		return v.toFixed(digits).replace(/\.0+$/, '');
	}

	// Day-view: hour position 0–100% for a log timestamp
	function hourPos(ts: number): number {
		const d = new Date(ts);
		return ((d.getHours() + d.getMinutes() / 60) / 24) * 100;
	}
	function timePos(hhmm: string): number {
		const [h, m] = hhmm.split(':').map(Number);
		return ((h + (m ?? 0) / 60) / 24) * 100;
	}
	function weekdayOf(dateStr: string): number {
		const d = new Date(dateStr + 'T12:00:00');
		return d.getDay();
	}
	// Day-view: per-supplement scheduled times (filtered to current viewed date's weekday)
	const supplementSchedulesForDay = $derived.by(() => {
		const map = new Map<string, string[]>();
		if (period !== 'day') return map;
		const wd = weekdayOf(date);
		for (const s of schedules) {
			if (!s.active) continue;
			if (!parseDaysMask(s.days).includes(wd)) continue;
			const list = map.get(s.supplementId) ?? [];
			list.push(s.time);
			map.set(s.supplementId, list);
		}
		return map;
	});

	const caffeineByDay = $derived.by(() => {
		if (!caffeineHistoryCardExpanded || period !== 'week') return [] as [string, { totalMg: number; totalMl: number; drinks: { name: string; mg: number; ml: number }[] }][];
		const map = new Map<string, { totalMg: number; totalMl: number; drinks: { name: string; mg: number; ml: number }[] }>();
		for (const log of caffeineLogs) {
			const key = tsToDateKey(log.loggedAt);
			if (!map.has(key)) map.set(key, { totalMg: 0, totalMl: 0, drinks: [] });
			const entry = map.get(key)!;
			entry.totalMg += log.caffeineMg;
			entry.totalMl += log.amountMl;
			entry.drinks.push({ name: log.drinkName, mg: log.caffeineMg, ml: log.amountMl });
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	});
</script>

{#snippet timelineGuides()}
	<!-- 0 / 6 / 12 / 18 / 24h grid ticks -->
	<div class="absolute pointer-events-none" style="left: 0; top: 0; bottom: 0; width: 1px; background-color: var(--color-on-surface-variant); opacity: 0.15"></div>
	<div class="absolute pointer-events-none" style="left: 25%; top: 0; bottom: 0; width: 1px; background-color: var(--color-on-surface-variant); opacity: 0.15"></div>
	<div class="absolute pointer-events-none" style="left: 50%; top: 0; bottom: 0; width: 1px; background-color: var(--color-on-surface-variant); opacity: 0.15"></div>
	<div class="absolute pointer-events-none" style="left: 75%; top: 0; bottom: 0; width: 1px; background-color: var(--color-on-surface-variant); opacity: 0.15"></div>
	<div class="absolute pointer-events-none" style="right: 0; top: 0; bottom: 0; width: 1px; background-color: var(--color-on-surface-variant); opacity: 0.15"></div>
	{#if isToday}
		<div class="absolute pointer-events-none" style="left: calc({nowPercent}% - 0.5px); top: -2px; bottom: -2px; width: 1.5px; background-color: var(--color-primary); opacity: 0.7"></div>
	{/if}
{/snippet}

<div class="px-4 space-y-4">
	{#if loading}
		<div class="flex justify-center py-8">
			<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else}
		{@const suppsForCheck = period === 'day' ? dayCombinedSupplements.length : adherence.length || supplementStatEntries.length}
		{@const otherEmpty = nutrientEntries.length === 0 && suppsForCheck === 0 && waterTotal === 0 && caffeineTotalMg === 0 && meditationTotalSeconds === 0}
		{#if userSettings.moodTrackerEnabled}
			<MoodHistoryView bind:hasDayEntry={moodHasDayEntry} onreload={onMoodReload} fixedView={period === 'day' ? 'today' : period} parentDate={date} />
		{/if}
		{#if otherEmpty && (!userSettings.moodTrackerEnabled || !moodHasDayEntry)}
			<div class="px-4 py-10 text-center">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" class="mx-auto mb-3" style="opacity: 0.5">
					<rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
				</svg>
				<p class="text-sm font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_stats_empty}</p>
			</div>
		{/if}
		{#if !otherEmpty}
		<!-- Week/Month: stat-style tracker card with Ø/Min-Max/active + sparkline -->
		{#if period !== 'day' && (caffeineStats || meditationStats || waterStats)}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button
					onclick={() => trackerCardExpanded = !trackerCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<div class="flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-on-surface)">Tracker</p>
					</div>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({trackerCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if trackerCardExpanded}
				<div class="px-4 pb-3 space-y-3">
					{#if dayLabels.length > 0}
						<!-- Shared day-header (Mo Di Mi … or 1 5 10 … for month) -->
						{@const selAny = caffeineSelectedIdx ?? meditationSelectedIdx ?? waterSelectedIdx}
						<div class="flex" style="gap: {period === 'month' ? 2 : 3}px">
							{#each dayLabels as label, i}
								<span class="flex-1 text-center text-[9px] uppercase tabular-nums" style="color: {i === selAny || i === todayIdx ? '#C8956C' : 'var(--color-on-surface-variant)'}; font-weight: {i === selAny || i === todayIdx ? '700' : '500'}">{label}</span>
							{/each}
						</div>
					{/if}
					{#if userSettings.caffeineTrackerEnabled && caffeineStats && caffeineStats.activeDays > 0}
						{@const cs = caffeineStats}
						{@const maxC = Math.max(...cs.daily, 1)}
						{@const selIdx = caffeineSelectedIdx}
						{@const selDate = selIdx !== null ? rangeDays[selIdx] : null}
						<div>
							<div class="flex items-center justify-between text-sm mb-1.5">
								<span class="font-semibold" style="color: #C8956C">{t.caffeine_title}</span>
								{#if selDate}
									<span class="text-xs tabular-nums" style="color: #C8956C">
										{new Date(selDate + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · {cs.daily[selIdx!]} mg
									</span>
								{:else}
									<span class="text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
										Ø {fmtNumber(cs.avgPerDay)} mg · {caffeineLogs.length} {t.history_drinks_unit} · {cs.activeDays}/{cs.totalDays}
									</span>
								{/if}
							</div>
							<div class="relative" style="padding-top: 10px">
								<span class="absolute right-0 text-[9px] tabular-nums leading-none" style="top: 0; color: var(--color-on-surface-variant); opacity: 0.55">{cs.max} mg</span>
								<div class="absolute left-0 right-0 pointer-events-none" style="top: 10px; border-top: 1px dashed var(--color-on-surface-variant); opacity: 0.22"></div>
								<div class="flex items-end" style="height: 26px; gap: {period === 'month' ? 2 : 3}px">
									{#each cs.daily as v, i}
										{@const pct = v === 0 ? 14 : Math.max(14, (v / maxC) * 100)}
										{@const isToday = i === todayIdx}
										{@const isSelected = i === selIdx}
										<button
											onclick={() => caffeineSelectedIdx = selIdx === i ? null : i}
											aria-label={'Tag ' + (i + 1)}
											class="flex-1 active:opacity-70"
											style="background-color: #C8956C; opacity: {v === 0 ? 0.18 : (isSelected ? 1 : 0.9)}; height: {pct}%; min-height: 4px; border-radius: 3px; {isSelected ? 'outline: 1.5px solid #C8956C; outline-offset: 2px' : (isToday ? 'outline: 1.5px solid #C8956C; outline-offset: 1px' : '')}"
										></button>
									{/each}
								</div>
							</div>
							{#if selDate}
								{@const selCaffeineLogs = caffeineLogs
									.filter(l => tsToDateKey(l.loggedAt) === selDate)
									.sort((x, y) => x.loggedAt - y.loggedAt)}
								{#if selCaffeineLogs.length > 0}
									<div class="mt-2 space-y-0.5">
										{#each selCaffeineLogs as log}
											<div class="flex items-baseline justify-between text-xs">
												<span style="color: var(--color-on-surface)">
													<span class="tabular-nums" style="color: var(--color-on-surface-variant)">{formatTime(log.loggedAt)}</span>
													<span class="ml-2">{log.drinkName}</span>
												</span>
												<span class="tabular-nums" style="color: var(--color-on-surface-variant)">{log.amountMl} ml · {log.caffeineMg} mg</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
					{#if userSettings.meditationTrackerEnabled && meditationStats && meditationStats.activeDays > 0}
						{@const ms = meditationStats}
						{@const maxM = Math.max(...ms.daily, 1)}
						{@const selIdxM = meditationSelectedIdx}
						{@const selDateM = selIdxM !== null ? rangeDays[selIdxM] : null}
						{@const selMedLogs = selDateM ? meditationLogs
							.filter(l => tsToDateKey(l.loggedAt) === selDateM)
							.sort((x, y) => x.loggedAt - y.loggedAt) : []}
						<div>
							<div class="flex items-center justify-between text-sm mb-1.5">
								<span class="font-semibold" style="color: #9F7AEA">{t.meditation_title}</span>
								{#if selDateM}
									<span class="text-xs tabular-nums" style="color: #9F7AEA">
										{new Date(selDateM + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · {ms.daily[selIdxM!]} min
										{#if selMedLogs.length > 0}
											<span style="color: var(--color-on-surface-variant)"> · {selMedLogs.map(l => formatTime(l.loggedAt)).join(', ')}</span>
										{/if}
									</span>
								{:else}
									<span class="text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
										Ø {fmtNumber(ms.avgPerDay)} min · {ms.total} min · {ms.activeDays}/{ms.totalDays}
									</span>
								{/if}
							</div>
							<div class="relative" style="padding-top: 10px">
								<span class="absolute right-0 text-[9px] tabular-nums leading-none" style="top: 0; color: var(--color-on-surface-variant); opacity: 0.55">{ms.max} min</span>
								<div class="absolute left-0 right-0 pointer-events-none" style="top: 10px; border-top: 1px dashed var(--color-on-surface-variant); opacity: 0.22"></div>
								<div class="flex items-end" style="height: 26px; gap: {period === 'month' ? 2 : 3}px">
									{#each ms.daily as v, i}
										{@const pct = v === 0 ? 14 : Math.max(14, (v / maxM) * 100)}
										{@const isToday = i === todayIdx}
										{@const isSelected = i === selIdxM}
										<button
											onclick={() => meditationSelectedIdx = selIdxM === i ? null : i}
											aria-label={'Tag ' + (i + 1)}
											class="flex-1 active:opacity-70"
											style="background-color: #9F7AEA; opacity: {v === 0 ? 0.18 : (isSelected ? 1 : 0.9)}; height: {pct}%; min-height: 4px; border-radius: 3px; {isSelected ? 'outline: 1.5px solid #9F7AEA; outline-offset: 2px' : (isToday ? 'outline: 1.5px solid #9F7AEA; outline-offset: 1px' : '')}"
										></button>
									{/each}
								</div>
							</div>
						</div>
					{/if}
					{#if userSettings.waterTrackerEnabled && waterStats && waterStats.activeDays > 0}
						{@const ws = waterStats}
						{@const maxW = Math.max(...ws.daily, 1)}
						{@const selIdxW = waterSelectedIdx}
						{@const selDateW = selIdxW !== null ? rangeDays[selIdxW] : null}
						{@const selWaterLogs = selDateW ? waterLogs
							.filter(l => tsToDateKey(l.loggedAt) === selDateW)
							.sort((x, y) => x.loggedAt - y.loggedAt) : []}
						<div>
							<div class="flex items-center justify-between text-sm mb-1.5">
								<span class="font-semibold" style="color: #60A5FA">{t.water_title}</span>
								{#if selDateW}
									<span class="text-xs tabular-nums" style="color: #60A5FA">
										{new Date(selDateW + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' })} · {ws.daily[selIdxW!]} ml
									</span>
								{:else}
									<span class="text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
										Ø {fmtNumber(ws.avgPerDay)} ml · {ws.total} ml · {ws.activeDays}/{ws.totalDays}
									</span>
								{/if}
							</div>
							<div class="relative" style="padding-top: 10px">
								<span class="absolute right-0 text-[9px] tabular-nums leading-none" style="top: 0; color: var(--color-on-surface-variant); opacity: 0.55">{ws.max} ml</span>
								<div class="absolute left-0 right-0 pointer-events-none" style="top: 10px; border-top: 1px dashed var(--color-on-surface-variant); opacity: 0.22"></div>
								<div class="flex items-end" style="height: 26px; gap: {period === 'month' ? 2 : 3}px">
									{#each ws.daily as v, i}
										{@const pct = v === 0 ? 14 : Math.max(14, (v / maxW) * 100)}
										{@const isToday = i === todayIdx}
										{@const isSelected = i === selIdxW}
										<button
											onclick={() => waterSelectedIdx = selIdxW === i ? null : i}
											aria-label={'Tag ' + (i + 1)}
											class="flex-1 active:opacity-70"
											style="background-color: #60A5FA; opacity: {v === 0 ? 0.18 : (isSelected ? 1 : 0.9)}; height: {pct}%; min-height: 4px; border-radius: 3px; {isSelected ? 'outline: 1.5px solid #60A5FA; outline-offset: 2px' : (isToday ? 'outline: 1.5px solid #60A5FA; outline-offset: 1px' : '')}"
										></button>
									{/each}
								</div>
							</div>
							{#if selWaterLogs.length > 0}
								<div class="mt-2 text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
									{selWaterLogs.map(l => l.amountMl + ' ml').join(' · ')}
								</div>
							{/if}
						</div>
					{/if}
				</div>
				{/if}
			</div>
		{/if}

		{@const visibleHistoryTrackers = [
			userSettings.caffeineTrackerEnabled && caffeineTotalMg > 0 ? 'caffeine' : null,
			userSettings.meditationTrackerEnabled && meditationTotalSeconds > 0 ? 'meditation' : null,
			userSettings.waterTrackerEnabled && period === 'day' && waterTotal > 0 ? 'water' : null,
		].filter(Boolean)}
		{#if period === 'day' && visibleHistoryTrackers.length > 0}
			<div class="rounded-2xl px-4 py-3" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<div class="flex items-center gap-2 mb-2">
					<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
					<p class="text-sm font-semibold" style="color: var(--color-on-surface)">Tracker</p>
				</div>
				<!-- Shared hour scale -->
				<div class="relative text-[9px] tabular-nums mb-2" style="color: var(--color-on-surface-variant); height: 12px">
					<span class="absolute" style="left: 0">0</span>
					<span class="absolute" style="left: 25%; transform: translateX(-50%)">6</span>
					<span class="absolute" style="left: 50%; transform: translateX(-50%)">12</span>
					<span class="absolute" style="left: 75%; transform: translateX(-50%)">18</span>
					<span class="absolute" style="right: 0">24</span>
				</div>
				<div class="space-y-4">
					<!-- Caffeine -->
					{#if userSettings.caffeineTrackerEnabled && caffeineTotalMg > 0}
						{@const cLimit = userSettings.caffeineLimitMg ?? 400}
						{@const cPct = Math.min(100, (caffeineTotalMg / cLimit) * 100)}
						{@const cOver = caffeineTotalMg > cLimit}
						<div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-baseline gap-1.5 min-w-0 flex-1">
									<span class="font-semibold shrink-0" style="color: #C8956C">{t.caffeine_title}</span>
									<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">
										{caffeineTotalMl} ml{period !== 'day' ? ` · ${caffeineLogs.length}×` : ''}
									</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: {cOver && period === 'day' ? '#EF4444' : '#C8956C'}">
										{caffeineTotalMg}{period === 'day' ? ` / ${cLimit}` : ''} mg
									</span>
									<button onclick={() => caffeineHistoryCardExpanded = !caffeineHistoryCardExpanded} class="active:opacity-60" aria-label={caffeineHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({caffeineHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							{#if period === 'day'}
								<!-- Progress bar -->
								<div class="relative mt-2 rounded-full overflow-hidden" style="background-color: var(--color-surface-container); height: 6px">
									<div style="width: {cPct}%; height: 100%; background-color: {cOver ? '#EF4444' : '#C8956C'}; border-radius: 9999px"></div>
								</div>
								<!-- 24h timeline with log markers -->
								<div class="relative mt-2" style="height: 14px">
									<div class="absolute inset-x-0 rounded-full" style="top: 6px; height: 1.5px; background-color: color-mix(in srgb, var(--color-on-surface-variant) 22%, transparent)"></div>
									{@render timelineGuides()}
									{#each caffeineLogs as log}
										<button onclick={() => focusLog(log.id, caffeineHistoryCardExpanded, v => caffeineHistoryCardExpanded = v)}
											aria-label="Eintrag"
											class="absolute rounded-full active:opacity-60"
											style="left: calc({hourPos(log.loggedAt)}% - 3px); top: 1px; width: 6px; height: 12px; background-color: #C8956C; opacity: 0.95; {focusedLogId === log.id ? 'box-shadow: 0 0 0 2px var(--color-surface-card), 0 0 0 3.5px #C8956C' : ''}"
										></button>
									{/each}
								</div>
							{/if}
							{#if caffeineHistoryCardExpanded}
								{#if period === 'day'}
									<div class="space-y-1 mt-1.5">
										{#each caffeineLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											<div class="flex items-center gap-2 text-xs rounded-md px-1.5 py-0.5 -mx-1.5"
											     style={focusedLogId === log.id ? 'background-color: color-mix(in srgb, #C8956C 18%, transparent)' : ''}>
												<span class="flex-1 min-w-0" style="color: var(--color-on-surface)">{log.drinkName} · {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
												<span class="font-semibold shrink-0" style="color: #C8956C">{log.caffeineMg} mg</span>
												{#if onEditCaffeineLog}
													<button
														onclick={() => onEditCaffeineLog?.(log)}
														class="shrink-0 p-1 rounded active:opacity-50"
														aria-label="Bearbeiten"
														style="color: var(--color-on-surface-variant)"
													>
														<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
															<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
															<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
														</svg>
													</button>
												{/if}
											</div>
										{/each}
									</div>
								{:else if period === 'week'}
									<div class="space-y-2 mt-1.5">
										{#each caffeineByDay as [dateKey, dayData]}
											<div>
												<div class="flex justify-between items-center mb-0.5">
													<span class="text-xs font-semibold" style="color: var(--color-on-surface-variant)">
														{new Date(dateKey + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
													</span>
													<span class="text-xs font-semibold" style="color: #C8956C">{dayData.totalMg} mg</span>
												</div>
												<div class="space-y-0.5">
													{#each dayData.drinks as drink}
														<div class="flex justify-between items-center text-xs">
															<span style="color: var(--color-on-surface)">{drink.name} · {drink.ml} ml</span>
															<span style="color: var(--color-on-surface-variant)">{drink.mg} mg</span>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									{@const drinkCounts = [...caffeineLogs.reduce((m, l) => (m.set(l.drinkName, (m.get(l.drinkName) ?? 0) + 1), m), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])}
									<div class="space-y-1 mt-1.5">
										{#each drinkCounts as [name, count]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">{name}</span>
												<span style="color: var(--color-on-surface-variant)">{count}×</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Meditation -->
					{#if userSettings.meditationTrackerEnabled && meditationTotalSeconds > 0}
						<div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-baseline gap-1.5 min-w-0 flex-1">
									<span class="font-semibold shrink-0" style="color: #9F7AEA">{t.meditation_title}</span>
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{meditationLogs.length}×</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: #9F7AEA">{Math.floor(meditationTotalSeconds / 60)} min</span>
									<button onclick={() => meditationHistoryCardExpanded = !meditationHistoryCardExpanded} class="active:opacity-60" aria-label={meditationHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({meditationHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							{#if period === 'day'}
								<!-- 24h timeline: sessions as wider pills spanning start→end -->
								<div class="relative mt-2" style="height: 14px">
									<div class="absolute inset-x-0 rounded-full" style="top: 6px; height: 1.5px; background-color: color-mix(in srgb, var(--color-on-surface-variant) 22%, transparent)"></div>
									{@render timelineGuides()}
									{#each meditationLogs as log}
										{@const endTs = log.loggedAt}
										{@const startTs = endTs - log.durationSeconds * 1000}
										{@const lp = hourPos(startTs)}
										{@const rp = hourPos(endTs)}
										{@const w = Math.max(0.8, rp - lp)}
										<button onclick={() => focusLog(log.id, meditationHistoryCardExpanded, v => meditationHistoryCardExpanded = v)}
											aria-label="Sitzung"
											class="absolute rounded-full active:opacity-60"
											style="left: {lp}%; top: 1px; width: {w}%; min-width: 4px; height: 12px; background-color: #9F7AEA; opacity: 0.95; {focusedLogId === log.id ? 'box-shadow: 0 0 0 2px var(--color-surface-card), 0 0 0 3.5px #9F7AEA' : ''}"
										></button>
									{/each}
								</div>
							{/if}
							{#if meditationHistoryCardExpanded}
								{#if period === 'day'}
									<div class="space-y-1 mt-1.5">
										{#each meditationLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											{@const endTs = log.loggedAt}
											{@const startTs = endTs - log.durationSeconds * 1000}
											<div class="flex justify-between items-center text-xs rounded-md px-1.5 py-0.5 -mx-1.5"
											     style={focusedLogId === log.id ? 'background-color: color-mix(in srgb, #9F7AEA 18%, transparent)' : ''}>
												<span style="color: var(--color-on-surface)">
													{new Date(startTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(endTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</span>
												<span class="font-semibold" style="color: #9F7AEA">{Math.round(log.durationSeconds / 60)} min</span>
											</div>
										{/each}
									</div>
								{:else if period === 'week'}
									<div class="space-y-1 mt-1.5">
										{#each meditationByDay as [dateKey, dayData]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">
													{new Date(dateKey + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
												</span>
												<span class="font-semibold" style="color: #9F7AEA">{Math.floor(dayData.totalSeconds / 60)} min</span>
											</div>
										{/each}
									</div>
								{:else}
									{@const durationCounts = [...meditationLogs.reduce((m, l) => { const min = Math.round(l.durationSeconds / 60); m.set(min, (m.get(min) ?? 0) + 1); return m; }, new Map<number, number>()).entries()].sort((a, b) => b[1] - a[1])}
									<div class="space-y-1 mt-1.5">
										{#each durationCounts as [min, count]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">{min} min</span>
												<span style="color: var(--color-on-surface-variant)">{count}×</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Water -->
					{#if userSettings.waterTrackerEnabled && period === 'day' && waterTotal > 0}
						{@const wGoal = userSettings.waterGoalMl ?? 2500}
						{@const wPct = Math.min(100, (waterTotal / wGoal) * 100)}
						<div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-baseline gap-1.5 min-w-0 flex-1">
									<span class="font-semibold shrink-0" style="color: #60A5FA">{t.water_title}</span>
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{waterLogs.length}×</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: #60A5FA">{waterTotal} / {wGoal} ml</span>
									<button onclick={() => waterHistoryCardExpanded = !waterHistoryCardExpanded} class="active:opacity-60" aria-label={waterHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({waterHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							<!-- Progress bar -->
							<div class="relative mt-2 rounded-full overflow-hidden" style="background-color: var(--color-surface-container); height: 6px">
								<div style="width: {wPct}%; height: 100%; background-color: #60A5FA; border-radius: 9999px"></div>
							</div>
							<!-- 24h timeline -->
							<div class="relative mt-2" style="height: 14px">
								<div class="absolute inset-x-0 rounded-full" style="top: 6px; height: 1.5px; background-color: color-mix(in srgb, var(--color-on-surface-variant) 22%, transparent)"></div>
								{@render timelineGuides()}
								{#each waterLogs as log}
									<button onclick={() => focusLog(log.id, waterHistoryCardExpanded, v => waterHistoryCardExpanded = v)}
										aria-label="Eintrag"
										class="absolute rounded-full active:opacity-60"
										style="left: calc({hourPos(log.loggedAt)}% - 3px); top: 1px; width: 6px; height: 12px; background-color: #60A5FA; opacity: 0.95; {focusedLogId === log.id ? 'box-shadow: 0 0 0 2px var(--color-surface-card), 0 0 0 3.5px #60A5FA' : ''}"
									></button>
								{/each}
							</div>
							{#if waterHistoryCardExpanded}
								<div class="space-y-1 mt-1.5">
									{#each waterLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
										<div class="flex items-center gap-2 text-xs rounded-md px-1.5 py-0.5 -mx-1.5"
										     style={focusedLogId === log.id ? 'background-color: color-mix(in srgb, #60A5FA 18%, transparent)' : ''}>
											<span class="flex-1 min-w-0" style="color: var(--color-on-surface)">{new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											<span class="font-semibold shrink-0" style="color: #60A5FA">{log.amountMl} ml</span>
											{#if onEditWaterLog}
												<button
													onclick={() => onEditWaterLog?.(log)}
													class="shrink-0 p-1 rounded active:opacity-50"
													aria-label="Bearbeiten"
													style="color: var(--color-on-surface-variant)"
												>
													<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
													</svg>
												</button>
											{/if}
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
		<!-- Supplements taken -->
		{#if period !== 'day' && adherence.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button
					onclick={() => supplementsCardExpanded = !supplementsCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<div class="flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-on-surface)">Supplements</p>
					</div>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({supplementsCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if supplementsCardExpanded}
					<div class="px-4 pb-3">
						{#if dayLabels.length > 0}
							<!-- Shared day-header (Mo Di Mi … or 1 5 10 … for month) -->
							<div class="flex mb-2">
								{#each dayLabels as label, i}
									<span class="flex-1 text-center text-[9px] uppercase tabular-nums" style="color: {i === supplementSelectedIdx || i === todayIdx ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}; font-weight: {i === supplementSelectedIdx || i === todayIdx ? '700' : '500'}">{label}</span>
								{/each}
							</div>
						{/if}
						<div class="space-y-3">
						{#each adherence as a}
							{@const denom = a.planned > 0 ? a.planned : a.totalDays}
							{@const selIdx = supplementSelectedIdx}
							{@const selDate = selIdx !== null ? rangeDays[selIdx] : null}
							{@const selFill = selIdx !== null ? a.daily[selIdx] : null}
							{@const selTimes = selDate ? logs
								.filter(l => l.supplementId === a.supplementId && tsToDateKey(l.loggedAt) === selDate)
								.sort((x, y) => x.loggedAt - y.loggedAt)
								.map(l => formatTime(l.loggedAt)) : []}
							<div>
								<div class="flex items-center justify-between text-sm mb-1.5">
									<span class="truncate pr-2" style="color: var(--color-on-surface)">{a.name}</span>
									{#if selDate}
										<span class="text-xs tabular-nums shrink-0" style="color: var(--color-primary)">
											{new Date(selDate + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'short', day: 'numeric', month: 'short' })}
											·
											{#if selFill === 'full'}✓{:else if selFill === 'partial'}◐{:else if selFill === 'none'}✗{:else}—{/if}
											{#if selTimes.length > 0}
												<span style="color: var(--color-on-surface-variant)"> · {selTimes.join(', ')}</span>
											{/if}
										</span>
									{:else}
										<div class="flex items-baseline gap-1 shrink-0 tabular-nums text-xs">
											<span style="color: var(--color-on-surface-variant)">{a.taken}/{denom}</span>
											<span style="color: var(--color-on-surface-variant)">·</span>
											<span class="font-semibold" style="color: var(--color-primary)">{a.percent}%</span>
										</div>
									{/if}
								</div>
								<!-- Daily strip (matches header above) -->
								{#if period === 'week'}
									<!-- Week: pill-style cells like the tracker, slim height, full color -->
									<div class="flex items-center gap-[3px]" style="height: 12px">
										{#each a.daily as d, i}
											{@const isToday = i === todayIdx}
											{@const isSel = i === selIdx}
											{@const outline = isSel ? 'outline: 1.5px solid var(--color-primary); outline-offset: 2px' : (isToday ? 'outline: 1.5px solid color-mix(in srgb, var(--color-primary) 60%, transparent); outline-offset: 1px' : '')}
											{@const bg = d === 'full' ? 'var(--color-primary-dim)'
												: d === 'partial' ? 'color-mix(in srgb, var(--color-primary-dim) 55%, var(--color-surface-high))'
												: d === 'none' ? 'var(--color-surface-high)'
												: 'var(--color-surface-container)'}
											<button
												onclick={() => supplementSelectedIdx = selIdx === i ? null : i}
												aria-label={'Tag ' + (i + 1)}
												class="flex-1 active:opacity-70"
												style="height: 100%; background-color: {bg}; border-radius: 3px; {outline}"
											></button>
										{/each}
									</div>
								{:else}
									<!-- Month: pill-style cells like week + tracker, smaller height for 31-day density -->
									<div class="flex items-center gap-[2px]" style="height: 9px">
										{#each a.daily as d, i}
											{@const isToday = i === todayIdx}
											{@const isSel = i === selIdx}
											{@const outline = isSel ? 'outline: 1.5px solid var(--color-primary); outline-offset: 1.5px' : (isToday ? 'outline: 1.5px solid color-mix(in srgb, var(--color-primary) 60%, transparent); outline-offset: 1px' : '')}
											{@const bg = d === 'full' ? 'var(--color-primary-dim)'
												: d === 'partial' ? 'color-mix(in srgb, var(--color-primary-dim) 55%, var(--color-surface-high))'
												: d === 'none' ? 'var(--color-surface-high)'
												: 'var(--color-surface-container)'}
											<button
												onclick={() => supplementSelectedIdx = selIdx === i ? null : i}
												aria-label={'Tag ' + (i + 1)}
												class="flex-1 active:opacity-70"
												style="height: 100%; background-color: {bg}; border-radius: 2px; {outline}"
											></button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
						</div>
					</div>
				{/if}
			</div>
		{:else if period === 'day' && dayCombinedSupplements.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button
					onclick={() => supplementsCardExpanded = !supplementsCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<div class="flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-on-surface)">Supplements</p>
					</div>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({supplementsCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if supplementsCardExpanded}
					<div class="px-4 pb-3 space-y-2.5">
						<!-- Hour scale (shared) -->
						<div class="relative text-[9px] tabular-nums" style="color: var(--color-on-surface-variant); padding-top: 2px; height: 14px">
							<span class="absolute" style="left: 0; top: 2px">0</span>
							<span class="absolute" style="left: 25%; top: 2px; transform: translateX(-50%)">6</span>
							<span class="absolute" style="left: 50%; top: 2px; transform: translateX(-50%)">12</span>
							<span class="absolute" style="left: 75%; top: 2px; transform: translateX(-50%)">18</span>
							<span class="absolute" style="right: 0; top: 2px">24</span>
						</div>
						{#each dayCombinedSupplements as sup}
							{@const suppLogs = logsBySuppId.get(sup.id) ?? []}
							{@const scheduledTimes = supplementSchedulesForDay.get(sup.id) ?? []}
							{@const expandable = suppLogs.length > 0}
							{@const suppExpanded = expandedSuppIds.has(sup.id)}
							{@const isPending = suppLogs.length === 0 && scheduledTimes.length > 0}
							<div style={isPending ? 'opacity: 0.7' : ''}>
								<div class="flex justify-between items-center text-sm">
									<span class="truncate pr-2 font-semibold" style="color: var(--color-on-surface)">{sup.name}</span>
									<div class="flex items-center gap-1.5 shrink-0">
										{#if sup.total > 0}
											<span class="font-semibold tabular-nums text-xs" style="color: var(--color-primary)">{sup.total} {displayUnit(sup.unit, currentLang())}</span>
										{:else}
											<span class="text-xs tabular-nums" style="color: var(--color-on-surface-variant)">{scheduledTimes.length}× {currentLang() === 'en' ? 'planned' : 'geplant'}</span>
										{/if}
										{#if expandable}
											<button
												onclick={() => toggleSupp(sup.id)}
												class="active:opacity-60"
												aria-label={suppExpanded ? 'Einklappen' : 'Aufklappen'}
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
												     style="transition: transform 0.2s; transform: rotate({suppExpanded ? '90' : '0'}deg)">
													<polyline points="9 6 15 12 9 18"/>
												</svg>
											</button>
										{/if}
									</div>
								</div>
								<!-- Per-supplement 24h timeline: hollow circles for scheduled, filled for taken -->
								<div class="relative mt-1.5" style="height: 16px">
									<div class="absolute inset-x-0 rounded-full" style="top: 7px; height: 1.5px; background-color: color-mix(in srgb, var(--color-on-surface-variant) 22%, transparent)"></div>
									{@render timelineGuides()}
									{#each scheduledTimes as time}
										<div class="absolute rounded-full" style="left: calc({timePos(time)}% - 3.5px); top: 1px; width: 7px; height: 14px; background-color: transparent; border: 1.5px solid color-mix(in srgb, var(--color-primary-dim) 55%, transparent)"></div>
									{/each}
									{#each suppLogs as log}
										<button onclick={() => focusSupplementLog(log)}
											aria-label="Eintrag"
											class="absolute rounded-full active:opacity-60"
											style="left: calc({hourPos(log.loggedAt)}% - 3.5px); top: 1px; width: 7px; height: 14px; background-color: var(--color-primary-dim); {focusedLogId === log.id ? 'box-shadow: 0 0 0 2.5px var(--color-surface-card), 0 0 0 4.5px var(--color-primary)' : 'box-shadow: 0 0 0 2.5px var(--color-surface-card), 0 0 0 4px color-mix(in srgb, var(--color-primary-dim) 18%, transparent)'}"
										></button>
									{/each}
								</div>
								{#if expandable && suppExpanded}
									<div class="mt-1.5 space-y-1.5 pt-1.5 border-t" style="border-color: var(--color-outline-variant)">
										{#each suppLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											<div class="flex items-start gap-2 text-xs rounded-md px-1.5 py-0.5 -mx-1.5"
											     style={focusedLogId === log.id ? 'background-color: color-mix(in srgb, var(--color-primary) 18%, transparent)' : ''}>
												<div class="flex-1 min-w-0">
													<span class="tabular-nums" style="color: var(--color-on-surface-variant)">
														{formatTime(log.loggedAt)} ·
													</span>
													<span class="font-medium" style="color: var(--color-primary)">{log.amount} {displayUnit(sup.unit, currentLang())}</span>
													{#if log.note}
														<span class="italic ml-1" style="color: var(--color-on-surface-variant)">{log.note}</span>
													{/if}
												</div>
												<button
													onclick={() => onEditLog(log, sup)}
													class="shrink-0 p-1 rounded active:opacity-50"
													aria-label="Bearbeiten"
													style="color: var(--color-on-surface-variant)"
												>
													<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Nutrients (at the bottom — informational total per period) -->
		{#if nutrientEntries.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<button
					onclick={() => nutrientsCardExpanded = !nutrientsCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<div class="flex items-center gap-2">
						<span class="rounded-full" style="width: 6px; height: 6px; background-color: var(--color-primary)"></span>
						<p class="text-sm font-semibold" style="color: var(--color-on-surface)">{t.supplement_stats_nutrients}</p>
					</div>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({nutrientsCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if nutrientsCardExpanded}
					<div class="px-4 pb-3 space-y-0.5">
						{#each nutrientEntriesVisible as entry}
							<div class="relative flex justify-between items-center text-sm overflow-hidden rounded-md" style="padding: 4px 8px; margin: 0 -8px">
								<div class="absolute left-0 pointer-events-none" style="top: 3px; bottom: 3px; width: {nutrientPct(entry.total, entry.unit)}%; background-color: color-mix(in srgb, var(--color-primary) 9%, transparent); border-radius: 4px"></div>
								<span class="relative z-10 truncate pr-2" style="color: var(--color-on-surface)">{entry.name}</span>
								<span class="relative z-10 font-semibold tabular-nums shrink-0" style="color: var(--color-primary)">{formatNutrientValue(entry.total, entry.unit)}</span>
							</div>
						{/each}
						{#if nutrientsExpanded}
							{#each nutrientEntriesHidden as entry}
								<div class="relative flex justify-between items-center text-sm overflow-hidden rounded-md" style="padding: 4px 8px; margin: 0 -8px">
									<div class="absolute left-0 pointer-events-none" style="top: 3px; bottom: 3px; width: {nutrientPct(entry.total, entry.unit)}%; background-color: color-mix(in srgb, var(--color-primary) 9%, transparent); border-radius: 4px"></div>
									<span class="relative z-10 truncate pr-2" style="color: var(--color-on-surface)">{entry.name}</span>
									<span class="relative z-10 font-semibold tabular-nums shrink-0" style="color: var(--color-primary)">{formatNutrientValue(entry.total, entry.unit)}</span>
								</div>
							{/each}
						{/if}
						{#if nutrientEntriesHidden.length > 0}
							<button
								onclick={() => nutrientsExpanded = !nutrientsExpanded}
								class="w-full text-xs font-medium pt-2 pb-0.5 active:opacity-60 text-right"
								style="color: var(--color-primary)"
							>
								{nutrientsExpanded ? t.supplement_stats_show_less : nutrients_show_more(nutrientEntriesHidden.length)}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
		{/if}
	{/if}
</div>
