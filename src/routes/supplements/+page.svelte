<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t, nutrients_show_more, today_reminders_label } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import QuickLogSheet from '$lib/components/supplements/QuickLogSheet.svelte';
	import EditLogSheet from '$lib/components/supplements/EditLogSheet.svelte';

	let { data } = $props();

	type Nutrient = { id: string; name: string; amountPerUnit: number; unit: string; sortOrder: number };
	type Supplement = {
		id: string; name: string; unit: string; notes: string | null;
		active: boolean; sortOrder: number;
		stockQuantity: number | null; defaultAmount: number;
		nutrients: Nutrient[];
	};
	type Log = { id: string; supplementId: string; amount: number; loggedAt: number };
	type NutrientStat = { total: number; unit: string; name: string };
	type SupplementStat = { name: string; unit: string; total: number };

	let menuOpen = $state(false);
	let supplements = $state<Supplement[]>([]);
	let todayLogs = $state<Log[]>([]);
	let loading = $state(true);
	const activeTab = $derived($page.url.searchParams.get('tab') === 'history' ? 'history' : 'today');

	function toLocalDateStr(d: Date): string {
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	// History state
	let scrollContainer = $state<HTMLElement | null>(null);
	let historyPeriod = $state<'day' | 'week' | 'month'>('day');
	let historyDate = $state(toLocalDateStr(new Date()));
	let historyNutrients = $state<Record<string, NutrientStat>>({});
	let historySupplements = $state<Record<string, SupplementStat>>({});
	let historyLoading = $state(false);

	// Expand/collapse per supplement card
	let expandedIds = $state(new Set<string>());

	function toggleExpand(id: string) {
		const next = new Set(expandedIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedIds = next;
	}

	// Today's reminders (for header row)
	type TodayReminder = { time: string; names: string[] };
	let todayReminders = $state<TodayReminder[]>([]);
	let remindersExpanded = $state(false);
	let now = $state(new Date());

	function currentTimeStr(): string {
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	}

	const pendingReminders = $derived(todayReminders.filter(r => r.time > currentTimeStr()));

	async function loadTodayReminders() {
		const res = await fetch('/api/supplement-reminders?today=1');
		if (res.ok) {
			const data = await res.json();
			todayReminders = data.todayReminders ?? [];
		}
	}

	// Quick-log sheet (opened from FAB)
	let quickLogOpen = $state(false);

	function openQuickLog() {
		quickLogOpen = true;
	}

	function allLogTimes(supplementId: string): string {
		const logs = logsForSupplement(supplementId);
		if (logs.length === 0) return '';
		const times = logs
			.slice()
			.sort((a, b) => a.loggedAt - b.loggedAt)
			.map(l => formatTime(l.loggedAt))
			.join(', ');
		return `(${times})`;
	}

	const activeSupplements = $derived(supplements.filter(s => s.active));
	const loggedTodaySupplements = $derived(activeSupplements.filter(s => logsForSupplement(s.id).length > 0));

	function todayStart(): number {
		const d = new Date();
		d.setHours(0, 0, 0, 0);
		return d.getTime();
	}

	function todayEnd(): number {
		return todayStart() + 86_400_000 - 1;
	}

	function logsForSupplement(supplementId: string): Log[] {
		return todayLogs.filter(l => l.supplementId === supplementId);
	}

	function totalTodayAmount(supplementId: string): number {
		return logsForSupplement(supplementId).reduce((sum, l) => sum + l.amount, 0);
	}

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatNutrientValue(val: number): string {
		if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + ' g';
		if (val % 1 === 0) return val.toString();
		return val.toFixed(1);
	}

	async function loadSupplements() {
		const res = await fetch('/api/supplements');
		if (res.ok) {
			const data = await res.json();
			supplements = data.supplements;
		}
	}

	async function loadTodayLogs() {
		const from = todayStart();
		const to = todayEnd();
		const res = await fetch(`/api/supplement-logs?from=${from}&to=${to}`);
		if (res.ok) {
			const data = await res.json();
			todayLogs = data.logs;
		}
	}

	async function loadHistory() {
		historyLoading = true;
		const res = await fetch(`/api/supplement-stats?period=${historyPeriod}&date=${historyDate}`);
		if (res.ok) {
			const data = await res.json();
			historyNutrients = data.nutrients ?? {};
			historySupplements = data.supplements ?? {};
		}
		historyLoading = false;
	}

	async function deleteLog(logId: string) {
		const res = await fetch(`/api/supplement-logs/${logId}`, { method: 'DELETE' });
		if (res.ok) await Promise.all([loadTodayLogs(), loadSupplements()]);
	}

	// ─── Edit log sheet ─────────────────────────────────────────────────────────

	type EditLogSheetType = { id: string; supplementName: string; unit: string; amount: number; time: string };
	let editLogSheet = $state<EditLogSheetType | null>(null);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressStart = { x: 0, y: 0 };

	function openEditLog(log: Log, supplement: Supplement) {
		const d = new Date(log.loggedAt);
		editLogSheet = {
			id: log.id,
			supplementName: supplement.name,
			unit: supplement.unit,
			amount: log.amount,
			time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
		};
	}

	function startPress(e: PointerEvent, log: Log, supplement: Supplement) {
		e.preventDefault();
		pressStart = { x: e.clientX, y: e.clientY };
		pressTimer = setTimeout(() => {
			pressTimer = null;
			openEditLog(log, supplement);
		}, 500);
	}

	function cancelPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	function movePress(e: PointerEvent) {
		if (!pressTimer) return;
		if (Math.abs(e.clientX - pressStart.x) > 8 || Math.abs(e.clientY - pressStart.y) > 8) cancelPress();
	}

	$effect(() => {
		if (activeTab === 'history') {
			loadHistory();
		}
	});

	$effect(() => {
		// re-load history when period/date changes
		void historyPeriod;
		void historyDate;
		if (activeTab === 'history') loadHistory();
	});

	beforeNavigate(({ type, cancel }) => {
		if (type === 'popstate') {
			// Back/swipe: close one sheet at a time instead of navigating
			if (editLogSheet) { editLogSheet = null; cancel(); return; }
			if (quickLogOpen) { quickLogOpen = false; cancel(); return; }
		} else {
			// Forward navigation: close everything silently
			quickLogOpen = false;
			editLogSheet = null;
		}
	});

	onMount(async () => {
		await Promise.all([loadSupplements(), loadTodayLogs(), loadTodayReminders()]);
		loading = false;
		const clockInterval = setInterval(() => { now = new Date(); }, 60_000);
		return () => clearInterval(clockInterval);
	});

	function navigateHistory(dir: -1 | 1) {
		const d = new Date(historyDate + 'T00:00:00');
		if (historyPeriod === 'day') d.setDate(d.getDate() + dir);
		else if (historyPeriod === 'week') d.setDate(d.getDate() + dir * 7);
		else d.setMonth(d.getMonth() + dir);
		historyDate = toLocalDateStr(d);
	}

	function formatPeriodLabel(): string {
		const d = new Date(historyDate + 'T00:00:00');
		if (historyPeriod === 'day') {
			return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });
		}
		if (historyPeriod === 'week') {
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			const monday = new Date(d);
			monday.setDate(d.getDate() + diffToMonday);
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);
			return `${monday.toLocaleDateString([], { day: 'numeric', month: 'short' })} – ${sunday.toLocaleDateString([], { day: 'numeric', month: 'short' })}`;
		}
		return d.toLocaleDateString([], { month: 'long', year: 'numeric' });
	}

	const NUTRIENTS_VISIBLE = 10;
	let nutrientsExpanded = $state(false);
	let supplementsCardExpanded = $state(true);
	let nutrientsCardExpanded = $state(true);

	const nutrientEntries = $derived(
		Object.entries(historyNutrients).map(([, val]) => ({
			name: val.name,
			unit: val.unit,
			total: val.total
		})).sort((a, b) => b.total - a.total)
	);

	const nutrientEntriesVisible = $derived(nutrientEntries.slice(0, NUTRIENTS_VISIBLE));
	const nutrientEntriesHidden = $derived(nutrientEntries.slice(NUTRIENTS_VISIBLE));

	const supplementStatEntries = $derived(
		Object.values(historySupplements).sort((a, b) => a.name.localeCompare(b.name))
	);
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.supplement_title} onMenuOpen={() => menuOpen = true} />
	<div class="flex-shrink-0" style="height: calc(env(safe-area-inset-top) + 5.5rem)"></div>

	<!-- Tab Bar + Manage row -->
	<div class="flex-shrink-0 px-4 space-y-2 mb-3">
		<div class="flex gap-1 p-1 rounded-2xl" style="background-color: var(--color-surface-container)">
			<button
				onclick={() => goto($page.url.pathname, { noScroll: true, keepFocus: true })}
				class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
				style="background-color: {activeTab === 'today' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'today' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
			>
				{t.supplement_tab_today}
			</button>
			<button
				onclick={() => goto(`${$page.url.pathname}?tab=history`, { noScroll: true, keepFocus: true })}
				class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
				style="background-color: {activeTab === 'history' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
			>
				{t.supplement_tab_history}
			</button>
		</div>
		<!-- Manage row — only visible on Today tab -->
		{#if activeTab === 'today'}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
				<!-- Main row: Verwalten + Erinnerungen -->
				<div class="flex items-center">
					<button
						onclick={() => goto('/supplements/verwalten')}
						class="flex items-center justify-center gap-2 py-2.5 text-sm font-semibold active:opacity-70 transition-opacity {todayReminders.length > 0 ? 'flex-1' : 'w-full'}"
						style="color: var(--color-primary)"
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
						{t.supplement_manage}
					</button>
					{#if todayReminders.length > 0}
						<button
							onclick={() => remindersExpanded = !remindersExpanded}
							class="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium active:opacity-70 transition-opacity"
							style="color: var(--color-on-surface)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
							</svg>
							{today_reminders_label(pendingReminders.length)}
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
							     style="transform: rotate({remindersExpanded ? 90 : 0}deg); transition: transform 0.2s; color: var(--color-on-surface-variant)">
								<polyline points="9 18 15 12 9 6"/>
							</svg>
						</button>
					{/if}
				</div>
				<!-- Expanded reminder list -->
				{#if remindersExpanded && todayReminders.length > 0}
					<div class="px-5 pt-3 pb-3 space-y-1.5" style="border-top: 1px solid var(--color-outline-variant)">
						{#each todayReminders as reminder}
							{@const isPast = reminder.time <= currentTimeStr()}
							<div class="flex items-baseline gap-3" style={isPast ? 'opacity: 0.5' : ''}>
								<span class="text-sm font-semibold tabular-nums shrink-0"
								      style="color: {isPast ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}; {isPast ? 'text-decoration: line-through' : ''}"
								>{reminder.time}</span>
								<span class="text-sm" style="color: {isPast ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)'}; {isPast ? 'text-decoration: line-through' : ''}">{reminder.names.join(' · ')}</span>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<!-- History controls (outside scroll, pinned below tab bar) -->
	{#if activeTab === 'history'}
		<div class="flex-shrink-0 px-4 space-y-3 mb-3">
			<!-- Period selector -->
			<div class="flex gap-1 p-1 rounded-2xl" style="background-color: var(--color-surface-container)">
				{#each (['day', 'week', 'month'] as const) as period}
					<button
						onclick={() => { historyPeriod = period; if (period !== 'day') scrollContainer?.scrollTo({ top: 0 }); }}
						class="flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all"
						style="background-color: {historyPeriod === period ? 'var(--color-surface-card)' : 'transparent'}; color: {historyPeriod === period ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
					>
						{period === 'day' ? t.supplement_stats_day : period === 'week' ? t.supplement_stats_week : t.supplement_stats_month}
					</button>
				{/each}
			</div>
			<!-- Date navigation -->
			<div class="flex items-center justify-between">
				<button
					onclick={() => navigateHistory(-1)}
					class="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
					style="background-color: var(--color-surface-container)"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="15 18 9 12 15 6"/>
					</svg>
				</button>
				<span class="text-sm font-semibold" style="color: var(--color-on-surface)">{formatPeriodLabel()}</span>
				<button
					onclick={() => navigateHistory(1)}
					class="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
					style="background-color: var(--color-surface-container)"
				>
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</button>
			</div>
		</div>
	{/if}

	<div bind:this={scrollContainer}
	     class="flex-1 min-h-0 overflow-y-auto {activeTab === 'today' ? 'flex flex-col justify-end' : ''}"
	     style="padding-bottom: 5rem">

	{#if loading}
		<div class="flex justify-center py-16">
			<div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if activeTab === 'today'}
		<!-- TODAY TAB -->
		{#if supplements.length === 0}
			<div class="flex flex-col items-center text-center px-4 py-16">
				<div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
				     style="background-color: var(--color-surface-container)">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
						<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
					</svg>
				</div>
				<p class="text-sm font-semibold mb-1" style="color: var(--color-on-surface)">{t.supplement_empty}</p>
				<p class="text-xs mb-4" style="color: var(--color-on-surface-variant)">{t.supplement_empty_hint}</p>
				<button
					onclick={() => goto('/supplements/verwalten')}
					class="px-6 py-3 rounded-2xl text-sm font-semibold active:opacity-80 transition-opacity mb-3"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{t.supplement_manage}
				</button>
				<button
					onclick={() => goto('/einstellungen')}
					class="text-xs active:opacity-60 transition-opacity"
					style="color: var(--color-primary)"
				>{t.disable_hint_supplements}</button>
			</div>
		{:else if activeSupplements.length === 0}
			<div class="flex flex-col items-center text-center px-4 py-16">
				<div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
				     style="background-color: var(--color-surface-container)">
					<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
						<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
					</svg>
				</div>
				<p class="text-sm font-semibold mb-1" style="color: var(--color-on-surface)">{t.supplement_empty}</p>
				<p class="text-xs mb-4" style="color: var(--color-on-surface-variant)">{t.supplement_today_none_active}</p>
				<button
					onclick={() => goto('/supplements/verwalten')}
					class="px-6 py-3 rounded-2xl text-sm font-semibold active:opacity-80"
					style="background-color: var(--color-surface-container); color: var(--color-primary)"
				>
					{t.supplement_manage}
				</button>
			</div>
		{:else if loggedTodaySupplements.length === 0}
			<div class="px-4 py-16 text-center">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_today_empty}</p>
			</div>
		{:else}
			<div class="px-4 flex flex-col gap-3">
				{#each loggedTodaySupplements as supplement (supplement.id)}
					{@const logs = logsForSupplement(supplement.id)}
					{@const total = totalTodayAmount(supplement.id)}
					{@const expanded = expandedIds.has(supplement.id)}
					{@const logTimes = allLogTimes(supplement.id)}
					<div class="rounded-2xl px-4 pt-3 pb-4 flex flex-col min-h-[72px] justify-center select-none" style="background-color: var(--color-surface-card)">

						<!-- Expanded content FIRST in DOM → expands upward visually -->
						{#if expanded}
							<div class="mb-3 pb-3 border-b space-y-1.5" style="border-color: var(--color-outline-variant)">
								{#each logs as log (log.id)}
									<div class="flex items-center justify-between text-xs">
										<button
											onpointerdown={(e) => startPress(e, log, supplement)}
											onpointermove={movePress}
											onpointerup={cancelPress}
											onpointercancel={cancelPress}
											class="flex-1 text-left py-0.5 active:opacity-60"
											style="color: var(--color-on-surface-variant)"
										><span style="color: var(--color-primary)">{log.amount} {supplement.unit}</span> {t.supplement_log_at} {formatTime(log.loggedAt)}</button>
										<button
											onclick={() => openEditLog(log, supplement)}
											class="p-1 rounded active:opacity-50 shrink-0"
											aria-label="Bearbeiten"
											style="color: var(--color-on-surface-variant)"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
												<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
											</svg>
										</button>
										<button
											onclick={() => deleteLog(log.id)}
											class="p-1 rounded active:opacity-50 shrink-0"
											aria-label={t.supplement_log_delete}
											style="color: var(--color-on-surface-variant)"
										>
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
											</svg>
										</button>
									</div>
								{/each}
								{#if supplement.nutrients.length > 0 && total > 0}
									<div class="mt-1.5 flex flex-wrap gap-1.5">
										{#each supplement.nutrients as n}
											<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
												{n.name}: {formatNutrientValue(n.amountPerUnit * total)} {n.unit}
											</span>
										{/each}
									</div>
								{/if}
							</div>
						{/if}

						<!-- Header row — long-press on info area opens edit for most recent log -->
						<div class="flex items-center justify-between gap-3">
							<button
								class="flex-1 min-w-0 text-left active:opacity-70"
								onpointerdown={(e) => startPress(e, logs.reduce((a, b) => a.loggedAt > b.loggedAt ? a : b), supplement)}
								onpointermove={movePress}
								onpointerup={cancelPress}
								onpointercancel={cancelPress}
							>
								<div class="flex items-baseline gap-1.5 flex-wrap">
									<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{supplement.name}</p>
									{#if supplement.stockQuantity != null}
										<span class="text-xs font-medium" style="color: {supplement.stockQuantity <= 5 ? 'var(--color-error)' : 'var(--color-on-surface-variant)'}">({supplement.stockQuantity} {t.supplement_stock_left})</span>
									{/if}
								</div>
								{#if total > 0}
									<p class="text-xs mt-0.5" style="color: var(--color-primary)">
										{total} {supplement.unit} {t.supplement_taken_today}{logTimes ? ` ${logTimes}` : ''}
									</p>
								{/if}
							</button>
							{#if logs.length > 0 || (supplement.nutrients.length > 0 && total > 0)}
								<button
									onclick={() => toggleExpand(supplement.id)}
									class="shrink-0 w-9 h-9 flex items-center justify-center active:opacity-60"
									style="color: var(--color-on-surface-variant)"
									aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
									     style="transition: transform 0.2s; transform: rotate({expanded ? '-90' : '0'}deg)">
										<polyline points="9 6 15 12 9 18"/>
									</svg>
								</button>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		{/if}

	{:else}
		<!-- HISTORY TAB -->
		<div class="px-4 space-y-4">
			{#if historyLoading}
				<div class="flex justify-center py-8">
					<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
				</div>
			{:else if nutrientEntries.length === 0 && supplementStatEntries.length === 0}
				<div class="py-12 text-center">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_stats_empty}</p>
				</div>
			{:else}
				<!-- Supplements taken -->
				{#if supplementStatEntries.length > 0}
					<div class="rounded-2xl px-4 py-3" style="background-color: var(--color-surface-card)">
						<button
							onclick={() => supplementsCardExpanded = !supplementsCardExpanded}
							class="w-full flex items-center justify-between mb-2 active:opacity-60"
						>
							<p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-primary)">Supplements</p>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
							     style="transition: transform 0.2s; transform: rotate({supplementsCardExpanded ? '-90' : '90'}deg)">
								<polyline points="9 6 15 12 9 18"/>
							</svg>
						</button>
						{#if supplementsCardExpanded}
							<div class="space-y-1.5">
								{#each supplementStatEntries as sup}
									<div class="flex justify-between items-center text-sm">
										<span style="color: var(--color-on-surface)">{sup.name}</span>
										<span class="font-semibold" style="color: var(--color-primary)">{sup.total} {sup.unit}</span>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/if}

				<!-- Nutrients -->
				{#if nutrientEntries.length > 0}
					<div class="rounded-2xl px-4 py-3" style="background-color: var(--color-surface-card)">
						<button
							onclick={() => nutrientsCardExpanded = !nutrientsCardExpanded}
							class="w-full flex items-center justify-between mb-2 active:opacity-60"
						>
							<p class="text-xs font-semibold uppercase tracking-wider" style="color: var(--color-primary)">{t.supplement_stats_nutrients}</p>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
							     style="transition: transform 0.2s; transform: rotate({nutrientsCardExpanded ? '-90' : '90'}deg)">
								<polyline points="9 6 15 12 9 18"/>
							</svg>
						</button>
						{#if nutrientsCardExpanded}
							<div class="space-y-1.5">
								{#each nutrientEntriesVisible as entry}
									<div class="flex justify-between items-center text-sm">
										<span style="color: var(--color-on-surface)">{entry.name}</span>
										<span class="font-semibold" style="color: var(--color-primary)">{formatNutrientValue(entry.total)} {entry.unit}</span>
									</div>
								{/each}
								{#if nutrientsExpanded}
									{#each nutrientEntriesHidden as entry}
										<div class="flex justify-between items-center text-sm">
											<span style="color: var(--color-on-surface)">{entry.name}</span>
											<span class="font-semibold" style="color: var(--color-primary)">{formatNutrientValue(entry.total)} {entry.unit}</span>
										</div>
									{/each}
								{/if}
							</div>
							{#if nutrientEntriesHidden.length > 0}
								<button
									onclick={() => nutrientsExpanded = !nutrientsExpanded}
									class="mt-3 w-full text-xs font-medium py-1.5 rounded-xl active:opacity-60 transition-opacity"
									style="color: var(--color-on-surface-variant); background-color: var(--color-surface-container)"
								>
									{nutrientsExpanded ? t.supplement_stats_show_less : nutrients_show_more(nutrientEntriesHidden.length)}
								</button>
							{/if}
						{/if}
					</div>
				{/if}
			{/if}
		</div>
	{/if}

	</div><!-- end scrollable -->
</div>

<QuickLogSheet
	bind:open={quickLogOpen}
	supplements={activeSupplements}
	onlogged={() => Promise.all([loadTodayLogs(), loadSupplements()])}
/>

<AppBottomNav
	activeTab="supplements"
	onFabTap={openQuickLog}
	fabLabel={t.add}
/>

<EditLogSheet
	bind:sheet={editLogSheet}
	onreload={() => Promise.all([loadTodayLogs(), loadSupplements()])}
/>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
