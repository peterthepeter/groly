<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t, currentLang, today_reminders_label } from '$lib/i18n.svelte';
	import { cacheSupplements, getOfflineSupplements, cacheTodayLogs, getOfflineTodayLogs, cacheWaterLogs, getOfflineWaterLogsToday, cacheCaffeineLogs, getOfflineCaffeineLogsToday, cacheMeditationLogs, getOfflineMeditationLogsToday, getPendingLogs } from '$lib/sync/manager';
	import { displayUnit } from '$lib/units';
	import { userSettings } from '$lib/userSettings.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import QuickLogSheet from '$lib/components/supplements/QuickLogSheet.svelte';
	import EditLogSheet from '$lib/components/supplements/EditLogSheet.svelte';
	import WaterTrackerCard from '$lib/components/supplements/WaterTrackerCard.svelte';
	import CaffeineTrackerCard from '$lib/components/supplements/CaffeineTrackerCard.svelte';
	import CaffeineDrinkPickerSheet from '$lib/components/supplements/CaffeineDrinkPickerSheet.svelte';
	import MeditationTrackerCard from '$lib/components/supplements/MeditationTrackerCard.svelte';
	import MeditationTimerSheet from '$lib/components/supplements/MeditationTimerSheet.svelte';
	import MoodTrackerCard from '$lib/components/supplements/MoodTrackerCard.svelte';
	import MoodEntrySheet from '$lib/components/supplements/MoodEntrySheet.svelte';
	import HistoryTab from '$lib/components/supplements/HistoryTab.svelte';
	import type { WaterLog, CaffeineLog, CaffeineDrink, MeditationLog } from '$lib/db/schema';

	let { data } = $props();

	type Nutrient = { id: string; name: string; amountPerUnit: number; unit: string; sortOrder: number };
	type Supplement = {
		id: string; name: string; unit: string; notes: string | null;
		brand: string | null;
		active: boolean; sortOrder: number;
		stockQuantity: number | null; defaultAmount: number;
		nutrients: Nutrient[];
	};
	type Log = { id: string; supplementId: string; amount: number; loggedAt: number; note?: string | null };
	type NutrientStat = { total: number; unit: string; name: string };
	type SupplementStat = { name: string; unit: string; total: number };

	let menuOpen = $state(false);
	let supplements = $state<Supplement[]>([]);
	let todayLogs = $state<Log[]>([]);
	let waterLogsToday = $state<WaterLog[]>([]);
	let waterHasReminderToday = $state(false);
	let caffeineLogsToday = $state<CaffeineLog[]>([]);
	let meditationLogsToday = $state<MeditationLog[]>([]);
	let meditationTimerOpen = $state(false);
	let meditationTimerDuration = $state(10);
	type MoodEntry = { date: string; mood: number; activities: string[]; note: string | null };
	let todayMoodEntry = $state<MoodEntry | null>(null);
	let moodEntryOpen = $state(false);

	function startMeditation(minutes: number) {
		meditationTimerDuration = minutes;
		meditationTimerOpen = true;
	}
	const hasVisibleTrackerCards = $derived(
		(userSettings.waterTrackerEnabled && (waterLogsToday.length > 0 || waterHasReminderToday)) ||
		(userSettings.caffeineTrackerEnabled && caffeineLogsToday.length > 0) ||
		(userSettings.meditationTrackerEnabled && meditationLogsToday.length > 0) ||
		(userSettings.moodTrackerEnabled && todayMoodEntry !== null)
	);
	let caffeineDrinks = $state<CaffeineDrink[]>([]);
	const visibleCaffeineDrinks = $derived(
		caffeineDrinks.filter(d => !(userSettings.caffeineHiddenDrinks ?? []).includes(d.id))
	);
	let historyCaffeineLogs = $state<CaffeineLog[]>([]);
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
	let historyLogs = $state<Log[]>([]);
	let historyLoading = $state(false);

	// Expand/collapse per supplement card (today tab)
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
	// Server-persisted overrides: reminderTime → done (true/false)
	let reminderOverrides = $state<Record<string, boolean>>({});
	let now = $state(new Date());

	const REMINDER_PRE_WINDOW_MS = 30 * 60 * 1000; // 30 Minuten

	function todayAtTime(timeStr: string): number {
		const [h, m] = timeStr.split(':').map(Number);
		const d = new Date();
		d.setHours(h, m, 0, 0);
		return d.getTime();
	}

	// Explizit $derived damit todayLogs + supplements als Dependencies getrackt werden
	const reminderDoneMap = $derived.by(() => {
		const map = new Map<string, boolean>();
		for (const reminder of todayReminders) {
			// Server-Override hat Vorrang
			if (reminder.time in reminderOverrides) {
				map.set(reminder.time, reminderOverrides[reminder.time]);
				continue;
			}
			// Auto-Erkennung: Log im 30-Minuten-Fenster vor der Erinnerungszeit
			const reminderTs = todayAtTime(reminder.time);
			const windowStart = reminderTs - REMINDER_PRE_WINDOW_MS;
			const autoDone = reminder.names.every(name => {
				const supp = supplements.find(s => s.name === name);
				if (!supp) return false;
				return todayLogs.some(l => l.supplementId === supp.id && l.loggedAt >= windowStart);
			});
			map.set(reminder.time, autoDone);
		}
		return map;
	});

	function reminderIsDone(reminder: TodayReminder): boolean {
		return reminderDoneMap.get(reminder.time) ?? false;
	}

	async function toggleReminderDone(reminder: TodayReminder) {
		const current = reminderIsDone(reminder);
		const newDone = !current;
		const date = toLocalDateStr(new Date());

		// Optimistic update
		reminderOverrides = { ...reminderOverrides, [reminder.time]: newDone };

		try {
			await fetch('/api/supplement-reminder-overrides', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ date, reminderTime: reminder.time, done: newDone })
			});
		} catch {
			// Bei Fehler: Rollback
			const restored = { ...reminderOverrides };
			delete restored[reminder.time];
			reminderOverrides = restored;
		}
	}

	const pendingReminders = $derived(todayReminders.filter(r => !reminderDoneMap.get(r.time)));

	async function loadTodayReminders() {
		try {
			const res = await fetch('/api/supplement-reminders?today=1');
			if (res.ok) {
				const data = await res.json();
				todayReminders = data.todayReminders ?? [];
				reminderOverrides = data.overrides ?? {};
			}
		} catch { /* offline — reminders bleiben leer */ }
	}

	// Quick-log sheet (opened from FAB)
	let quickLogOpen = $state(false);
	let quickLogInitialTab = $state<'tracker' | 'supplements' | null>(null);
	let caffeinePickerOpen = $state(false);
	let caffeinePickerPreselect = $state<CaffeineDrink | null>(null);

	function openQuickLog() {
		quickLogInitialTab = null;
		quickLogOpen = true;
	}

	// Handle ?action=... query-param triggered by push notifications.
	// Opens the matching sheet immediately, then strips the param from the URL
	// so a reload won't re-open it.
	function handleActionParam() {
		const action = $page.url.searchParams.get('action');
		if (!action) return;

		const consume = () => {
			const url = new URL($page.url);
			url.searchParams.delete('action');
			goto(url.pathname + url.search, { replaceState: true, noScroll: true, keepFocus: true });
		};

		switch (action) {
			case 'log-supplement':
				quickLogInitialTab = 'supplements';
				quickLogOpen = true;
				consume();
				break;
			case 'log-water':
			case 'log-meditation':
				quickLogInitialTab = 'tracker';
				quickLogOpen = true;
				consume();
				break;
			case 'log-mood':
				moodEntryOpen = true;
				consume();
				break;
			default:
				consume();
		}
	}

	function handleCaffeineShortcut(drink: CaffeineDrink) {
		quickLogOpen = false;
		caffeinePickerPreselect = drink;
		caffeinePickerOpen = true;
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
	const trackerInfoLine = $derived.by(() => {
		const parts: string[] = [];
		if (loggedTodaySupplements.length > 0) {
			parts.push(`${loggedTodaySupplements.length} Supplement${loggedTodaySupplements.length > 1 ? 's' : ''}`);
		}
		const caffeineMg = caffeineLogsToday.reduce((s, l) => s + l.caffeineMg, 0);
		if (caffeineMg > 0) parts.push(`${caffeineMg} mg Koffein`);
		if (parts.length === 0) return '';
		return parts.join(' · ') + (currentLang() === 'de' ? ' · heute getrackt' : ' · tracked today');
	});

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
		try {
			const res = await fetch('/api/supplements');
			if (!res.ok) throw new Error();
			const data = await res.json();
			supplements = data.supplements;
			cacheSupplements(data.supplements).catch(() => {});
		} catch {
			supplements = (await getOfflineSupplements()) as Supplement[];
		}
	}

	async function loadTodayLogs() {
		const from = todayStart();
		const to = todayEnd();
		try {
			const res = await fetch(`/api/supplement-logs?from=${from}&to=${to}`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			const serverLogs = data.logs as Log[];
			cacheTodayLogs(serverLogs).catch(() => {});
			// Noch-nicht-synchronisierte optimistische Einträge mergen (Queue-Drain
			// kann nach onlogged() noch einige Sekunden laufen — ohne Merge würde
			// das frisch geloggte Item kurz aus der UI verschwinden).
			const pending = await getPendingLogs('create_supplement_log', from, to);
			const seen = new Set(serverLogs.map(l => (l as { clientLogId?: string }).clientLogId).filter(Boolean));
			const extra: Log[] = pending
				.filter(p => !seen.has(p.clientLogId as string))
				.map(p => ({
					id: p.clientLogId as string,
					supplementId: p.supplementId as string,
					amount: p.amount as number,
					loggedAt: p.loggedAt as number,
					note: (p.note as string | null) ?? null
				}));
			todayLogs = [...serverLogs, ...extra];
		} catch {
			todayLogs = await getOfflineTodayLogs();
		}
	}

	function getHistoryBounds(): { from: number; to: number } {
		const d = new Date(historyDate + 'T00:00:00');
		if (historyPeriod === 'day') {
			const from = d.getTime();
			return { from, to: from + 86_400_000 - 1 };
		}
		if (historyPeriod === 'week') {
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			const monday = new Date(d);
			monday.setDate(d.getDate() + diffToMonday);
			monday.setHours(0, 0, 0, 0);
			const sunday = new Date(monday);
			sunday.setDate(monday.getDate() + 6);
			sunday.setHours(23, 59, 59, 999);
			return { from: monday.getTime(), to: sunday.getTime() };
		}
		const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
		const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
		return { from, to };
	}

	async function loadHistory() {
		historyLoading = true;
		const { from, to } = getHistoryBounds();
		const [statsRes] = await Promise.all([
			fetch(`/api/supplement-stats?period=${historyPeriod}&from=${from}&to=${to}`),
			loadHistoryWater(),
			loadHistoryCaffeine(),
			loadHistoryMeditation()
		]);
		if (statsRes.ok) {
			const data = await statsRes.json();
			historyNutrients = data.nutrients ?? {};
			historySupplements = data.supplements ?? {};
			historyLogs = data.logs ?? [];
		}
		historyLoading = false;
	}

	async function loadHistoryWater() {
		if (!userSettings.waterTrackerEnabled || historyPeriod !== 'day') {
			historyWaterLogs = [];
			return;
		}
		const d = new Date(historyDate + 'T00:00:00');
		const from = d.getTime();
		const to = from + 86_400_000 - 1;
		try {
			const res = await fetch(`/api/water-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				historyWaterLogs = data.logs ?? [];
			}
		} catch { historyWaterLogs = []; }
	}

	async function deleteLog(logId: string) {
		try {
			const res = await fetch(`/api/supplement-logs/${logId}`, { method: 'DELETE' });
			if (res.ok) await Promise.all([loadTodayLogs(), loadSupplements()]);
		} catch {}
	}

	async function loadWaterReminders() {
		if (!userSettings.waterTrackerEnabled) return;
		try {
			const res = await fetch('/api/water-reminders');
			if (res.ok) {
				const data = await res.json();
				const today = new Date().getDay();
				waterHasReminderToday = (data.schedules ?? []).some((s: { days: string }) => {
					try { return (JSON.parse(s.days) as number[]).includes(today); }
					catch { return false; }
				});
			}
		} catch {}
	}

	async function loadWaterLogs() {
		if (!userSettings.waterTrackerEnabled) return;
		const from = todayStart();
		const to = todayEnd();
		try {
			const res = await fetch(`/api/water-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				const serverLogs = data.logs as WaterLog[];
				cacheWaterLogs(serverLogs).catch(() => {});
				const pending = await getPendingLogs('create_water_log', from, to);
				const seen = new Set(serverLogs.map(l => (l as { clientLogId?: string }).clientLogId).filter(Boolean));
				const extra = pending
					.filter(p => !seen.has(p.clientLogId as string))
					.map(p => ({ id: p.clientLogId as string, amountMl: p.amountMl as number, loggedAt: p.loggedAt as number } as WaterLog));
				waterLogsToday = [...serverLogs, ...extra];
			} else throw new Error();
		} catch {
			waterLogsToday = (await getOfflineWaterLogsToday()) as WaterLog[];
		}
	}

	async function deleteWaterLog(id: string) {
		try {
			const res = await fetch(`/api/water-logs/${id}`, { method: 'DELETE' });
			if (res.ok) await loadWaterLogs();
		} catch {}
	}

	async function loadCaffeineDrinks() {
		try {
			const res = await fetch('/api/caffeine-drinks');
			if (res.ok) {
				const data = await res.json();
				caffeineDrinks = data.drinks ?? [];
			}
		} catch {}
	}

	async function loadCaffeineLogs() {
		if (!userSettings.caffeineTrackerEnabled) return;
		const from = todayStart();
		const to = todayEnd();
		try {
			const res = await fetch(`/api/caffeine-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				const serverLogs = data.logs as CaffeineLog[];
				cacheCaffeineLogs(serverLogs).catch(() => {});
				const pending = await getPendingLogs('create_caffeine_log', from, to);
				const seen = new Set(serverLogs.map(l => (l as { clientLogId?: string }).clientLogId).filter(Boolean));
				const extra = pending
					.filter(p => !seen.has(p.clientLogId as string))
					.map(p => ({
						id: p.clientLogId as string,
						drinkName: p.drinkName as string,
						amountMl: p.amountMl as number,
						caffeineMg: p.caffeineMg as number,
						loggedAt: p.loggedAt as number
					} as CaffeineLog));
				caffeineLogsToday = [...serverLogs, ...extra];
			} else throw new Error();
		} catch {
			caffeineLogsToday = (await getOfflineCaffeineLogsToday()) as CaffeineLog[];
		}
	}

	async function deleteCaffeineLog(id: string) {
		try {
			const res = await fetch(`/api/caffeine-logs/${id}`, { method: 'DELETE' });
			if (res.ok) await loadCaffeineLogs();
		} catch {}
	}

	async function loadMeditationLogs() {
		if (!userSettings.meditationTrackerEnabled) return;
		const from = todayStart();
		const to = todayEnd();
		try {
			const res = await fetch(`/api/meditation-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				const serverLogs = data.logs as MeditationLog[];
				cacheMeditationLogs(serverLogs).catch(() => {});
				const pending = await getPendingLogs('create_meditation_log', from, to);
				const seen = new Set(serverLogs.map(l => (l as { clientLogId?: string }).clientLogId).filter(Boolean));
				const extra = pending
					.filter(p => !seen.has(p.clientLogId as string))
					.map(p => ({ id: p.clientLogId as string, durationSeconds: p.durationSeconds as number, loggedAt: p.loggedAt as number } as MeditationLog));
				meditationLogsToday = [...serverLogs, ...extra];
			} else throw new Error();
		} catch {
			meditationLogsToday = (await getOfflineMeditationLogsToday()) as MeditationLog[];
		}
	}

	async function deleteMeditationLog(id: string) {
		try {
			const res = await fetch(`/api/meditation-logs/${id}`, { method: 'DELETE' });
			if (res.ok) await loadMeditationLogs();
		} catch {}
	}

	async function loadTodayMoodEntry() {
		if (!userSettings.moodTrackerEnabled) { todayMoodEntry = null; return; }
		try {
			const dateStr = toLocalDateStr(new Date());
			const res = await fetch(`/api/mood-logs?from=${dateStr}&to=${dateStr}`);
			if (res.ok) {
				const data = await res.json();
				const log = (data.logs ?? [])[0];
				if (log) {
					let acts: string[] = [];
					try { acts = log.activities ? JSON.parse(log.activities) : []; } catch {}
					todayMoodEntry = { date: log.date, mood: log.mood, activities: acts, note: log.note };
				} else {
					todayMoodEntry = null;
				}
			}
		} catch { todayMoodEntry = null; }
	}

	async function loadHistoryMeditation() {
		if (!userSettings.meditationTrackerEnabled) {
			historyMeditationLogs = [];
			return;
		}
		const d = new Date(historyDate + 'T00:00:00');
		let from: number;
		let to: number;
		if (historyPeriod === 'day') {
			from = d.getTime();
			to = from + 86_400_000 - 1;
		} else if (historyPeriod === 'week') {
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			const monday = new Date(d);
			monday.setDate(d.getDate() + diffToMonday);
			monday.setHours(0, 0, 0, 0);
			from = monday.getTime();
			to = from + 7 * 86_400_000 - 1;
		} else {
			const first = new Date(d.getFullYear(), d.getMonth(), 1);
			const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
			from = first.getTime();
			to = last.getTime();
		}
		try {
			const res = await fetch(`/api/meditation-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				historyMeditationLogs = data.logs ?? [];
			}
		} catch { historyMeditationLogs = []; }
	}

	async function loadHistoryCaffeine() {
		if (!userSettings.caffeineTrackerEnabled) {
			historyCaffeineLogs = [];
			return;
		}
		const d = new Date(historyDate + 'T00:00:00');
		let from: number;
		let to: number;
		if (historyPeriod === 'day') {
			from = d.getTime();
			to = from + 86_400_000 - 1;
		} else if (historyPeriod === 'week') {
			const day = d.getDay();
			const diffToMonday = day === 0 ? -6 : 1 - day;
			const monday = new Date(d);
			monday.setDate(d.getDate() + diffToMonday);
			monday.setHours(0, 0, 0, 0);
			from = monday.getTime();
			to = from + 7 * 86_400_000 - 1;
		} else {
			const first = new Date(d.getFullYear(), d.getMonth(), 1);
			const last = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
			from = first.getTime();
			to = last.getTime();
		}
		try {
			const res = await fetch(`/api/caffeine-logs?from=${from}&to=${to}`);
			if (res.ok) {
				const data = await res.json();
				historyCaffeineLogs = data.logs ?? [];
			}
		} catch { historyCaffeineLogs = []; }
	}

	// ─── Edit / Add log sheet ────────────────────────────────────────────────────

	type EditLogSheetType = { id: string; supplementName: string; unit: string; amount: number; time: string; note: string | null };
	let editLogSheet = $state<EditLogSheetType | null>(null);
	let addLogSheet = $state<{ date: string } | null>(null);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressStart = { x: 0, y: 0 };

	function openEditLog(log: Log, supplement: Supplement) {
		const d = new Date(log.loggedAt);
		editLogSheet = {
			id: log.id,
			supplementName: supplement.name,
			unit: supplement.unit,
			amount: log.amount,
			time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
			note: log.note ?? null
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

	// Push a same-URL history entry when the sheet opens so iOS back-swipe
	// shows this page (not the previous route) during the gesture animation.
	$effect(() => {
		if (quickLogOpen) {
			history.pushState(null, '', location.href);
		}
	});

	beforeNavigate(({ type, to, cancel }) => {
		if (type === 'popstate') {
			// Back/swipe: close one sheet at a time instead of navigating
			if (editLogSheet) { editLogSheet = null; cancel(); return; }
			if (addLogSheet) { addLogSheet = null; cancel(); return; }
			if (quickLogOpen) { quickLogOpen = false; cancel(); return; }
		} else if (to && to.url.pathname !== $page.url.pathname) {
			// Echter Seitenwechsel: Sheets schließen.
			// Same-page Query-Umschreiben (z.B. consume() in handleActionParam
			// nach Push-Deep-Link) darf das offene Sheet NICHT killen.
			quickLogOpen = false;
			editLogSheet = null;
			addLogSheet = null;
		}
	});

	// Re-fetch tracker data when settings arrive from server (race condition fix)
	$effect(() => {
		if (userSettings.waterTrackerEnabled) {
			void loadWaterLogs();
			void loadWaterReminders();
		} else {
			waterLogsToday = [];
		}
	});
	$effect(() => {
		if (userSettings.caffeineTrackerEnabled) void loadCaffeineLogs();
		else caffeineLogsToday = [];
	});
	$effect(() => {
		if (userSettings.meditationTrackerEnabled) void loadMeditationLogs();
		else meditationLogsToday = [];
	});

	$effect(() => {
		if (userSettings.moodTrackerEnabled) void loadTodayMoodEntry();
		else todayMoodEntry = null;
	});

	onMount(() => {
		Promise.all([loadSupplements(), loadTodayLogs(), loadTodayReminders(), loadWaterReminders(), loadWaterLogs(), loadCaffeineDrinks(), loadCaffeineLogs(), loadMeditationLogs(), loadTodayMoodEntry()]).then(() => { loading = false; });
		handleActionParam();
		const clockInterval = setInterval(() => { now = new Date(); }, 60_000);

		function onVisibilityChange() {
			if (document.visibilityState === 'visible') {
				now = new Date();
				Promise.all([loadSupplements(), loadTodayLogs(), loadTodayReminders(), loadWaterReminders(), loadWaterLogs(), loadCaffeineLogs(), loadMeditationLogs(), loadTodayMoodEntry()]);
			}
		}
		document.addEventListener('visibilitychange', onVisibilityChange);

		return () => {
			clearInterval(clockInterval);
			document.removeEventListener('visibilitychange', onVisibilityChange);
		};
	});

	// React to push-triggered deep-links while the app is already open on /supplements
	// (SW navigates the existing client → action param appears → open the sheet).
	$effect(() => {
		void $page.url.searchParams.get('action');
		handleActionParam();
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

	let historyWaterLogs = $state<{ id: string; amountMl: number; loggedAt: number }[]>([]);
	let historyMeditationLogs = $state<MeditationLog[]>([]);

	function openHistoryEditLog(log: Log, sup: { name: string; unit: string }) {
		const d = new Date(log.loggedAt);
		editLogSheet = {
			id: log.id,
			supplementName: sup.name,
			unit: sup.unit,
			amount: log.amount,
			time: `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`,
			note: log.note ?? null
		};
	}
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.supplement_title} onMenuOpen={() => menuOpen = true} />
	<div class="flex-shrink-0" style="height: calc(env(safe-area-inset-top) + 5.25rem)"></div>

	<!-- Tab Bar + Manage row — unified card -->
	<div class="flex-shrink-0 px-4 mb-3">
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">
			<!-- Tab switcher -->
			<div class="flex gap-1 p-1">
				<button
					onclick={() => goto($page.url.pathname, { noScroll: true, keepFocus: true, replaceState: true })}
					class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
					style="background-color: {activeTab === 'today' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'today' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				>
					{t.supplement_tab_today}
				</button>
				<button
					onclick={() => goto(`${$page.url.pathname}?tab=history`, { noScroll: true, keepFocus: true, replaceState: true })}
					class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
					style="background-color: {activeTab === 'history' ? 'var(--color-surface-card)' : 'transparent'}; color: {activeTab === 'history' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				>
					{t.supplement_tab_history}
				</button>
			</div>
			<!-- Manage + Reminder row — only on Today tab -->
			{#if activeTab === 'today'}
				<div class="flex items-center">
					<button
						onclick={() => goto('/tracker/verwalten')}
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
							{@const isDone = reminderIsDone(reminder)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<div class="flex items-center gap-3 active:opacity-60 cursor-pointer select-none"
							     onclick={() => toggleReminderDone(reminder)}
							     style={isDone ? 'opacity: 0.5' : ''}>
								<div class="w-4 h-4 rounded-full shrink-0 flex items-center justify-center"
								     style="border: 1.5px solid {isDone ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}; background: {isDone ? 'var(--color-on-surface-variant)' : 'transparent'}">
									{#if isDone}
										<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-surface-low)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
											<polyline points="20 6 9 17 4 12"/>
										</svg>
									{/if}
								</div>
								<span class="text-sm font-semibold tabular-nums shrink-0"
								      style="color: {isDone ? 'var(--color-on-surface-variant)' : 'var(--color-primary)'}; {isDone ? 'text-decoration: line-through' : ''}"
								>{reminder.time}</span>
								<span class="text-sm" style="color: {isDone ? 'var(--color-on-surface-variant)' : 'var(--color-on-surface)'}; {isDone ? 'text-decoration: line-through' : ''}">{reminder.names.join(' · ')}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
			<!-- Period selector — only on History tab -->
			{#if activeTab === 'history'}
				<div class="flex gap-1 p-1">
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
			{/if}
		</div>
	</div>

	<!-- Date navigation — only on History tab -->
	{#if activeTab === 'history'}
		<div class="flex-shrink-0 px-4 mb-3 flex items-center justify-between">
			<button
				onclick={() => navigateHistory(-1)}
				aria-label="Vorheriger Zeitraum"
				class="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
				style="background-color: var(--color-surface-container)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
			{#if historyPeriod === 'day'}
				<div style="position:relative; display:inline-block">
					<span class="text-sm font-semibold select-none" style="color:var(--color-on-surface); pointer-events:none">{formatPeriodLabel()}</span>
					<input
						type="date"
						bind:value={historyDate}
						max={toLocalDateStr(new Date())}
						style="position:absolute; inset:0; width:100%; height:100%; opacity:0.001; cursor:pointer; border:none; padding:0; background:transparent"
						aria-label="Datum wählen"
					/>
				</div>
			{:else}
				<span class="text-sm font-semibold" style="color:var(--color-on-surface)">{formatPeriodLabel()}</span>
			{/if}
			<button
				onclick={() => navigateHistory(1)}
				aria-label="Nächster Zeitraum"
				class="w-9 h-9 rounded-full flex items-center justify-center active:opacity-60"
				style="background-color: var(--color-surface-container)"
			>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>
		</div>
	{/if}

	<div class="relative flex-1 min-h-0">
		{#if activeTab === 'today' && userSettings.greetingEnabled}
			{@const hour = now.getHours()}
			{@const todayGreeting = hour < 12 ? t.greeting_morning : hour < 18 ? t.greeting_day : hour < 22 ? t.greeting_evening : t.greeting_night}
			{@const todayDayName = new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { weekday: 'long' }).format(now)}
			{@const todayDateStr = new Intl.DateTimeFormat(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long' }).format(now)}
			<div class="absolute left-0 right-0 top-0 flex flex-col justify-end px-6 pb-4" style="height: calc(22vh - 2.5rem); min-height: 75px; max-height: 120px">
				<p class="text-[10px] font-semibold tracking-[0.15em] uppercase mb-1" style="color: var(--color-on-surface-variant)">{todayDayName} · {todayDateStr}</p>
				<p class="text-2xl font-light leading-tight" style="color: var(--color-on-surface)">{todayGreeting}, {data.user.username}</p>
				{#if trackerInfoLine}
					<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant); opacity: 0.65">{trackerInfoLine}</p>
				{/if}
			</div>
		{/if}

		<div bind:this={scrollContainer}
		     class="absolute inset-0 overflow-y-auto {activeTab === 'today' ? 'flex flex-col justify-end' : ''}"
		     style="padding-bottom: 5.5rem">

	{#if loading}
		<div class="flex justify-center py-16">
			<div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if activeTab === 'today'}
		<!-- TODAY TAB -->
		{#if loggedTodaySupplements.length === 0 && !hasVisibleTrackerCards}
			<div class="px-4 py-8 text-center">
				<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_today_empty}</p>
			</div>
		{:else}
			{@const visibleTrackers = [
				userSettings.moodTrackerEnabled && todayMoodEntry !== null ? 'mood' : null,
				userSettings.waterTrackerEnabled && (waterLogsToday.length > 0 || waterHasReminderToday) ? 'water' : null,
				userSettings.caffeineTrackerEnabled && caffeineLogsToday.length > 0 ? 'caffeine' : null,
				userSettings.meditationTrackerEnabled && meditationLogsToday.length > 0 ? 'meditation' : null
			].filter(Boolean)}
			<div class="px-4 flex flex-col gap-2">
			{#if loggedTodaySupplements.length > 0}
				<div class="rounded-2xl flex flex-col select-none" style="background-color: var(--color-surface-card)">
					<div class="px-4 pt-2.5 pb-0.5">
						<p class="text-xs font-semibold tracking-wider" style="color: var(--color-primary)">Supplements</p>
					</div>
					{#each loggedTodaySupplements as supplement, i (supplement.id)}
						{@const logs = logsForSupplement(supplement.id)}
						{@const total = totalTodayAmount(supplement.id)}
						{@const expanded = expandedIds.has(supplement.id)}
						{@const logTimes = allLogTimes(supplement.id)}
						<div
							class="px-4 py-2 flex flex-col min-h-[52px] justify-center"
							style=""
							>
								<!-- Header row — long-press on info area opens edit for most recent log -->
								<div class="flex items-center justify-between gap-3">
									<button
										class="flex-1 min-w-0 text-left active:opacity-70"
										onpointerdown={(e) => startPress(e, logs.reduce((a, b) => a.loggedAt > b.loggedAt ? a : b), supplement)}
										onpointermove={movePress}
										onpointerup={cancelPress}
										onpointercancel={cancelPress}
									>
										<div class="flex items-baseline gap-1 flex-wrap">
											<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{supplement.name}</p>
											{#if supplement.stockQuantity != null}
												<span class="text-xs font-medium" style="color: {supplement.stockQuantity <= 5 ? 'var(--color-error)' : 'var(--color-on-surface-variant)'}">({supplement.stockQuantity} {t.supplement_stock_left})</span>
											{/if}
											{#if supplement.brand}
												<span class="text-[10px]" style="color: var(--color-on-surface-variant); opacity: 0.5">· {supplement.brand}</span>
											{/if}
										</div>
										{#if total > 0}
											<p class="text-xs mt-0.5" style="color: var(--color-primary)">
												{total} {displayUnit(supplement.unit, currentLang())} {t.supplement_taken_today}{logTimes ? ` ${logTimes}` : ''}
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
											     style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
												<polyline points="9 6 15 12 9 18"/>
											</svg>
										</button>
									{/if}
								</div>
								<!-- Expanded content — opens downward -->
								{#if expanded}
									<div class="mt-2 pt-2 border-t space-y-1.5" style="border-color: var(--color-outline-variant)">
										{#each logs as log (log.id)}
											<div>
												<div class="flex items-center justify-between text-xs">
													<button
														onpointerdown={(e) => startPress(e, log, supplement)}
														onpointermove={movePress}
														onpointerup={cancelPress}
														onpointercancel={cancelPress}
														class="flex-1 text-left py-0.5 active:opacity-60"
														style="color: var(--color-on-surface-variant)"
													><span style="color: var(--color-primary)">{log.amount} {displayUnit(supplement.unit, currentLang())}</span> {t.supplement_log_at} {formatTime(log.loggedAt)}</button>
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
												{#if log.note}
													<p class="text-[11px] px-0.5 pb-0.5 italic" style="color: var(--color-on-surface-variant)">{log.note}</p>
												{/if}
											</div>
										{/each}
										{#if supplement.nutrients.length > 0 && total > 0}
											<div class="mt-1 flex flex-wrap gap-1.5">
												{#each supplement.nutrients as n}
													<span class="text-xs px-2 py-0.5 rounded-full" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
														{n.name}: {formatNutrientValue(n.amountPerUnit * total)} {n.unit}
													</span>
												{/each}
											</div>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
				</div>
			{/if}
			{#if visibleTrackers.length > 0}
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
					<div class="px-4 pt-2 pb-0 -mb-1">
						<p class="text-xs font-semibold tracking-wider" style="color: var(--color-primary)">Tracker</p>
					</div>
						{#if visibleTrackers.includes('mood') && todayMoodEntry !== null}
							<MoodTrackerCard
								todayEntry={todayMoodEntry}
								todayDate={toLocalDateStr(new Date())}
								onreload={loadTodayMoodEntry}
								embedded={true}
							/>
						{/if}
						{#if visibleTrackers.includes('water')}
							<div>
								<WaterTrackerCard
									logs={waterLogsToday}
									goalMl={userSettings.waterGoalMl ?? 2500}
									onlogged={loadWaterLogs}
									ondeleted={deleteWaterLog}
									embedded={true}
								/>
							</div>
						{/if}
						{#if visibleTrackers.includes('caffeine')}
							<div>
								<CaffeineTrackerCard
									logs={caffeineLogsToday}
									limitMg={userSettings.caffeineLimitMg ?? 400}
									drinks={visibleCaffeineDrinks}
									onlogged={loadCaffeineLogs}
									ondeleted={deleteCaffeineLog}
									embedded={true}
								/>
							</div>
						{/if}
						{#if visibleTrackers.includes('meditation')}
							<MeditationTrackerCard
								logs={meditationLogsToday}
								goalMinutes={userSettings.meditationDailyGoalMinutes ?? 15}
								onlogged={loadMeditationLogs}
								ondeleted={deleteMeditationLog}
								embedded={true}
							/>
						{/if}
				</div>
			{/if}
			</div>
		{/if}

	{:else}
		<HistoryTab
			loading={historyLoading}
			period={historyPeriod}
			date={historyDate}
			nutrients={historyNutrients}
			supplementStats={historySupplements}
			logs={historyLogs}
			waterLogs={historyWaterLogs}
			caffeineLogs={historyCaffeineLogs}
			meditationLogs={historyMeditationLogs}
			onMoodReload={loadTodayMoodEntry}
			onEditLog={openHistoryEditLog}
		/>
	{/if}

	</div><!-- end scrollable -->
	</div><!-- end relative wrapper -->
</div>

<QuickLogSheet
	bind:open={quickLogOpen}
	supplements={activeSupplements}
	waterEnabled={userSettings.waterTrackerEnabled}
	waterGoalMl={userSettings.waterGoalMl ?? 2500}
	waterTotalMl={waterLogsToday.reduce((s, l) => s + l.amountMl, 0)}
	caffeineEnabled={userSettings.caffeineTrackerEnabled}
	caffeineTotalMg={caffeineLogsToday.reduce((s, l) => s + l.caffeineMg, 0)}
	caffeineLimitMg={userSettings.caffeineLimitMg ?? 400}
	caffeineDrinks={visibleCaffeineDrinks}
	meditationEnabled={userSettings.meditationTrackerEnabled}
	meditationTotalMinutes={Math.floor(meditationLogsToday.reduce((s, l) => s + l.durationSeconds, 0) / 60)}
	meditationGoalMinutes={userSettings.meditationDailyGoalMinutes ?? 15}
	moodEnabled={userSettings.moodTrackerEnabled}
	moodHasEntry={todayMoodEntry !== null}
	onstartmeditation={startMeditation}
	onrateMood={() => { quickLogOpen = false; moodEntryOpen = true; }}
	onlogged={() => { Promise.all([loadTodayLogs(), loadSupplements(), loadWaterLogs(), loadCaffeineLogs(), loadMeditationLogs()]); if (activeTab === 'history') loadHistory(); }}
	onCaffeineShortcutClick={handleCaffeineShortcut}
	logDate={activeTab === 'history' && historyPeriod === 'day' ? historyDate : toLocalDateStr(new Date())}
	initialTab={quickLogInitialTab}
/>

<MoodEntrySheet
	bind:open={moodEntryOpen}
	date={activeTab === 'history' && historyPeriod === 'day' ? historyDate : toLocalDateStr(new Date())}
	initialMood={todayMoodEntry?.mood ?? null}
	initialActivities={todayMoodEntry ? todayMoodEntry.activities : [
		...(meditationLogsToday.length > 0 ? ['meditation'] : []),
		...(caffeineLogsToday.length > 0 ? ['caffeine'] : []),
		...(todayLogs.length > 0 ? ['supplements'] : [])
	]}
	initialNote={todayMoodEntry?.note ?? ''}
	onsaved={() => { moodEntryOpen = false; loadTodayMoodEntry(); if (activeTab === 'history') loadHistory(); }}
/>

<MeditationTimerSheet
	bind:open={meditationTimerOpen}
	durationMinutes={meditationTimerDuration}
	onsaved={() => { loadMeditationLogs(); if (activeTab === 'history') loadHistory(); }}
/>

<CaffeineDrinkPickerSheet
	bind:open={caffeinePickerOpen}
	drinks={visibleCaffeineDrinks}
	preselectedDrink={caffeinePickerPreselect}
	logDate={activeTab === 'history' && historyPeriod === 'day' ? historyDate : toLocalDateStr(new Date())}
	onlogged={() => { Promise.all([loadTodayLogs(), loadCaffeineLogs()]); if (activeTab === 'history') loadHistory(); }}
/>

<AppBottomNav
	activeTab="tracker"
	onFabTap={openQuickLog}
	fabLabel={t.add}
/>

<EditLogSheet
	bind:sheet={editLogSheet}
	bind:createSheet={addLogSheet}
	supplements={activeSupplements.map(s => ({ id: s.id, name: s.name, unit: s.unit, defaultAmount: s.defaultAmount }))}
	onreload={() => {
		if (activeTab === 'history') loadHistory();
		else Promise.all([loadTodayLogs(), loadSupplements()]);
	}}
/>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
