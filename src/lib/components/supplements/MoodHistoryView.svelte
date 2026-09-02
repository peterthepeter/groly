<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { toLocalDateKey, todayKey } from '$lib/dates';
	import { getMoodLevel, MOOD_LEVELS, findTag } from '$lib/mood';
	import MoodDayDetailSheet from './MoodDayDetailSheet.svelte';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';
	import MoodWeeklyReview from './MoodWeeklyReview.svelte';

	type MoodLogEntry = {
		id: string;
		date: string;
		mood: number;
		energy: number | null;
		activities: string | null;
		note: string | null;
		gratitude: string | null;
	};

	let {
		onreload,
		fixedView = null as 'today' | 'week' | 'month' | null,
		parentDate = null as string | null,
		hasDayEntry = $bindable(false)
	}: {
		onreload: () => void;
		fixedView?: 'today' | 'week' | 'month' | null;
		parentDate?: string | null;
		hasDayEntry?: boolean;
	} = $props();

	type View = 'week' | 'month';
	let view = $state<View>('week');
	let referenceDate = $state(todayKey());
	let logs = $state<MoodLogEntry[]>([]);
	let loading = $state(false);
	let detailEntry = $state<{ date: string; mood: number; energy: number | null; activities: string[]; note: string | null; gratitude: string | null } | null>(null);
	let detailOpen = $state(false);
	// History-view: inline preview of tap-selected day (avoids sheet for every tap)
	let previewedDate = $state<string | null>(null);
	let previewEditOpen = $state(false);
	let previewConfirmDelete = $state(false);
	let previewDeleting = $state(false);
	// Reset preview when user navigates to a different week/month
	$effect(() => {
		void referenceDate;
		void view;
		previewedDate = null;
		previewConfirmDelete = false;
	});

	async function deletePreviewedEntry() {
		if (!previewedDate || previewDeleting) return;
		previewDeleting = true;
		try {
			const res = await fetch(`/api/mood-logs/${previewedDate}`, { method: 'DELETE' });
			if (res.ok) {
				previewedDate = null;
				previewConfirmDelete = false;
				await load();
				onreload();
			}
		} finally {
			previewDeleting = false;
		}
	}
	let newEntryDate = $state('');
	let newEntryOpen = $state(false);
	let expanded = $state(true);
	let dayCardExpanded = $state(true);

	// Sync view and date from parent when in fixed mode
	$effect(() => {
		if (fixedView === 'today') { if (parentDate) referenceDate = parentDate; }
		else if (fixedView === 'week') { view = 'week'; if (parentDate) referenceDate = parentDate; }
		else if (fixedView === 'month') { view = 'month'; if (parentDate) referenceDate = parentDate; }
	});

	const todayStr = todayKey;

	function parseLogs(raw: MoodLogEntry[]): Map<string, { mood: number; energy: number | null; activities: string[]; note: string | null; gratitude: string | null }> {
		const map = new Map<string, { mood: number; energy: number | null; activities: string[]; note: string | null; gratitude: string | null }>();
		for (const l of raw) {
			let acts: string[] = [];
			try { acts = l.activities ? JSON.parse(l.activities) : []; } catch {}
			map.set(l.date, { mood: l.mood, energy: l.energy ?? null, activities: acts, note: l.note, gratitude: l.gratitude });
		}
		return map;
	}

	const logMap = $derived(parseLogs(logs));

	// Sync hasDayEntry for the viewed date (used by parent to decide if empty-state should render)
	$effect(() => {
		if (fixedView === 'today') {
			const d = parentDate ?? todayStr();
			hasDayEntry = logMap.has(d);
		} else {
			hasDayEntry = logs.length > 0;
		}
	});

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
			return toLocalDateKey(d);
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
		referenceDate = toLocalDateKey(d);
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

	// History-view tap: toggle inline preview for days with entries; for empty days, fall back to add-sheet
	function handleHistoryDayTap(dateStr: string) {
		const entry = logMap.get(dateStr);
		if (entry) {
			previewedDate = previewedDate === dateStr ? null : dateStr;
		} else {
			openDetail(dateStr);
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

	// Average mood + trend (first half vs second half), for fixed week/month view header
	const moodSummary = $derived.by(() => {
		if (logs.length === 0) return null;
		const moods = logs.map(l => l.mood);
		const avg = moods.reduce((s, v) => s + v, 0) / moods.length;
		// Trend: sort by date, split in half
		const sorted = logs.slice().sort((a, b) => a.date.localeCompare(b.date));
		let trend: 'up' | 'down' | 'flat' = 'flat';
		if (sorted.length >= 6) {
			const mid = Math.floor(sorted.length / 2);
			const a = sorted.slice(0, mid);
			const b = sorted.slice(mid);
			const aAvg = a.reduce((s, l) => s + l.mood, 0) / a.length;
			const bAvg = b.reduce((s, l) => s + l.mood, 0) / b.length;
			const delta = bAvg - aAvg;
			if (delta > 0.3) trend = 'up';
			else if (delta < -0.3) trend = 'down';
		}
		return { avg, trend, count: logs.length };
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
<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
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
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			<div class="w-full flex items-center gap-2 px-4 py-3">
				<button
					onclick={() => dayCardExpanded = !dayCardExpanded}
					class="flex items-center gap-2 flex-1 min-w-0 active:opacity-60 text-left"
					aria-label={dayCardExpanded ? 'Einklappen' : 'Aufklappen'}
				>
					<span class="rounded-full shrink-0" style="width: 6px; height: 6px; background-color: #F472B6"></span>
					<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{t.mood_tracker_label}</p>
				</button>
				<span class="flex items-center gap-1.5 text-xs font-semibold shrink-0" style="color: {level.color}">
					<MoodIcon value={level.value} size={15}/>
					<span>{(t[level.labelKey as keyof typeof t] as string) ?? ''}</span>
				</span>
				<span class="text-[11px] font-semibold shrink-0" style="color:var(--color-on-surface-variant)">{t.mood_energy_short} {dayEntry.energy ?? '–'}/5</span>
				<button
					onclick={() => { previewedDate = viewedDate; previewEditOpen = true; }}
					class="shrink-0 p-1 rounded active:opacity-50"
					aria-label="Bearbeiten"
					style="color: var(--color-on-surface-variant)"
				>
					<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
				</button>
				<button
					onclick={() => dayCardExpanded = !dayCardExpanded}
					class="shrink-0 active:opacity-60"
					aria-label={dayCardExpanded ? 'Einklappen' : 'Aufklappen'}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({dayCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</button>
			</div>
			{#if dayCardExpanded && (dayEntry.activities.length > 0 || dayEntry.note || dayEntry.gratitude)}
				<div class="px-4 pb-3 space-y-2">
					{#if dayEntry.activities.length > 0}
						<div class="flex flex-wrap gap-1">
							{#each dayEntry.activities as key}
								<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style="background-color: color-mix(in srgb, #F472B6 12%, transparent); color: var(--color-on-surface)">
									<ActivityIcon icon={findTag(key)?.icon ?? ''} size={11} color="#F472B6" />{getTagLabel(key)}
								</span>
							{/each}
						</div>
					{/if}
					{#if dayEntry.gratitude}
						<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{dayEntry.gratitude}</p>
					{/if}
					{#if dayEntry.note}
						<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{dayEntry.note}</p>
					{/if}
				</div>
			{/if}
		</div>
	{/if}

<!-- ── Fixed week/month (History week/month view): no toggle, no own nav ── -->
{:else if logs.length > 0}
<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
	<button
		onclick={() => expanded = !expanded}
		class="w-full flex items-center gap-2 px-4 py-3 active:opacity-70"
		style=""
	>
		<div class="flex items-center gap-2 shrink-0">
			<span class="rounded-full" style="width: 6px; height: 6px; background-color: #F472B6"></span>
			<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{t.mood_tracker_label}</p>
		</div>
		<div class="flex-1 flex items-center flex-wrap gap-x-2 gap-y-0.5">
			{#each MOOD_LEVELS.slice().reverse() as level}
				{@const count = moodCounts.get(level.value) ?? 0}
				{#if count > 0}
					<span class="text-xs font-medium flex items-center gap-0.5" style="color: var(--color-on-surface-variant)">
						<MoodIcon value={level.value} size={13}/>
						<span>{count}×</span>
					</span>
				{/if}
			{/each}
		</div>
		{#if moodSummary}
			{@const avgLevel = getMoodLevel(Math.round(moodSummary.avg))}
			<div class="flex items-center gap-1 shrink-0 text-xs font-semibold tabular-nums" style="color: {avgLevel.color}">
				<span>Ø {moodSummary.avg.toFixed(1)}<span style="opacity: 0.6">/5</span></span>
				{#if moodSummary.trend === 'up'}
					<svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="5,1 9,8 1,8"/></svg>
				{:else if moodSummary.trend === 'down'}
					<svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor"><polygon points="1,2 9,2 5,9"/></svg>
				{/if}
			</div>
		{/if}
		<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
			stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
			style="color: var(--color-on-surface-variant); transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg); flex-shrink: 0">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>
	{#if expanded}
		<div class="px-4 pb-4 pt-3">
			{@render calendarContent()}
			{#if fixedView === 'week'}
				{@const range = getDateRange()}
				<MoodWeeklyReview {logs} from={range.from} to={range.to} />
			{/if}
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
		<div class="flex rounded-xl overflow-hidden text-xs font-semibold shrink-0" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
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
	{#if previewedDate}
		{@const pEntry = logMap.get(previewedDate)}
		{#if pEntry}
			{@const pLevel = getMoodLevel(pEntry.mood)}
			{@const pLabel = (t[pLevel.labelKey as keyof typeof t] as string | undefined) ?? ''}
			<div class="mb-3 rounded-xl p-3 space-y-2" style="background-color: color-mix(in srgb, {pLevel.color} 8%, var(--color-surface-container)); border: 1px solid color-mix(in srgb, {pLevel.color} 18%, transparent)">
				<!-- Header: smiley + date + label + edit/delete icon buttons -->
				<div class="flex items-center gap-3">
					<div class="shrink-0" style="color: {pLevel.color}">
						<MoodIcon value={pLevel.value} size={24}/>
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-[11px] font-medium tabular-nums" style="color: var(--color-on-surface-variant)">
							{new Date(previewedDate + 'T12:00:00').toLocaleDateString(currentLang() === 'en' ? 'en-US' : 'de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}
						</div>
					<div class="text-sm font-bold truncate" style="color: {pLevel.color}">{pLabel}</div>
					<div class="text-[11px] font-semibold" style="color:var(--color-on-surface-variant)">{t.mood_energy_short}: {pEntry.energy ?? '–'}/5</div>
					</div>
					{#if previewConfirmDelete}
						<div class="shrink-0 flex items-center gap-1">
							<button onclick={() => previewConfirmDelete = false}
								class="text-[11px] font-semibold px-2 py-1 rounded-md active:opacity-60"
								style="color: var(--color-on-surface-variant)">{t.close}</button>
							<button onclick={deletePreviewedEntry} disabled={previewDeleting}
								aria-label={t.mood_delete}
								class="w-7 h-7 rounded-md flex items-center justify-center active:opacity-60 disabled:opacity-40"
								style="background-color: rgba(239,68,68,0.18); color: #EF4444">
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
							</button>
						</div>
					{:else}
						<div class="shrink-0 flex items-center gap-1">
							<button onclick={() => previewEditOpen = true}
								aria-label={t.mood_edit}
								class="w-7 h-7 rounded-md flex items-center justify-center active:opacity-60"
								style="color: var(--color-on-surface-variant)">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
							</button>
							<button onclick={() => previewConfirmDelete = true}
								aria-label={t.mood_delete}
								class="w-7 h-7 rounded-md flex items-center justify-center active:opacity-60"
								style="color: var(--color-on-surface-variant)">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>
							</button>
						</div>
					{/if}
				</div>

				<!-- Activities/tags -->
				{#if pEntry.activities.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each pEntry.activities as key}
							<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium" style="background-color: color-mix(in srgb, {pLevel.color} 10%, transparent); color: var(--color-on-surface)">
								<ActivityIcon icon={findTag(key)?.icon ?? ''} size={10} color="var(--color-on-surface-variant)" />{getTagLabel(key)}
							</span>
						{/each}
					</div>
				{/if}

				<!-- Gratitude -->
				{#if pEntry.gratitude}
					<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{pEntry.gratitude}</p>
				{/if}

				<!-- Note -->
				{#if pEntry.note}
					<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{pEntry.note}</p>
				{/if}
			</div>
		{/if}
	{/if}
	{#if view === 'week'}
		{@const days = weekDays()}
		{@const today = todayStr()}
		<!-- Header: day labels (Mo Di Mi…) -->
		<div class="flex mb-2">
			{#each days as dateStr}
				<span class="flex-1 text-center text-[9px] uppercase tabular-nums" style="color: {dateStr === today ? '#F472B6' : 'var(--color-on-surface-variant)'}; font-weight: {dateStr === today ? '700' : '500'}">{dayOfWeekShort(dateStr)}</span>
			{/each}
		</div>
		<!-- Strip: one pill per day, mood-colored if entry exists -->
		<div class="flex items-center gap-[3px]" style="height: 22px">
			{#each days as dateStr}
				{@const entry = logMap.get(dateStr)}
				{@const level = entry ? getMoodLevel(entry.mood) : null}
				{@const isFuture = dateStr > today}
				{@const isToday = dateStr === today}
				{@const outline = isToday ? 'outline: 1.5px solid color-mix(in srgb, #F472B6 60%, transparent); outline-offset: 1px' : ''}
				<button
					onclick={() => !isFuture && handleHistoryDayTap(dateStr)}
					disabled={isFuture}
					aria-label={dateStr}
					class="flex-1 active:opacity-70 disabled:cursor-default"
					style="height: 100%; background-color: {level ? level.color : 'var(--color-surface-container)'}; opacity: {isFuture ? 0.3 : level ? 1 : 0.5}; border-radius: 3px; {previewedDate === dateStr ? 'outline: 2px solid #F472B6; outline-offset: 2px' : outline}"
				></button>
			{/each}
		</div>
		<!-- Day numbers below -->
		<div class="flex mt-1">
			{#each days as dateStr}
				<span class="flex-1 text-center text-[9px] tabular-nums" style="color: {dateStr === today ? '#F472B6' : 'var(--color-on-surface-variant)'}; font-weight: {dateStr === today ? '700' : '500'}">{dayNum(dateStr)}</span>
			{/each}
		</div>
	{:else}
		{@const cells = monthDays()}
		{@const today = todayStr()}
		<!-- Month: pill-style cells in 7-col grid, mirrors Week strip layout -->
		<div class="grid grid-cols-7 gap-x-[3px] gap-y-3">
			{#each ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'] as day}
				<div class="text-center text-[9px] font-semibold uppercase pb-0.5" style="color: var(--color-on-surface-variant)">{day}</div>
			{/each}
			{#each cells as dateStr}
				{#if dateStr === null}
					<div></div>
				{:else}
					{@const entry = logMap.get(dateStr)}
					{@const level = entry ? getMoodLevel(entry.mood) : null}
					{@const isFuture = dateStr > today}
					{@const isToday = dateStr === today}
					{@const outline = isToday ? 'outline: 1.5px solid color-mix(in srgb, #F472B6 60%, transparent); outline-offset: 1px' : ''}
					<button
						onclick={() => !isFuture && handleHistoryDayTap(dateStr)}
						disabled={isFuture}
						class="flex flex-col items-center gap-1 active:opacity-60 disabled:cursor-default"
					>
						<span class="text-[9px] leading-none tabular-nums" style="color: {isToday ? '#F472B6' : 'var(--color-on-surface-variant)'}; opacity: {isFuture ? 0.3 : 1}; font-weight: {isToday ? '700' : '400'}">{dayNum(dateStr)}</span>
						<div class="w-full" style="height: 14px; background-color: {level ? level.color : 'var(--color-surface-container)'}; opacity: {isFuture ? 0.25 : level ? 1 : 0.5}; border-radius: 3px; {previewedDate === dateStr ? 'outline: 2px solid #F472B6; outline-offset: 2px' : outline}"></div>
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

{#if previewedDate}
	{@const pEntry = logMap.get(previewedDate)}
	<MoodEntrySheet
		bind:open={previewEditOpen}
		date={previewedDate}
		initialMood={pEntry?.mood ?? null}
		initialEnergy={pEntry?.energy ?? null}
		initialActivities={pEntry?.activities ?? []}
		initialNote={pEntry?.note ?? ''}
		initialGratitude={pEntry?.gratitude ?? ''}
		onsaved={() => { previewEditOpen = false; load(); onreload(); }}
	/>
{/if}
