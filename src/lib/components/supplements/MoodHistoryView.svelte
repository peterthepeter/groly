<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { getMoodLevel, MOOD_LEVELS, findTag } from '$lib/mood';
	import MoodDayDetailSheet from './MoodDayDetailSheet.svelte';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';

	type MoodLogEntry = {
		id: string;
		date: string;
		mood: number;
		activities: string | null;
		note: string | null;
	};

	let {
		onreload,
		fixedView = null as 'today' | 'week' | 'month' | null,
		parentDate = null as string | null
	}: {
		onreload: () => void;
		fixedView?: 'today' | 'week' | 'month' | null;
		parentDate?: string | null;
	} = $props();

	type View = 'week' | 'month';
	let view = $state<View>('week');
	let referenceDate = $state(todayStr());
	let logs = $state<MoodLogEntry[]>([]);
	let loading = $state(false);
	let detailEntry = $state<{ date: string; mood: number; activities: string[]; note: string | null } | null>(null);
	let detailOpen = $state(false);
	let newEntryDate = $state('');
	let newEntryOpen = $state(false);
	let expanded = $state(true);

	// Sync view and date from parent when in fixed mode
	$effect(() => {
		if (fixedView === 'today') { if (parentDate) referenceDate = parentDate; }
		else if (fixedView === 'week') { view = 'week'; if (parentDate) referenceDate = parentDate; }
		else if (fixedView === 'month') { view = 'month'; if (parentDate) referenceDate = parentDate; }
	});

	function todayStr(): string {
		const d = new Date();
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function parseLogs(raw: MoodLogEntry[]): Map<string, { mood: number; activities: string[]; note: string | null }> {
		const map = new Map<string, { mood: number; activities: string[]; note: string | null }>();
		for (const l of raw) {
			let acts: string[] = [];
			try { acts = l.activities ? JSON.parse(l.activities) : []; } catch {}
			map.set(l.date, { mood: l.mood, activities: acts, note: l.note });
		}
		return map;
	}

	const logMap = $derived(parseLogs(logs));

	// Week helpers
	function weekDays(): string[] {
		const ref = new Date(referenceDate + 'T12:00:00');
		const dow = ref.getDay();
		const diff = dow === 0 ? -6 : 1 - dow;
		const monday = new Date(ref);
		monday.setDate(ref.getDate() + diff);
		return Array.from({ length: 7 }, (_, i) => {
			const d = new Date(monday);
			d.setDate(monday.getDate() + i);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		});
	}

	// Month helpers
	function monthDays(): (string | null)[] {
		const ref = new Date(referenceDate + 'T12:00:00');
		const year = ref.getFullYear();
		const month = ref.getMonth();
		const firstDow = new Date(year, month, 1).getDay();
		const leadingEmpty = firstDow === 0 ? 6 : firstDow - 1;
		const daysInMonth = new Date(year, month + 1, 0).getDate();
		const cells: (string | null)[] = Array(leadingEmpty).fill(null);
		for (let d = 1; d <= daysInMonth; d++) {
			cells.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
		}
		while (cells.length % 7 !== 0) cells.push(null);
		return cells;
	}

	function weekLabel(): string {
		const days = weekDays();
		const first = new Date(days[0] + 'T12:00:00');
		const last = new Date(days[6] + 'T12:00:00');
		return `${first.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
	}

	function monthLabel(): string {
		const ref = new Date(referenceDate + 'T12:00:00');
		return ref.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
	}

	function dayOfWeekShort(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
	}

	function dayNum(dateStr: string): string {
		return String(new Date(dateStr + 'T12:00:00').getDate());
	}

	function navigate(dir: -1 | 1) {
		const d = new Date(referenceDate + 'T12:00:00');
		if (view === 'week') d.setDate(d.getDate() + dir * 7);
		else d.setMonth(d.getMonth() + dir);
		referenceDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function getDateRange(): { from: string; to: string } {
		if (fixedView === 'today') {
			const d = parentDate ?? todayStr();
			return { from: d, to: d };
		}
		if (view === 'week') {
			const days = weekDays();
			return { from: days[0], to: days[6] };
		}
		const ref = new Date(referenceDate + 'T12:00:00');
		const year = ref.getFullYear();
		const month = ref.getMonth();
		const last = new Date(year, month + 1, 0).getDate();
		return {
			from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
			to: `${year}-${String(month + 1).padStart(2, '0')}-${String(last).padStart(2, '0')}`
		};
	}

	async function load() {
		loading = true;
		const { from, to } = getDateRange();
		try {
			const res = await fetch(`/api/mood-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				logs = data.logs ?? [];
			}
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		void view;
		void referenceDate;
		load();
	});

	function openDetail(dateStr: string) {
		const entry = logMap.get(dateStr);
		if (entry) {
			detailEntry = { date: dateStr, ...entry };
			detailOpen = true;
		} else {
			const today = todayStr();
			if (dateStr <= today) {
				newEntryDate = dateStr;
				newEntryOpen = true;
			}
		}
	}

	// Summary counts
	const moodCounts = $derived.by(() => {
		const counts = new Map<number, number>();
		for (const l of logs) {
			counts.set(l.mood, (counts.get(l.mood) ?? 0) + 1);
		}
		return counts;
	});

	function getTagLabel(key: string): string {
		const tag = findTag(key);
		if (!tag) return key;
		const labelKey = tag.labelKey as keyof typeof t;
		return (t[labelKey] as string) ?? key;
	}
</script>

<!-- ── Standalone mode (Today tab): collapsible card with own week/month toggle ── -->
{#if fixedView === null}
<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center justify-between px-4 py-3 active:opacity-70"
	>
		<p class="font-semibold text-sm" style="color: #F472B6">{t.mood_tracker_label}</p>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
			style="color: var(--color-on-surface-variant); transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>
	{#if expanded}
		<div class="px-4 pb-4 space-y-3" style="border-top: 1px solid var(--color-outline-variant)">
			{@render viewToggleAndNav()}
			{@render calendarContent()}
			{@render summaryBar()}
		</div>
	{/if}
</div>

<!-- ── Fixed "today" (History day view): single entry for the viewed date ── -->
{:else if fixedView === 'today'}
	{@const viewedDate = parentDate ?? todayStr()}
	{@const dayEntry = logMap.get(viewedDate)}
	{#if dayEntry}
		{@const level = getMoodLevel(dayEntry.mood)}
		<div class="rounded-2xl px-4 py-3 flex flex-col gap-2" style="background-color: var(--color-surface-card)">
			<div class="flex items-center gap-2">
				<p class="font-semibold text-sm flex-1" style="color: #F472B6">{t.mood_tracker_label}</p>
				<button
					onclick={() => openDetail(viewedDate)}
					class="flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold active:opacity-70"
					style="background-color: {level.bgColor}; color: {level.color}"
				>
					<MoodIcon value={level.value} size={15}/>
					<span>{(t[level.labelKey as keyof typeof t] as string) ?? ''}</span>
				</button>
			</div>
			{#if dayEntry.activities.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each dayEntry.activities as key}
						<span class="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
							<ActivityIcon icon={findTag(key)?.icon ?? ''} size={11} color="var(--color-on-surface-variant)" />{getTagLabel(key)}
						</span>
					{/each}
				</div>
			{/if}
			{#if dayEntry.note}
				<p class="text-xs leading-relaxed" style="color: var(--color-on-surface-variant)">{dayEntry.note}</p>
			{/if}
		</div>
	{/if}

<!-- ── Fixed week/month (History week/month view): no toggle, no own nav ── -->
{:else if logs.length > 0}
<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center gap-2 px-4 py-3 active:opacity-70"
		style=""
	>
		<p class="font-semibold text-sm shrink-0" style="color: #F472B6">{t.mood_tracker_label}</p>
		<div class="flex-1 flex items-center flex-wrap gap-x-2 gap-y-0.5">
			{#each MOOD_LEVELS.slice().reverse() as level}
				{@const count = moodCounts.get(level.value) ?? 0}
				{#if count > 0}
					<span class="text-xs font-medium flex items-center gap-0.5" style="color: {level.color}">
						<MoodIcon value={level.value} size={13}/>
						<span>{count}×</span>
					</span>
				{/if}
			{/each}
		</div>
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
			style="color: var(--color-on-surface-variant); transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg); flex-shrink: 0">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>
	{#if expanded}
		<div class="px-4 pb-4 pt-3">
			{@render calendarContent()}
		</div>
	{/if}
</div>
{/if}

{#snippet navButtons()}
	<button onclick={() => navigate(-1)} aria-label="Zurück" class="p-1 rounded active:opacity-60" style="color: var(--color-on-surface-variant)">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="15 18 9 12 15 6"/>
		</svg>
	</button>
	<span class="text-xs font-semibold" style="color: var(--color-on-surface)">{view === 'week' ? weekLabel() : monthLabel()}</span>
	<button onclick={() => navigate(1)} aria-label="Vorwärts" class="p-1 rounded active:opacity-60" style="color: var(--color-on-surface-variant)">
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>
{/snippet}

{#snippet viewToggleAndNav()}
	<div class="flex items-center gap-2 pt-3">
		<div class="flex rounded-xl overflow-hidden text-xs font-semibold shrink-0" style="background-color: var(--color-surface-container)">
			<button
				onclick={() => { view = 'week'; referenceDate = todayStr(); }}
				class="px-3 py-1.5 transition-colors"
				style="background-color: {view === 'week' ? 'var(--color-primary)' : 'transparent'}; color: {view === 'week' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
			>{t.mood_week_view}</button>
			<button
				onclick={() => { view = 'month'; referenceDate = todayStr(); }}
				class="px-3 py-1.5 transition-colors"
				style="background-color: {view === 'month' ? 'var(--color-primary)' : 'transparent'}; color: {view === 'month' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
			>{t.mood_month_view}</button>
		</div>
		<div class="flex-1 flex items-center justify-end gap-2">
			{@render navButtons()}
		</div>
	</div>
{/snippet}

{#snippet calendarContent()}
	{#if view === 'week'}
		{@const days = weekDays()}
		{@const today = todayStr()}
		<div class="flex gap-1">
			{#each days as dateStr}
				{@const entry = logMap.get(dateStr)}
				{@const level = entry ? getMoodLevel(entry.mood) : null}
				{@const isFuture = dateStr > today}
				<button
					onclick={() => !isFuture && openDetail(dateStr)}
					disabled={isFuture}
					class="flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all active:opacity-60 disabled:cursor-default"
					style="background-color: {dateStr === today ? 'var(--color-surface-container)' : 'transparent'}"
				>
					<span class="text-[9px] font-semibold uppercase" style="color: var(--color-on-surface-variant)">{dayOfWeekShort(dateStr)}</span>
					<div
						class="w-9 h-9 rounded-full flex items-center justify-center"
						style="background-color: transparent; color: {level ? level.color : 'var(--color-on-surface-variant)'}; opacity: {isFuture ? 0.3 : 1}"
					>
						{#if level}
							<MoodIcon value={level.value} size={22}/>
						{:else if !isFuture}
							<span style="font-size: 10px">–</span>
						{/if}
					</div>
					<span class="text-[9px]" style="color: {dateStr === today ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}">{dayNum(dateStr)}</span>
				</button>
			{/each}
		</div>
	{:else}
		{@const cells = monthDays()}
		{@const today = todayStr()}
		<div class="grid grid-cols-7 gap-0.5">
			{#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as day}
				<div class="text-center text-[9px] font-semibold pb-1" style="color: var(--color-on-surface-variant)">{day}</div>
			{/each}
			{#each cells as dateStr}
				{#if dateStr === null}
					<div></div>
				{:else}
					{@const entry = logMap.get(dateStr)}
					{@const level = entry ? getMoodLevel(entry.mood) : null}
					{@const isFuture = dateStr > today}
					<button
						onclick={() => !isFuture && openDetail(dateStr)}
						disabled={isFuture}
						class="flex flex-col items-center gap-0.5 py-1.5 rounded-xl transition-all active:opacity-60 disabled:cursor-default"
						style="background-color: {dateStr === today ? 'var(--color-surface-container)' : 'transparent'}"
					>
						<div
							class="w-7 h-7 rounded-full flex items-center justify-center"
							style="color: {level ? level.color : 'var(--color-on-surface-variant)'}; opacity: {isFuture ? 0.3 : 1}"
						>
							{#if level}
								<MoodIcon value={level.value} size={20}/>
							{:else if !isFuture}
								<span style="font-size: 10px">–</span>
							{/if}
						</div>
						<span class="text-[9px]" style="color: {dateStr === today ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}; opacity: {isFuture ? 0.3 : 1}">{dayNum(dateStr)}</span>
					</button>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}

{#snippet summaryBar()}
	{#if logs.length > 0}
		<div class="flex flex-wrap gap-x-3 gap-y-1 pt-1">
			{#each MOOD_LEVELS.slice().reverse() as level}
				{@const count = moodCounts.get(level.value) ?? 0}
				{#if count > 0}
					<span class="text-xs font-medium flex items-center gap-1" style="color: {level.color}">
						<MoodIcon value={level.value} size={13}/>
						<span>{count}×</span>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
{/snippet}

<MoodDayDetailSheet
	bind:open={detailOpen}
	entry={detailEntry}
	onsaved={() => { detailOpen = false; load(); onreload(); }}
	ondeleted={() => { detailOpen = false; load(); onreload(); }}
/>

<MoodEntrySheet
	bind:open={newEntryOpen}
	date={newEntryDate}
	onsaved={() => { newEntryOpen = false; load(); onreload(); }}
/>
