<script lang="ts">
	import { goto } from '$app/navigation';
	import { tick, onMount } from 'svelte';
	import { t, currentLang } from '$lib/i18n.svelte';

	type RecipeOption = { id: string; title: string; imageUrl: string | null; servings: number };
	type PlanEntry = {
		id: string;
		date: string;
		recipeId: string | null;
		note: string | null;
		servings: number | null;
		recipeTitle: string | null;
		recipeImageUrl: string | null;
		recipeServings: number | null;
	};
	type ListEntry = { id: string; name: string; iconId: string | null };

	let { recipes, editMode = $bindable(false) }: { recipes: RecipeOption[]; editMode?: boolean } = $props();

	// --- Week state ---
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const MIN_WEEK_OFFSET = -4; // ~1 month back
	let weekOffset = $state(0);

	function mondayOf(offset: number): Date {
		const d = new Date(today);
		const day = d.getDay();
		const diff = day === 0 ? -6 : 1 - day;
		d.setDate(d.getDate() + diff + offset * 7);
		return d;
	}

	const monday = $derived(mondayOf(weekOffset));

	const weekDays = $derived.by(() => {
		const days: Date[] = [];
		for (let i = 0; i < 7; i++) {
			const d = new Date(monday);
			d.setDate(d.getDate() + i);
			days.push(d);
		}
		return days;
	});

	function toISO(d: Date): string {
		return d.toISOString().slice(0, 10);
	}

	function kwNumber(d: Date): number {
		const tmp = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
		tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
		const yearStart = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
		return Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
	}

	const headerLabel = $derived.by(() => {
		const lang = currentLang();
		const kw = kwNumber(monday);
		const sunday = weekDays[6];
		const fmtDay = (d: Date) => d.getDate() + '.';
		const fmtMonth = (d: Date) => {
			const months = lang === 'en'
				? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
				: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
			return months[d.getMonth()];
		};
		const sameMonth = monday.getMonth() === sunday.getMonth();
		const range = sameMonth
			? `${fmtDay(monday)}–${fmtDay(sunday)} ${fmtMonth(sunday)}`
			: `${fmtDay(monday)} ${fmtMonth(monday)} – ${fmtDay(sunday)} ${fmtMonth(sunday)}`;
		return `KW\u00a0${kw} · ${range}`;
	});

	const dayLabels = $derived.by(() => {
		const lang = currentLang();
		return lang === 'en'
			? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
			: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];
	});

	function formatDayDate(d: Date): string {
		const lang = currentLang();
		const months = lang === 'en'
			? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
			: ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
		return `${d.getDate()}. ${months[d.getMonth()]}`;
	}

	// --- Plan entries (multiple per day) ---
	let entries = $state<Record<string, PlanEntry[]>>({}); // keyed by date, array of entries
	let loading = $state(false);
	let initialLoadDone = $state(false);

	async function loadWeek() {
		loading = true;
		try {
			const from = toISO(weekDays[0]);
			const to = toISO(weekDays[6]);
			const res = await fetch(`/api/meal-plan?from=${from}&to=${to}`);
			if (!res.ok) return;
			const data: PlanEntry[] = await res.json();
			const map: Record<string, PlanEntry[]> = {};
			for (const e of data) {
				if (!map[e.date]) map[e.date] = [];
				map[e.date].push(e);
			}
			// Sort each day's entries by... createdAt isn't returned, so order by id (UUIDs are sequential)
			entries = map;
			if (!initialLoadDone && weekOffset === 0) {
				initialLoadDone = true;
				await tick();
				scrollToToday();
			}
		} finally {
			loading = false;
		}
	}

	let weekListEl = $state<HTMLElement | null>(null);

	function scrollToToday() {
		const todayEl = document.getElementById('meal-plan-today');
		if (!todayEl || !weekListEl) return;
		// Only scroll if the whole week doesn't fit
		if (weekListEl.scrollHeight <= weekListEl.clientHeight) return;
		todayEl.scrollIntoView({ behavior: 'instant', block: 'start' });
	}

	$effect(() => {
		const _w = weekDays;
		loadWeek();
	});

	// --- Picker sheet ---
	let pickerOpen = $state(false);
	let pickerTargetDate = $state('');
	let pickerEntryId = $state<string | null>(null); // set when editing existing
	let pickerSelectedDays = $state<Set<string>>(new Set());
	let pickerRecipeId = $state<string | null>(null);
	let pickerFreeText = $state('');
	let pickerIsFreeText = $state(false);
	let pickerServings = $state(2);
	let pickerSearch = $state('');
	let pickerSaving = $state(false);
	let pickerListEl = $state<HTMLDivElement | null>(null);

	$effect(() => {
		if (pickerOpen && pickerListEl) {
			tick().then(() => {
				if (pickerListEl) pickerListEl.scrollTop = pickerListEl.scrollHeight;
			});
		}
	});

	const pickerFilteredRecipes = $derived(
		pickerSearch.trim()
			? recipes.filter(r => r.title.toLowerCase().includes(pickerSearch.toLowerCase()))
			: recipes
	);

	const pickerSmartDays = $derived.by(() => {
		return weekDays.map(day => {
			const iso = toISO(day);
			if (pickerTargetDate && iso < pickerTargetDate) {
				const next = new Date(day);
				next.setDate(next.getDate() + 7);
				return toISO(next);
			}
			return iso;
		});
	});

	function openPicker(date: string, entry?: PlanEntry) {
		pickerTargetDate = date;
		pickerEntryId = entry?.id ?? null;
		pickerSelectedDays = new Set([date]);
		pickerRecipeId = entry?.recipeId ?? null;
		pickerFreeText = entry?.note ?? '';
		pickerIsFreeText = entry ? !entry.recipeId : false;
		pickerServings = entry?.servings ?? 2;
		pickerSearch = '';
		pickerSaving = false;
		pickerOpen = true;
	}

	function selectRecipe(r: RecipeOption) {
		pickerRecipeId = r.id;
		pickerIsFreeText = false;
		pickerServings = r.servings;
	}

	async function savePicker() {
		if (pickerSaving) return;
		if (!pickerRecipeId && !pickerIsFreeText) return;
		if (pickerIsFreeText && !pickerFreeText.trim()) return;
		pickerSaving = true;
		try {
			if (pickerEntryId) {
				// Edit existing entry
				await fetch(`/api/meal-plan/${pickerEntryId}`, {
					method: 'PATCH',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						recipeId: pickerIsFreeText ? null : pickerRecipeId,
						note: pickerIsFreeText ? pickerFreeText.trim() : null,
						servings: pickerServings
					})
				});
			} else {
				// Create new entries for all selected days
				const dates = [...pickerSelectedDays];
				await Promise.all(dates.map(date =>
					fetch('/api/meal-plan', {
						method: 'PUT',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							date,
							recipeId: pickerIsFreeText ? null : pickerRecipeId,
							note: pickerIsFreeText ? pickerFreeText.trim() : null,
							servings: pickerServings
						})
					})
				));
			}
			await loadWeek();
			pickerOpen = false;
		} finally {
			pickerSaving = false;
		}
	}

	async function deleteEntry(id: string) {
		await fetch(`/api/meal-plan/${id}`, { method: 'DELETE' });
		const next: Record<string, PlanEntry[]> = {};
		for (const [date, arr] of Object.entries(entries)) {
			const filtered = arr.filter(e => e.id !== id);
			if (filtered.length > 0) next[date] = filtered;
		}
		entries = next;
	}

	async function updateServings(entry: PlanEntry, delta: number) {
		const newServings = Math.max(1, (entry.servings ?? 1) + delta);
		// Optimistic update
		entries = {
			...entries,
			[entry.date]: entries[entry.date].map(e => e.id === entry.id ? { ...e, servings: newServings } : e)
		};
		await fetch(`/api/meal-plan/${entry.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ servings: newServings })
		});
	}

	function handleMealTap(entry: PlanEntry) {
		if (editMode) {
			openPicker(entry.date, entry);
		} else if (entry.recipeId) {
			goto(`/rezepte/${entry.recipeId}`);
		}
	}

	// --- List selector sheet ---
	let listSheetOpen = $state(false);
	let listSheetDates = $state<string[]>([]);
	let listSheetLists = $state<ListEntry[]>([]);
	let listSheetLoading = $state(false);
	let listSheetAdding = $state(false);
	let listSheetNewMode = $state(false);
	let listSheetNewName = $state('');

	async function openListSheet(dates: string[]) {
		listSheetDates = dates;
		listSheetOpen = true;
		listSheetAdding = false;
		listSheetNewMode = false;
		listSheetNewName = '';
		listSheetLoading = true;
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) throw new Error();
			const data = await res.json();
			listSheetLists = data.lists ?? data ?? [];
		} catch {
			listSheetLists = [];
		} finally {
			listSheetLoading = false;
		}
	}

	async function createNewListAndAdd() {
		const name = listSheetNewName.trim();
		if (listSheetAdding || !name) return;
		listSheetAdding = true;
		try {
			const res = await fetch('/api/lists', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description: null, iconId: 'rezept' })
			});
			if (!res.ok) throw new Error();
			const newList = await res.json();
			listSheetAdding = false;
			await addToList(newList.id);
		} catch {
			listSheetAdding = false;
		}
	}

	async function addToList(listId: string) {
		if (listSheetAdding) return;
		listSheetAdding = true;
		try {
			const res = await fetch('/api/meal-plan', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ dates: listSheetDates, listId })
			});
			if (!res.ok) throw new Error();
			listSheetOpen = false;
			goto(`/listen/${listId}`);
		} finally {
			listSheetAdding = false;
		}
	}

	const hasAnyEntry = $derived(Object.values(entries).some(arr => arr.length > 0));

	// --- Eating-out keyword detection ---
	const EATING_OUT_KEYWORDS = [
		'eating out', 'eat out', 'restaurant', 'auswärts', 'essen gehen',
		'außer haus', 'takeaway', 'take away', 'takeout', 'take out',
		'delivery', 'lieferung', 'lieferdienst', 'bestellen', 'liefern'
	];

	function isEatingOut(text: string): boolean {
		const lower = text.toLowerCase();
		return EATING_OUT_KEYWORDS.some(kw => lower.includes(kw));
	}

	// --- Long press delete (normal mode) ---
	let longPressEntry = $state<PlanEntry | null>(null);
	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function startLongPress(entry: PlanEntry) {
		longPressTimer = setTimeout(() => {
			longPressEntry = entry;
		}, 500);
	}

	function cancelLongPress() {
		if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; }
	}

	async function confirmDeleteEntry() {
		if (!longPressEntry) return;
		await deleteEntry(longPressEntry.id);
		longPressEntry = null;
	}

	// --- Swipe navigation ---
	let swipeStartX = 0;
	let swipeStartY = 0;

	function handleTouchStart(e: TouchEvent) {
		const t = e.touches[0];
		swipeStartX = t.clientX;
		swipeStartY = t.clientY;
	}

	function handleTouchEnd(e: TouchEvent) {
		if (swipeStartX < 30) return;
		const t = e.changedTouches[0];
		const dx = t.clientX - swipeStartX;
		const dy = t.clientY - swipeStartY;
		if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
		if (dx < 0) {
			weekOffset++;
		} else {
			if (weekOffset > MIN_WEEK_OFFSET) weekOffset--;
		}
	}

	onMount(() => {
		// Initial scroll to today happens inside loadWeek after first load
	});
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div ontouchstart={handleTouchStart} ontouchend={handleTouchEnd}>

<!-- Week header -->
<div class="flex items-center gap-2 px-1 mb-3">
	<button
		onclick={() => { if (weekOffset > MIN_WEEK_OFFSET) weekOffset--; }}
		disabled={weekOffset <= MIN_WEEK_OFFSET}
		aria-label="Vorherige Woche"
		class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-30 active:opacity-60 transition-opacity"
		style="background-color: var(--color-surface-container)"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="15 18 9 12 15 6"/>
		</svg>
	</button>

	<span class="flex-1 text-center text-sm font-semibold" style="color: var(--color-on-surface)">{headerLabel}</span>

	<button
		onclick={() => weekOffset++}
		aria-label="Nächste Woche"
		class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
		style="background-color: var(--color-surface-container)"
	>
		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
			<polyline points="9 18 15 12 9 6"/>
		</svg>
	</button>

	{#if hasAnyEntry && !editMode}
		<button
			onclick={() => openListSheet(weekDays.map(d => toISO(d)).filter(d => (entries[d]?.length ?? 0) > 0))}
			aria-label={t.meal_plan_add_week_to_list}
			class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
			style="background-color: color-mix(in srgb, var(--color-primary) 18%, var(--color-surface-container)); outline: 1px solid color-mix(in srgb, var(--color-primary) 35%, transparent)"
		>
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
				<line x1="3" y1="6" x2="21" y2="6"/>
				<path d="M16 10a4 4 0 0 1-8 0"/>
			</svg>
		</button>
	{/if}

</div>

<!-- Day cards — unified bubble, always-visible meals -->
{#if loading}
	<div class="flex justify-center py-10">
		<div class="w-5 h-5 rounded-full border-2 animate-spin"
		     style="border-color: var(--color-primary); border-top-color: transparent"></div>
	</div>
{:else}
	<div class="rounded-2xl overflow-hidden select-none" bind:this={weekListEl} style="background-color: var(--color-surface-card); -webkit-user-select: none">
		{#each weekDays as day, i (toISO(day))}
			{@const date = toISO(day)}
			{@const dayEntries = entries[date] ?? []}
			{@const isToday = date === toISO(today)}
			{@const isLast = i === 6}

			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				id={isToday ? 'meal-plan-today' : undefined}
				class="flex gap-3 px-4 py-2"
			>
				<!-- Left: day label + date -->
				<div class="flex-shrink-0 w-10 text-center pt-0.5">
					<div class="text-[10px] font-bold uppercase tracking-wider leading-tight" style="color: {isToday ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}">{dayLabels[i]}</div>
					<div class="text-[11px] leading-tight mt-0.5" style="color: {isToday ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}; opacity: {isToday ? 0.85 : 0.6}">{formatDayDate(day)}</div>
				</div>

				<!-- Center: meals always visible, stacked -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div class="flex-1 min-w-0 flex flex-col gap-2">
					{#if dayEntries.length === 0}
						<div
							onclick={() => openPicker(date)}
							class="flex items-center py-0.5 cursor-pointer active:opacity-60"
						>
							<span class="text-sm" style="color: var(--color-primary); opacity: 0.4">{t.meal_plan_empty_day}</span>
						</div>
					{:else}
						{#each dayEntries as entry (entry.id)}
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div
								onclick={() => handleMealTap(entry)}
								ontouchstart={() => { if (!editMode) startLongPress(entry); }}
								ontouchmove={cancelLongPress}
								ontouchend={cancelLongPress}
								class="flex items-center gap-2 cursor-pointer active:opacity-70 select-none"
							style="-webkit-user-select: none; -webkit-touch-callout: none"
							>
								<!-- Thumbnail -->
								{#if entry.recipeId}
									<div class="w-8 h-8 rounded-lg flex-shrink-0 overflow-hidden flex items-center justify-center"
									     style="background-color: var(--color-surface-container)">
										{#if entry.recipeImageUrl}
											<img src={entry.recipeImageUrl} alt="" class="w-full h-full object-cover" />
										{:else}
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
												<path d="M4 13 Q4 18 12 18 Q20 18 20 13 Z"/>
												<line x1="3" y1="13" x2="21" y2="13"/>
												<path d="M9 10 Q9.5 8 10 10 Q10.5 8 11 10"/>
												<path d="M13 10 Q13.5 8 14 10 Q14.5 8 15 10"/>
											</svg>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.recipeTitle}</div>
									</div>
								{:else}
									<div class="w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center"
									     style="background-color: var(--color-surface-container)">
										{#if isEatingOut(entry.note ?? '')}
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
												<path d="M4 13 Q4 18 12 18 Q20 18 20 13 Z"/>
												<line x1="3" y1="13" x2="21" y2="13"/>
												<path d="M9 10 Q9.5 8 10 10 Q10.5 8 11 10"/>
												<path d="M13 10 Q13.5 8 14 10 Q14.5 8 15 10"/>
											</svg>
										{:else}
											<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
												<path d="M6 7h12a1 1 0 0 1 1 1v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V8a1 1 0 0 1 1-1z"/>
												<path d="M8.5 7V5.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 .5.5V7"/>
												<line x1="2" y1="10" x2="4.5" y2="10"/>
												<line x1="19.5" y1="10" x2="22" y2="10"/>
												<path d="M9 13 q1.5 1.5 3 0 q1.5-1.5 3 0"/>
											</svg>
										{/if}
									</div>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.note}</div>
									</div>
								{/if}

								<!-- Right side: servings + actions -->
								<!-- svelte-ignore a11y_click_events_have_key_events -->
								<div class="flex items-center gap-1.5 flex-shrink-0" onclick={(e) => e.stopPropagation()}>
									{#if editMode}
										<button
											onclick={() => updateServings(entry, -1)}
											aria-label="Portionen verringern"
											class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
											style="background-color: var(--color-surface-container)"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
										</button>
										<span class="text-xs font-semibold w-4 text-center" style="color: var(--color-on-surface)">{entry.servings ?? (entry.recipeServings ?? 2)}</span>
										<button
											onclick={() => updateServings(entry, 1)}
											aria-label="Portionen erhöhen"
											class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
											style="background-color: var(--color-surface-container)"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
										</button>
										<button
											onclick={() => deleteEntry(entry.id)}
											aria-label={t.meal_plan_remove}
											class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60 ml-1"
											style="background-color: color-mix(in srgb, #ef4444 15%, var(--color-surface-container))"
										>
											<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
										</button>
									{:else}
										<span class="text-xs font-semibold px-1.5" style="color: var(--color-on-surface-variant)">{entry.servings ?? (entry.recipeServings ?? 2)}P</span>
										<button
											onclick={() => openListSheet([entry.date])}
											aria-label={t.meal_plan_add_to_list}
											class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
										>
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
												<line x1="3" y1="6" x2="21" y2="6"/>
												<path d="M16 10a4 4 0 0 1-8 0"/>
											</svg>
										</button>
									{/if}
								</div>
							</div>
						{/each}
					{/if}
				</div>

				<!-- Right: + button (always visible) -->
				<button
					onclick={() => openPicker(date)}
					aria-label={currentLang() === 'en' ? 'Add meal' : 'Mahlzeit hinzufügen'}
					class="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-xl active:opacity-60 self-start mt-0.5"
					style="color: var(--color-primary)"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</button>

			</div>
		{/each}
	</div>
{/if}

</div><!-- end swipe wrapper -->

<!-- Long-press delete sheet -->
{#if longPressEntry}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => longPressEntry = null}></div>
	<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 pb-8 px-4 select-none"
	     style="background-color: var(--color-surface-low); -webkit-user-select: none">
		<div class="flex justify-center mb-4">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<p class="text-sm font-semibold mb-1 truncate" style="color: var(--color-on-surface)">
			{longPressEntry.recipeTitle ?? longPressEntry.note ?? ''}
		</p>
		<p class="text-xs mb-4" style="color: var(--color-on-surface-variant)">
			{currentLang() === 'en' ? 'Remove from meal plan?' : 'Aus dem Mahlzeitenplan entfernen?'}
		</p>
		<div class="flex gap-3">
			<button
				onclick={() => longPressEntry = null}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>{currentLang() === 'en' ? 'Cancel' : 'Abbrechen'}</button>
			<button
				onclick={confirmDeleteEntry}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
				style="background-color: color-mix(in srgb, #ef4444 18%, var(--color-surface-container)); color: #ef4444"
			>{t.meal_plan_remove}</button>
		</div>
	</div>
{/if}

<!-- Recipe picker bottom sheet -->
{#if pickerOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => { if (!pickerSaving) pickerOpen = false; }}></div>
	<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 flex flex-col"
	     style="background-color: var(--color-surface-low); max-height: 90dvh">
		<div class="flex justify-center mb-3 flex-shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		<div class="px-4 mb-3 flex-shrink-0">
			<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
				{(!pickerEntryId && (entries[pickerTargetDate]?.length ?? 0) > 0) ? t.meal_plan_add_another_title : t.meal_plan_add_title} {dayLabels[weekDays.findIndex(d => toISO(d) === pickerTargetDate)]} · {formatDayDate(weekDays[weekDays.findIndex(d => toISO(d) === pickerTargetDate)])}
			</h2>
		</div>

		<div bind:this={pickerListEl} class="flex-1 overflow-y-auto px-4 space-y-2 min-h-0 pb-3">
			{#if pickerIsFreeText}
				<button onclick={() => { pickerIsFreeText = false; pickerRecipeId = null; }}
				        class="w-full text-left px-1 py-1 text-xs font-medium active:opacity-60"
				        style="color: var(--color-primary)">← {currentLang() === 'en' ? 'Back to recipes' : 'Zurück zu Rezepten'}</button>
				<div class="rounded-2xl px-4 py-3" style="background-color: var(--color-surface-container)">
					<input
						type="text"
						placeholder={t.meal_plan_free_text_placeholder}
						bind:value={pickerFreeText}
						class="w-full bg-transparent outline-none font-medium"
						style="color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
			{:else}
				{#if pickerFilteredRecipes.length === 0}
					<div class="py-8 text-center text-sm" style="color: var(--color-on-surface-variant)">{t.meal_plan_no_results}</div>
				{:else}
					{#each pickerFilteredRecipes as recipe (recipe.id)}
						<button
							onclick={() => selectRecipe(recipe)}
							class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70 transition-opacity text-left"
							style="background-color: {pickerRecipeId === recipe.id ? 'color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-card))' : 'var(--color-surface-card)'}; outline: {pickerRecipeId === recipe.id ? '1.5px solid color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'none'}"
						>
							<div class="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden"
							     style="background-color: var(--color-surface-container)">
								{#if recipe.imageUrl}
									<img src={recipe.imageUrl} alt={recipe.title} class="w-full h-full object-cover" />
								{:else}
									<div class="w-full h-full flex items-center justify-center font-bold text-sm"
									     style="color: var(--color-primary)">{recipe.title[0]?.toUpperCase()}</div>
								{/if}
							</div>
							<span class="flex-1 text-sm font-semibold truncate" style="color: var(--color-on-surface)">{recipe.title}</span>
						</button>
					{/each}
				{/if}
				<button
					onclick={() => { pickerIsFreeText = true; pickerRecipeId = null; pickerServings = 2; }}
					class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70 transition-opacity"
					style="background-color: var(--color-surface-container)"
				>
					<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0">
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
							<polyline points="13 2 13 9 20 9"/>
						</svg>
					</div>
					<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.meal_plan_free_text}</span>
				</button>
			{/if}
		</div>

		<div class="flex-shrink-0 px-4 pt-3 pb-6 space-y-3">
		{#if pickerRecipeId || pickerIsFreeText}
			<div class="space-y-3">
				{#if !pickerEntryId}
					<!-- Multi-day selector only when creating new -->
					<div>
						<p class="text-xs font-semibold mb-2 uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.meal_plan_also_on}</p>
						<div class="flex gap-2 flex-wrap">
							{#each pickerSmartDays as d, i (d)}
								<button
									onclick={() => {
										const s = new Set(pickerSelectedDays);
										if (s.has(d)) { if (s.size > 1) s.delete(d); } else s.add(d);
										pickerSelectedDays = s;
									}}
									class="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all active:opacity-60"
									style="background-color: {pickerSelectedDays.has(d) ? 'color-mix(in srgb, var(--color-primary) 20%, var(--color-surface-container))' : 'var(--color-surface-container)'}; color: {pickerSelectedDays.has(d) ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}; outline: {pickerSelectedDays.has(d) ? '1px solid color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'none'}"
								>{dayLabels[i]}</button>
							{/each}
						</div>
					</div>
				{/if}

				<div class="flex items-center gap-3">
					<div class="flex items-center gap-2 px-3 py-2 rounded-xl" style="background-color: var(--color-surface-container)">
						<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.meal_plan_servings}</span>
						<button onclick={() => pickerServings = Math.max(1, pickerServings - 1)}
						        aria-label="Portionen verringern"
						        class="w-6 h-6 rounded-lg flex items-center justify-center active:opacity-60"
						        style="background-color: var(--color-surface-high)">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="3" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
						<span class="text-sm font-bold w-5 text-center" style="color: var(--color-on-surface)">{pickerServings}</span>
						<button onclick={() => pickerServings++}
						        aria-label="Portionen erhöhen"
						        class="w-6 h-6 rounded-lg flex items-center justify-center active:opacity-60"
						        style="background-color: var(--color-surface-high)">
							<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="3" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
					</div>
					<button
						onclick={savePicker}
						disabled={pickerSaving || (pickerIsFreeText && !pickerFreeText.trim())}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-40 active:opacity-80 transition-opacity"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>
						{#if pickerSaving}
							<div class="flex justify-center">
								<div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--color-on-primary); border-top-color: transparent"></div>
							</div>
						{:else}
							{t.meal_plan_add_button}
						{/if}
					</button>
				</div>
			</div>
		{/if}
			{#if !pickerIsFreeText}
				<div class="flex items-center gap-2 px-3 rounded-xl" style="background-color: var(--color-surface-container); height: 44px">
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
					</svg>
					<input
						type="search"
						placeholder={t.meal_plan_search_placeholder}
						bind:value={pickerSearch}
						class="flex-1 bg-transparent outline-none"
						style="color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
			{/if}
		</div>
	</div>
{/if}

<!-- List selector sheet -->
{#if listSheetOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => { if (!listSheetAdding) listSheetOpen = false; }}></div>
	<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl pt-4 pb-8 flex flex-col"
	     style="background-color: var(--color-surface-low); max-height: 70dvh">
		<div class="flex justify-center mb-3 flex-shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<h2 class="px-4 text-base font-bold mb-3 flex-shrink-0" style="color: var(--color-on-surface)">{t.meal_plan_add_to_list}</h2>
		<div class="flex-1 overflow-y-auto px-4 space-y-2 min-h-0">
			{#if listSheetLoading}
				<div class="flex justify-center py-8">
					<div class="w-5 h-5 rounded-full border-2 animate-spin"
					     style="border-color: var(--color-primary); border-top-color: transparent"></div>
				</div>
			{:else}
				{#if listSheetNewMode}
					<div class="flex items-center gap-2 px-4 py-3 rounded-2xl"
					     style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))">
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="text"
							bind:value={listSheetNewName}
							onkeydown={(e) => { if (e.key === 'Enter') createNewListAndAdd(); if (e.key === 'Escape') listSheetNewMode = false; }}
							class="flex-1 bg-transparent outline-none font-semibold"
							style="color: var(--color-on-surface); font-size: 16px"
							autofocus
						/>
						<button
							onclick={createNewListAndAdd}
							disabled={!listSheetNewName.trim() || listSheetAdding}
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 active:opacity-70"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))"
							aria-label="Erstellen"
						>
							{#if listSheetAdding}
								<div class="w-4 h-4 rounded-full border-2 animate-spin" style="border-color: var(--color-on-primary); border-top-color: transparent"></div>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
							{/if}
						</button>
						<button
							onclick={() => listSheetNewMode = false}
							class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-70"
							style="background-color: var(--color-surface-high)"
							aria-label="Abbrechen"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
						</button>
					</div>
				{:else}
					<button
						onclick={() => listSheetNewMode = true}
						disabled={listSheetAdding}
						class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70 disabled:opacity-40 transition-opacity"
						style="background-color: color-mix(in srgb, var(--color-primary) 12%, var(--color-surface-container))"
					>
						<div class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
						     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</div>
						<span class="text-sm font-semibold" style="color: var(--color-primary)">{currentLang() === 'en' ? 'New list' : 'Neue Liste'}</span>
					</button>
				{/if}

				{#each listSheetLists as list (list.id)}
					<button
						onclick={() => addToList(list.id)}
						disabled={listSheetAdding}
						class="w-full flex items-center gap-3 px-4 py-3 rounded-2xl active:opacity-70 disabled:opacity-40 transition-opacity text-left"
						style="background-color: var(--color-surface-card)"
					>
						<span class="flex-1 text-sm font-medium" style="color: var(--color-on-surface)">{list.name}</span>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</button>
				{/each}
			{/if}
		</div>
	</div>
{/if}
