<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import { goto } from '$app/navigation';
	import { generateClientId, logSupplementOffline, logWaterOffline, logCaffeineOffline, logMeditationOffline } from '$lib/sync/manager';
	import { userSettings } from '$lib/userSettings.svelte';
	import { untrack, tick } from 'svelte';
	import type { CaffeineDrink } from '$lib/db/schema';
	import { todayKey as todayStr } from '$lib/dates';
	import SupplementQuickLogTile from './SupplementQuickLogTile.svelte';
	import { layoutBottomUp, paginateQuickLogItems, sortQuickLogItems } from '$lib/supplements/quickLogGrid';

	type Supplement = {
		id: string; name: string; unit: string;
		brand: string | null;
		active: boolean; defaultAmount: number;
		nutrients: unknown[];
	};

	let {
		open = $bindable(false),
		supplements,
		onlogged,
		waterEnabled = false,
		waterGoalMl = 2500,
		waterTotalMl = 0,
		caffeineEnabled = false,
		caffeineTotalMg = 0,
		caffeineLimitMg = 400,
		caffeineDrinks = [],
		onCaffeineTrackerClick = null,
		meditationEnabled = false,
		meditationTotalMinutes = 0,
		meditationGoalMinutes = 15,
		onstartmeditation = null,
		moodEnabled = false,
		moodHasEntry = false,
		onrateMood = null,
		nutritionEnabled = false,
		nutritionTotalKcal = 0,
		nutritionGoalKcal = null as number | null,
		onaddmeal = null as (() => void) | null,
		logDate = null as string | null,
		initialTab = null as 'tracker' | 'supplements' | null
	}: {
		open: boolean;
		supplements: Supplement[];
		onlogged: () => void;
		waterEnabled?: boolean;
		waterGoalMl?: number;
		waterTotalMl?: number;
		caffeineEnabled?: boolean;
		caffeineTotalMg?: number;
		caffeineLimitMg?: number;
		caffeineDrinks?: CaffeineDrink[];
		onCaffeineTrackerClick?: (() => void) | null;
		meditationEnabled?: boolean;
		meditationTotalMinutes?: number;
		meditationGoalMinutes?: number;
		onstartmeditation?: ((minutes: number) => void) | null;
		moodEnabled?: boolean;
		moodHasEntry?: boolean;
		onrateMood?: (() => void) | null;
		nutritionEnabled?: boolean;
		nutritionTotalKcal?: number;
		nutritionGoalKcal?: number | null;
		onaddmeal?: (() => void) | null;
		logDate?: string | null;
		initialTab?: 'tracker' | 'supplements' | null;
	} = $props();

	function makeTimestamp(dateStr: string, timeStr: string): number {
		const [h, m] = timeStr.split(':').map(Number);
		const d = new Date(dateStr + 'T00:00:00');
		d.setHours(h, m, 0, 0);
		return d.getTime();
	}

	function formatLogDate(dateStr: string): string {
		return new Date(dateStr + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
	}

	const isRetro = $derived(!!logDate && logDate !== todayStr());

	let sheetEl = $state<HTMLElement | null>(null);
	let activeSheetTab = $state<'tracker' | 'supplements'>('supplements');

	function getSmartDefault(): 'tracker' | 'supplements' {
		const hasTrackers = trackerList.length > 0;
		const hasSupps = supplements.length > 0;
		if (!hasTrackers) return 'supplements';
		if (!hasSupps) return 'tracker';
		try {
			const firstOpen = localStorage.getItem('quicklog_opened');
			if (!firstOpen) return 'tracker';
			const saved = localStorage.getItem('supplement_sheet_tab') as 'tracker' | 'supplements' | null;
			if (saved === 'tracker' || saved === 'supplements') return saved;
		} catch {}
		return 'tracker';
	}

	function switchTab(tab: 'tracker' | 'supplements') {
		activeSheetTab = tab;
		try { localStorage.setItem('supplement_sheet_tab', tab); } catch {}
		void tick().then(() => {
			if (!sheetEl) return;
			sheetEl.scrollTop = tab === 'supplements' ? sheetEl.scrollHeight : 0;
		});
	}

	let amounts = $state<Record<string, number>>({});
	let times = $state<Record<string, string>>({});
	let notes = $state<Record<string, string>>({});
	let noteEditorId = $state<string | null>(null);
	let noteInputEl = $state<HTMLInputElement | null>(null);
	let waterSaving = $state(false);
	let waterDone = $state(false);
	let waterError = $state<string | null>(null);
	let waterShowCustom = $state(false);
	let waterCustomAmount = $state('');
	let meditationShowCustom = $state(false);
	let meditationCustomTime = $state('00:10');
	let meditationRetroOpen = $state(false);
	let meditationRetroStartTime = $state('');
	let meditationRetroDuration = $state<number | null>(null);
	let meditationRetroCustomTime = $state('00:10');
	let meditationRetroShowCustom = $state(false);
	let meditationRetroSaving = $state(false);
	let waterRetroOpen = $state(false);
	let waterRetroTime = $state('');
	let waterRetroMl = $state('');
	let caffeineSaving = $state<string | null>(null); // drinkId being saved
	let caffeineDone = $state<string | null>(null);   // drinkId just logged
	let caffeinePage = $state(0);
	let saving = $state<Record<string, boolean>>({});
	let done = $state<Record<string, boolean>>({});
	let logCounts = $state<Record<string, number>>({});

	async function fetchLogCounts() {
		try {
			const res = await fetch('/api/supplement-logs/stats');
			if (res.ok) {
				logCounts = (await res.json()).counts ?? {};
				await tick();
				if (sheetEl && activeSheetTab === 'supplements') sheetEl.scrollTop = sheetEl.scrollHeight;
			}
		} catch {}
	}

	$effect(() => {
		if (open && userSettings.supplementSortOrder === 'freq') {
			void fetchLogCounts();
		}
	});

	function cycleSortOrder() {
		const order: Array<'az' | 'za' | 'freq'> = ['az', 'za', 'freq'];
		const current = userSettings.supplementSortOrder ?? 'az';
		const next = order[(order.indexOf(current) + 1) % order.length];
		userSettings.supplementSortOrder = next;
	}

	function manageSupplements() {
		open = false;
		void goto('/tracker/verwalten');
	}

	const trackerList = $derived(
		([
			caffeineEnabled && caffeineDrinks.length > 0 ? 'caffeine' : null,
			waterEnabled ? 'water' : null,
			nutritionEnabled ? 'nutrition' : null,
			meditationEnabled ? 'meditation' : null,
			moodEnabled ? 'mood' : null
		] as (string | null)[]).filter((x): x is string => x !== null)
	);

	const sortedSupplements = $derived(sortQuickLogItems(
		supplements,
		userSettings.supplementSortOrder ?? 'az',
		logCounts,
		currentLang()
	));
	const supplementGrid = $derived(layoutBottomUp(sortedSupplements, 3));
	const trackerGrid = $derived(layoutBottomUp(trackerList, 2));
	const caffeinePages = $derived(paginateQuickLogItems(caffeineDrinks, 4));
	const noteEditorSupplement = $derived(supplements.find(s => s.id === noteEditorId) ?? null);

	function updateCaffeinePage(event: Event) {
		const scroller = event.currentTarget as HTMLDivElement;
		if (scroller.clientWidth > 0) caffeinePage = Math.round(scroller.scrollLeft / scroller.clientWidth);
	}

	async function logCaffeine(drink: CaffeineDrink) {
		if (caffeineSaving) return;
		caffeineSaving = drink.id;
		const ml = userSettings.caffeineCustomAmounts?.[drink.id] ?? drink.defaultMl;
		const mg = Math.round(drink.caffeineMg * ml / drink.defaultMl);
		const loggedAt = makeTimestamp(logDate ?? todayStr(), new Date().toTimeString().slice(0, 5));
		const clientLogId = generateClientId();

		// Erst dauerhaft in den Ausgangskorb (überlebt App-Kill/iOS-Suspend), dann
		// stößt logCaffeineOffline den Server-Sync an. Haken erscheint erst danach.
		await logCaffeineOffline({ drinkName: drink.name, amountMl: ml, caffeineMg: mg, loggedAt, clientLogId });
		caffeineDone = drink.id;
		setTimeout(() => { caffeineDone = null; }, 2500);
		onlogged();
		caffeineSaving = null;
	}

	$effect(() => {
		if (open) {
			activeSheetTab = untrack(() => initialTab ?? getSmartDefault());
			try { localStorage.setItem('quicklog_opened', '1'); } catch {}
			caffeineDone = null;
			caffeineSaving = null;
			caffeinePage = 0;
			// Session-Reset beim Öffnen. supplements wird hier bewusst NICHT befüllt,
			// das übernimmt der zweite Effekt unten — sonst Race im Cold-Start, wenn
			// das Sheet via Push-Deep-Link aufgeht bevor loadSupplements() resolved hat.
			amounts = {};
			times = {};
			notes = {};
			noteEditorId = null;
			saving = {};
			done = {};
			waterDone = false;
			waterShowCustom = false;
			waterCustomAmount = '';
			waterError = null;
			meditationShowCustom = false;
			meditationCustomTime = '00:10';
			meditationRetroOpen = false;
			meditationRetroDuration = null;
			meditationRetroShowCustom = false;
			meditationRetroCustomTime = '00:10';
			waterRetroOpen = false;
			waterRetroMl = '';
			const nowTime = new Date().toTimeString().slice(0, 5);
			meditationRetroStartTime = nowTime;
			waterRetroTime = nowTime;
			tick().then(() => {
				if (!sheetEl) return;
				if (activeSheetTab === 'supplements') sheetEl.scrollTop = sheetEl.scrollHeight;
				else sheetEl.scrollTop = 0;
			});
		}
	});

	// Füllt fehlende per-supplement Defaults nach, sobald supplements verfügbar wird.
	// Existierende Einträge werden NIE überschrieben — User-Edits & Mid-Session-Logs bleiben intakt.
	// Reihenfolge wichtig: muss NACH dem Reset-Effekt oben stehen (Svelte 5 garantiert Source-Order).
	$effect(() => {
		if (!open) return;
		const now = new Date().toTimeString().slice(0, 5);
		let changedAmounts = false;
		let changedTimes = false;
		const a = { ...amounts };
		const ti = { ...times };
		for (const s of supplements) {
			if (a[s.id] === undefined) { a[s.id] = s.defaultAmount ?? 1; changedAmounts = true; }
			if (ti[s.id] === undefined) { ti[s.id] = now; changedTimes = true; }
		}
		if (changedAmounts) amounts = a;
		if (changedTimes) times = ti;
	});

	async function logWaterRetro() {
		const ml = Math.round(Number(waterRetroMl));
		if (!ml || ml <= 0) return;
		await logWater(ml, makeTimestamp(logDate ?? todayStr(), waterRetroTime));
		waterRetroMl = '';
		waterRetroOpen = false;
	}

	async function logMeditationRetro() {
		if (!meditationRetroDuration || meditationRetroSaving) return;
		meditationRetroSaving = true;
		try {
			const loggedAt = makeTimestamp(logDate ?? todayStr(), meditationRetroStartTime);
			const durationSeconds = meditationRetroDuration * 60;
			const clientLogId = generateClientId();
			// Erst dauerhaft sichern, dann synchronisieren (siehe logCaffeine).
			await logMeditationOffline({ durationSeconds, loggedAt, clientLogId });
			meditationRetroOpen = false;
			meditationRetroDuration = null;
			onlogged();
		} finally { meditationRetroSaving = false; }
	}

	async function logWater(ml: number, loggedAt?: number) {
		if (waterSaving) return;
		waterSaving = true;
		waterError = null;
		const ts = loggedAt ?? Date.now();
		const clientLogId = generateClientId();
		// Erst dauerhaft sichern, dann synchronisieren (siehe logCaffeine).
		await logWaterOffline({ amountMl: ml, loggedAt: ts, clientLogId });
		waterDone = true;
		setTimeout(() => { waterDone = false; }, 2500);
		onlogged();
		waterSaving = false;
	}

	function submitWaterCustom() {
		const ml = Math.round(Number(waterCustomAmount));
		if (!ml || ml <= 0) return;
		logWater(ml);
		waterCustomAmount = '';
		waterShowCustom = false;
	}

	function startMeditation(minutes: number) {
		if (!onstartmeditation || minutes <= 0) return;
		open = false;
		meditationShowCustom = false;
		meditationCustomTime = '00:10';
		onstartmeditation(minutes);
	}

	function submitMeditationCustom() {
		const [h, m] = meditationCustomTime.split(':').map(Number);
		const totalMin = (h || 0) * 60 + (m || 0);
		if (totalMin <= 0) return;
		startMeditation(totalMin);
	}

	function openNoteEditor(id: string) {
		noteEditorId = id;
		void tick().then(() => noteInputEl?.focus());
	}

	async function logOne(supplementId: string) {
		saving = { ...saving, [supplementId]: true };
		const amount = amounts[supplementId] ?? 1;
		const time = times[supplementId] ?? new Date().toTimeString().slice(0, 5);
		const loggedAt = makeTimestamp(logDate ?? todayStr(), time);
		const note = notes[supplementId]?.trim() || null;
		const clientLogId = generateClientId();

		// Erst dauerhaft in den Ausgangskorb (überlebt App-Kill/iOS-Suspend), dann
		// stößt logSupplementOffline den Server-Sync an (idempotent über clientLogId).
		await logSupplementOffline({ supplementId, amount, loggedAt, note, clientLogId });

		logCounts = { ...logCounts, [supplementId]: (logCounts[supplementId] ?? 0) + 1 };
		done = { ...done, [supplementId]: true };
		setTimeout(() => { done = { ...done, [supplementId]: false }; }, 2500);
		onlogged();
		saving = { ...saving, [supplementId]: false };
	}

	function abbreviateUnit(unit: string): string {
		const translated = displayUnit(unit, currentLang());
		const map: Record<string, string> = {
			'kapsel': 'Kap', 'kapseln': 'Kap',
			'capsule': 'Cap', 'capsules': 'Cap',
			'löffel': 'Löf', 'scoop': 'Sc', 'scoops': 'Sc',
			'tablette': 'Tab', 'tabletten': 'Tab', 'tablet': 'Tab', 'tablets': 'Tab',
			'stück': 'Stk', 'piece': 'pc', 'pieces': 'pc',
			'tropfen': 'Trpf', 'drop': 'dr', 'drops': 'dr',
			'teelöffel': 'TL', 'esslöffel': 'EL',
		};
		return map[translated.toLowerCase().trim()] ?? (translated.length > 5 ? translated.slice(0, 4) : translated);
	}
</script>

<style>
@keyframes confirm-pop {
	from { opacity: 0; transform: translateX(-8px); }
	to   { opacity: 1; transform: translateX(0); }
}
.supplement-done-confirm {
	animation: confirm-pop 0.2s ease forwards;
}
.caffeine-pager {
	scrollbar-width: none;
	overscroll-behavior-inline: contain;
}
.caffeine-pager::-webkit-scrollbar {
	display: none;
}
</style>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => open = false}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl flex flex-col"
	     style="background-color: var(--modal-bg); max-height: 85vh">
		<!-- Fixed handle + header -->
		<div class="flex-shrink-0 px-5 pt-4 pb-3">
			<div class="flex justify-center mb-4">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<div class="flex items-center justify-between">
					<div class="flex flex-col gap-0.5">
						<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.supplement_log_save}</p>
						<p class="text-xs font-semibold" style="color: {isRetro ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}">
							{formatLogDate(logDate ?? todayStr())}
						</p>
					</div>
					<div class="flex items-center gap-2">
						{#if activeSheetTab === 'supplements' || !(trackerList.length > 0 && sortedSupplements.length > 0)}
							<button
								onclick={cycleSortOrder}
								aria-label={t.supplement_sort_label}
								class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl active:opacity-60 transition-opacity"
								style="background-color: var(--bubble-interactive-bg)"
							>
								<span class="text-[11px] font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_sort_label}</span>
								<span class="text-[10px] font-bold" style="color: var(--color-primary)">
									{#if (userSettings.supplementSortOrder ?? 'az') === 'az'}A→Z
									{:else if userSettings.supplementSortOrder === 'za'}Z→A
									{:else}
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary)">
											<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
										</svg>
									{/if}
								</span>
							</button>
						{/if}
						<button
							onclick={manageSupplements}
							class="px-2.5 py-1.5 rounded-xl text-[11px] font-semibold active:opacity-60 transition-opacity"
							style="background-color: var(--bubble-interactive-bg); color: var(--color-primary)"
						>{t.supplement_manage}</button>
						<button
							onclick={() => open = false}
							aria-label={t.close}
							class="w-8 h-8 flex items-center justify-center rounded-xl active:opacity-60 transition-opacity"
							style="background-color: var(--bubble-interactive-bg); color: var(--color-on-surface-variant)"
						>
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
			</div>
		</div>

		<!-- Only the active content scrolls; header and tabs stay reachable. -->
		<div bind:this={sheetEl} class="flex-1 min-h-0 overflow-y-auto">
			<div
				class="px-5 min-h-full flex flex-col justify-end"
				class:pb-4={trackerList.length > 0 && sortedSupplements.length > 0}
				class:pb-6={!(trackerList.length > 0 && sortedSupplements.length > 0)}
			>
				<div class="flex flex-col gap-2">
				{#if activeSheetTab === 'tracker' && trackerList.length > 0}
					<div class="grid grid-cols-2 gap-2" aria-label="Tracker">
						{#each trackerGrid as tracker, index}
							{#if tracker === null}
								<div class="min-h-[128px]" style="order: {index}" aria-hidden="true"></div>
							{/if}
						{/each}
						{#if caffeineEnabled && caffeineDrinks.length > 0}
							<div
								class="h-[128px] rounded-3xl px-3 py-2.5 flex flex-col overflow-hidden"
								style="order: {trackerGrid.indexOf('caffeine')}; background-color: var(--bubble-container-bg); border: 1px solid {caffeineDone ? '#C8956C' : 'var(--bubble-container-border)'}"
							>
								{#if caffeineDone}
									<div class="h-full flex items-center justify-center px-2 text-center supplement-done-confirm" role="status" aria-live="polite">
										<span class="text-xs font-bold leading-snug" style="color: #C8956C">{t.supplement_taken}</span>
									</div>
								{:else}
									<div class="min-w-0">
										<button
											type="button"
											onclick={() => onCaffeineTrackerClick?.()}
											class="text-sm font-bold leading-tight line-clamp-2 text-left active:opacity-60"
											style="color: #C8956C"
										>{t.caffeine_title}</button>
										<p class="mt-1 text-[11px] leading-tight tabular-nums" style="color: var(--color-on-surface-variant)">{caffeineTotalMg} / {caffeineLimitMg} mg</p>
									</div>
									<div
										class="caffeine-pager mt-1.5 min-w-0 overflow-x-auto snap-x snap-mandatory"
										onscroll={updateCaffeinePage}
										aria-label={t.caffeine_title}
									>
										<div class="flex">
											{#each caffeinePages as page, pageIndex}
												<div class="w-full shrink-0 snap-start grid grid-cols-2 grid-rows-2 gap-x-1 gap-y-0.5" aria-label={`${pageIndex + 1} / ${caffeinePages.length}`}>
													{#each page as drink (drink.id)}
														{@const isThisSaving = caffeineSaving === drink.id}
														<button
																	onclick={() => logCaffeine(drink)}
															disabled={!!caffeineSaving}
															class="min-w-0 h-7 px-1 rounded-lg text-[11px] font-semibold truncate active:opacity-60 disabled:opacity-50 transition-opacity"
															style="background-color: transparent; color: #C8956C"
															aria-label={drink.name}
															title={drink.name}
														>
															{#if isThisSaving}…{:else}{drink.name}{/if}
														</button>
													{/each}
												</div>
											{/each}
										</div>
									</div>
									{#if caffeinePages.length > 1}
										<div class="mt-0.5 flex h-1 items-center justify-center gap-1" aria-hidden="true">
											{#each caffeinePages as _, index}
												<span
													class="h-1 rounded-full transition-all duration-150"
													class:w-3={caffeinePage === index}
													class:w-1={caffeinePage !== index}
													style="background-color: {caffeinePage === index ? '#C8956C' : 'var(--color-outline-variant)'}"
												></span>
											{/each}
										</div>
									{/if}
								{/if}
							</div>
						{/if}
						{#if waterEnabled}
							<div
								class="min-h-[128px] rounded-3xl px-3 py-2.5 flex flex-col relative overflow-hidden"
								style="order: {trackerGrid.indexOf('water')}; background-color: var(--bubble-container-bg); border: 1px solid {waterDone ? '#60A5FA' : 'var(--bubble-container-border)'}"
							>
								<div class="flex-1 min-h-0 flex flex-col transition-opacity duration-150" class:opacity-0={waterDone}>
									<div class="min-w-0">
										<p class="text-sm font-bold leading-tight line-clamp-2" style="color: #60A5FA">{t.water_title}</p>
										<p class="mt-1 text-[11px] leading-tight tabular-nums" style="color: var(--color-on-surface-variant)">{waterTotalMl} / {waterGoalMl} ml</p>
									</div>
									{#if !waterDone}
										{#if isRetro}
											<button
												onclick={() => waterRetroOpen = !waterRetroOpen}
												class="mt-2 self-start h-8 px-1 rounded-lg text-xs font-semibold active:opacity-60"
												style="background-color: transparent; color: #60A5FA"
											>+ {t.water_add}</button>
										{:else}
											<div class="mt-2 flex flex-wrap items-center gap-1">
												{#each (userSettings.waterPresets ?? [100, 200]).slice(0, 2) as ml}
													<button
														onclick={() => logWater(ml)}
														disabled={waterSaving}
														class="h-8 px-1.5 rounded-lg text-xs font-semibold active:opacity-60 disabled:opacity-50"
														style="background-color: transparent; color: #60A5FA"
													>+{ml}</button>
												{/each}
												<button
													onclick={() => { waterShowCustom = !waterShowCustom; waterCustomAmount = ''; }}
													disabled={waterSaving}
													class="h-8 min-w-0 px-1 rounded-lg text-xs font-semibold truncate active:opacity-60 disabled:opacity-50"
													style="background-color: transparent; color: var(--color-on-surface-variant)"
												>{t.water_custom}</button>
											</div>
										{/if}
									{/if}
								</div>
								{#if isRetro && waterRetroOpen && !waterDone}
									<div class="grid grid-cols-2 gap-1.5 mt-2 items-center">
										<input type="time" bind:value={waterRetroTime}
											class="w-full h-9 px-1 rounded-xl border-0 outline-none text-center min-w-0"
											style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"/>
										<input type="number" inputmode="numeric" min="1" bind:value={waterRetroMl} placeholder="ml"
											class="w-full h-9 px-2 rounded-xl border-0 outline-none min-w-0"
											style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"
											onkeydown={(e) => e.key === 'Enter' && logWaterRetro()}/>
										<button onclick={logWaterRetro} disabled={waterSaving || !waterRetroMl || Number(waterRetroMl) <= 0}
											class="col-span-2 h-9 px-3 rounded-xl text-xs font-semibold disabled:opacity-40 active:opacity-70"
											style="background: linear-gradient(135deg, #60A5FA, #3B82F6); color: white"
										>{t.water_add}</button>
									</div>
								{/if}
								{#if !isRetro && waterShowCustom && !waterDone}
									<div class="grid grid-cols-[1fr_auto] gap-1.5 mt-2 items-center">
										<input type="number" inputmode="numeric" min="1" bind:value={waterCustomAmount} placeholder="ml"
											class="w-full min-w-0 h-9 px-2 rounded-xl border-0 outline-none"
											style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"
											onkeydown={(e) => e.key === 'Enter' && submitWaterCustom()}/>
										<button onclick={submitWaterCustom} disabled={waterSaving || !waterCustomAmount || Number(waterCustomAmount) <= 0}
											class="h-9 px-3 rounded-xl text-xs font-semibold disabled:opacity-40 active:opacity-70 shrink-0"
											style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
										>{t.water_add}</button>
									</div>
								{/if}
								{#if waterError}
									<p class="text-[11px] mt-1" style="color: var(--color-error)">{waterError}</p>
								{/if}
								{#if waterDone}
									<div class="absolute inset-0 flex items-center justify-center px-2 text-center supplement-done-confirm" role="status" aria-live="polite">
										<span class="text-xs font-bold leading-snug" style="color: #60A5FA">{t.water_logged}</span>
									</div>
								{/if}
							</div>
						{/if}
						{#if meditationEnabled}
							<div
								class="min-h-[128px] rounded-3xl px-3 py-2.5 flex flex-col overflow-hidden"
								style="order: {trackerGrid.indexOf('meditation')}; background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
							>
								<div class="flex-1 min-h-0 flex flex-col">
									<div class="min-w-0">
										<p class="text-sm font-bold leading-tight line-clamp-2" style="color: #9F7AEA">{t.meditation_title}</p>
										<p class="mt-1 text-[11px] leading-tight tabular-nums" style="color: var(--color-on-surface-variant)">{meditationTotalMinutes} / {meditationGoalMinutes} min</p>
									</div>
									{#if isRetro}
										<button
											onclick={() => meditationRetroOpen = !meditationRetroOpen}
											class="mt-2 self-start h-7 px-1 rounded-lg text-xs font-semibold active:opacity-60"
											style="background-color: transparent; color: #9F7AEA"
										>+ {t.water_add}</button>
									{:else}
										<div class="mt-2 grid grid-cols-3 gap-x-1 gap-y-1">
											{#each [5, 10, 15, 20] as min}
											<button
												onclick={() => startMeditation(min)}
												class="h-7 px-1 rounded-lg text-xs font-semibold active:opacity-60"
													style="background-color: transparent; color: #9F7AEA"
												>{min}m</button>
											{/each}
											<button
												onclick={() => { meditationShowCustom = !meditationShowCustom; meditationCustomTime = '00:10'; }}
											class="h-7 px-1 rounded-lg text-xs font-semibold active:opacity-60"
												style="background-color: transparent; color: var(--color-on-surface-variant)"
											>{t.water_custom}</button>
										</div>
									{/if}
								</div>
								{#if isRetro && meditationRetroOpen}
									<div class="mt-2 space-y-1.5">
										<div class="grid grid-cols-[auto_1fr] items-center gap-1.5">
											<span class="text-[10px] font-semibold" style="color: var(--color-on-surface-variant)">Startzeit</span>
											<input type="time" bind:value={meditationRetroStartTime}
												class="w-full min-w-0 h-8 px-1 rounded-xl border-0 outline-none text-center"
												style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"/>
										</div>
										<div class="flex items-center gap-0.5 flex-wrap">
											<span class="text-[10px] font-semibold shrink-0" style="color: var(--color-on-surface-variant)">Dauer</span>
											{#each [5, 10, 15, 20] as min}
											<button
												onclick={() => { meditationRetroDuration = min; meditationRetroShowCustom = false; }}
												class="h-7 px-1 rounded-lg text-[10px] font-semibold active:opacity-60"
													style="background-color: transparent; color: #9F7AEA"
												>{min}m</button>
											{/each}
											<button
												onclick={() => { meditationRetroShowCustom = !meditationRetroShowCustom; meditationRetroCustomTime = '00:10'; }}
												class="h-7 px-1 rounded-lg text-[10px] font-semibold active:opacity-60"
												style="background-color: transparent; color: var(--color-on-surface-variant)"
											>{t.water_custom}</button>
										</div>
										{#if meditationRetroShowCustom}
											<div class="flex gap-1.5 items-center">
												<input type="time" bind:value={meditationRetroCustomTime}
													class="flex-1 h-8 px-2 rounded-xl border-0 outline-none text-center"
													style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 14px"/>
												<button
													onclick={() => { const [h,m] = meditationRetroCustomTime.split(':').map(Number); const mins = h*60+m; if (mins>0) { meditationRetroDuration = mins; meditationRetroShowCustom = false; } }}
													class="h-8 px-2 rounded-xl text-xs font-semibold active:opacity-70 shrink-0"
													style="background-color: transparent; color: #9F7AEA"
												>OK</button>
											</div>
										{/if}
										<button
											onclick={logMeditationRetro}
											disabled={!meditationRetroDuration || meditationRetroSaving}
											class="w-full h-9 rounded-xl text-xs font-semibold disabled:opacity-40 active:opacity-70"
											style="background: linear-gradient(135deg, #9F7AEA, #7C3AED); color: white"
										>{meditationRetroSaving ? '…' : t.water_add}</button>
									</div>
								{/if}
								{#if !isRetro && meditationShowCustom}
									<div class="grid grid-cols-1 gap-1.5 mt-2">
										<input type="time" bind:value={meditationCustomTime}
											class="w-full min-w-0 px-2 rounded-xl border-0 outline-none text-center"
											style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px; height: 36px"
											onkeydown={(e) => e.key === 'Enter' && submitMeditationCustom()}/>
										<button onclick={submitMeditationCustom}
											class="w-full px-3 rounded-xl text-xs font-semibold active:opacity-70"
											style="background: linear-gradient(135deg, #9F7AEA, #7C3AED); color: white; height: 36px"
										>{t.meditation_start}</button>
									</div>
								{/if}
							</div>
						{/if}
						{#if moodEnabled}
							<div
								class="min-h-[128px] rounded-3xl px-3 py-2.5 flex flex-col overflow-hidden"
								style="order: {trackerGrid.indexOf('mood')}; background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
							>
								<div class="min-w-0">
									<p class="text-sm font-bold leading-tight line-clamp-2" style="color: #F472B6">{t.mood_tracker_label}</p>
									<p class="mt-1 text-[11px] leading-tight" style="color: var(--color-on-surface-variant)">{moodHasEntry ? t.mood_today_rated : t.mood_entry_title}</p>
								</div>
								<button
									onclick={() => onrateMood?.()}
									class="mt-2 self-start h-8 px-1 rounded-lg text-xs font-semibold active:opacity-60"
									style="background-color: transparent; color: #F472B6"
								>{moodHasEntry ? t.mood_edit : t.mood_bewerten}</button>
							</div>
						{/if}
						{#if nutritionEnabled}
							<div
								class="min-h-[128px] rounded-3xl px-3 py-2.5 flex flex-col overflow-hidden"
								style="order: {trackerGrid.indexOf('nutrition')}; background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
							>
								<div class="min-w-0">
									<p class="text-sm font-bold leading-tight line-clamp-2" style="color: #FB923C">{t.nutrition_label}</p>
									<p class="mt-1 text-[11px] leading-tight tabular-nums" style="color: var(--color-on-surface-variant)">
										{Math.round(nutritionTotalKcal).toLocaleString(currentLang())}{nutritionGoalKcal ? ` / ${nutritionGoalKcal.toLocaleString(currentLang())}` : ''} kcal
									</p>
								</div>
								<div class="mt-2 flex flex-wrap items-center gap-1">
									<button
										onclick={() => onaddmeal?.()}
										class="h-8 min-w-0 px-1 rounded-lg text-xs font-semibold active:opacity-60"
										style="background-color: transparent; color: #FB923C"
									>{t.nutrition_add_meal}</button>
									<button
										onclick={() => { open = false; goto('/tracker/nutrition'); }}
										class="h-8 min-w-0 px-1 rounded-lg text-xs font-semibold active:opacity-60"
										style="background-color: transparent; color: var(--color-on-surface-variant)"
									>{t.nutrition_open}</button>
								</div>
							</div>
						{/if}
					</div>
				{/if}
				{#if (activeSheetTab === 'supplements' || trackerList.length === 0) && sortedSupplements.length === 0}
					<div class="rounded-2xl px-4 py-6 flex flex-col items-center gap-3 text-center" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_empty_hint}</p>
					<button
						onclick={manageSupplements}
							class="px-5 py-2 rounded-xl text-sm font-semibold active:opacity-70"
							style="background-color: var(--color-surface-high); color: var(--color-primary)"
						>{t.supplement_manage}</button>
					</div>
				{/if}
				{#if (activeSheetTab === 'supplements' || trackerList.length === 0) && sortedSupplements.length > 0}
					<div class="grid grid-cols-3 gap-2" aria-label={t.supplement_title}>
						{#each supplementGrid as supplement, index (supplement?.id ?? `empty-${index}`)}
							{#if supplement}
								<SupplementQuickLogTile
									{supplement}
									amount={amounts[supplement.id] ?? supplement.defaultAmount ?? 1}
									unitLabel={abbreviateUnit(supplement.unit)}
									time={times[supplement.id] ?? ''}
									hasNote={!!notes[supplement.id]?.trim()}
									saving={saving[supplement.id] ?? false}
									done={done[supplement.id] ?? false}
									takenLabel={t.supplement_taken}
									decreaseAmountLabel={t.supplement_amount_decrease}
									increaseAmountLabel={t.supplement_amount_increase}
									doneEditingLabel={t.sort_mode_done}
									onLog={() => void logOne(supplement.id)}
									onAmountChange={(amount) => amounts = { ...amounts, [supplement.id]: amount }}
									onTimeChange={(time) => times = { ...times, [supplement.id]: time }}
									onLongPress={() => openNoteEditor(supplement.id)}
								/>
							{:else}
								<div class="aspect-square" aria-hidden="true"></div>
							{/if}
						{/each}
					</div>
				{/if}
				</div>
			</div>
		</div>

		{#if noteEditorSupplement}
			<!-- Long-press note editor; overlays the sheet without disturbing the tile grid. -->
			<div class="absolute inset-0 z-20 flex items-end">
				<button
					onclick={() => noteEditorId = null}
					class="absolute inset-0 w-full h-full"
					style="background-color: rgba(0,0,0,0.48)"
					aria-label={t.close}
				></button>
				<div class="relative z-10 w-full mx-4 mb-4 p-4 rounded-3xl shadow-2xl"
					style="background-color: var(--color-surface-elevated); border: 1px solid var(--color-outline-variant); margin-bottom: max(1rem, env(safe-area-inset-bottom))">
					<div class="flex items-start justify-between gap-3 mb-3">
						<div class="min-w-0">
							<p class="text-sm font-bold truncate" style="color: var(--color-primary)">{noteEditorSupplement.name}</p>
							<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">{t.supplement_notes_label}</p>
						</div>
						<button
							onclick={() => noteEditorId = null}
							class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:opacity-60"
							style="background-color: var(--bubble-interactive-bg); color: var(--color-on-surface-variant)"
							aria-label={t.close}
						>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
								<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
							</svg>
						</button>
					</div>
					<input
						bind:this={noteInputEl}
						type="text"
						value={notes[noteEditorSupplement.id] ?? ''}
						oninput={(e) => notes = { ...notes, [noteEditorSupplement.id]: (e.target as HTMLInputElement).value }}
						onkeydown={(e) => { if (e.key === 'Enter') noteEditorId = null; if (e.key === 'Escape') noteEditorId = null; }}
						placeholder={t.supplement_log_note_placeholder}
						class="w-full h-11 px-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"
					/>
					<button
						onclick={() => noteEditorId = null}
						class="w-full h-10 mt-3 rounded-xl text-sm font-semibold active:opacity-70"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>{t.supplement_save}</button>
				</div>
			</div>
		{/if}

		<!-- Bottom tab bar — always when trackers are available -->
		{#if trackerList.length > 0}
			<div class="flex-shrink-0 px-4 pt-2" style="padding-bottom: max(1.25rem, env(safe-area-inset-bottom))">
				<div class="flex gap-1.5 p-1 rounded-2xl" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					<button
						onclick={() => switchTab('tracker')}
						class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:opacity-70"
						style="background-color: {activeSheetTab === 'tracker' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {activeSheetTab === 'tracker' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
					>Tracker</button>
					<button
						onclick={() => switchTab('supplements')}
						class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all active:opacity-70"
						style="background-color: {activeSheetTab === 'supplements' ? 'rgba(255,255,255,0.06)' : 'transparent'}; color: {activeSheetTab === 'supplements' ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
					>Supplements</button>
				</div>
			</div>
		{/if}
	</div>
{/if}
