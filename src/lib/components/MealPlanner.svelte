<script lang="ts">
	import { goto } from '$app/navigation';
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

	let { recipes }: { recipes: RecipeOption[] } = $props();

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

	// --- Plan entries ---
	let entries = $state<Record<string, PlanEntry>>({}); // keyed by date
	let loading = $state(false);

	async function loadWeek() {
		loading = true;
		try {
			const from = toISO(weekDays[0]);
			const to = toISO(weekDays[6]);
			const res = await fetch(`/api/meal-plan?from=${from}&to=${to}`);
			if (!res.ok) return;
			const data: PlanEntry[] = await res.json();
			const map: Record<string, PlanEntry> = {};
			for (const e of data) map[e.date] = e;
			entries = map;
		} finally {
			loading = false;
		}
	}

	$effect(() => {
		// Re-load when week changes — access weekDays to track it
		const _w = weekDays;
		loadWeek();
	});

	// --- Edit mode ---
	let editMode = $state(false);

	// --- Picker sheet ---
	let pickerOpen = $state(false);
	let pickerTargetDate = $state('');
	let pickerSelectedDays = $state<Set<string>>(new Set());
	let pickerRecipeId = $state<string | null>(null);
	let pickerFreeText = $state('');
	let pickerIsFreeText = $state(false);
	let pickerServings = $state(2);
	let pickerSearch = $state('');
	let pickerSaving = $state(false);

	const pickerFilteredRecipes = $derived(
		pickerSearch.trim()
			? recipes.filter(r => r.title.toLowerCase().includes(pickerSearch.toLowerCase()))
			: recipes
	);

	// For multi-day selection: days before the anchor date wrap to next week
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

	function openPicker(date: string) {
		pickerTargetDate = date;
		pickerSelectedDays = new Set([date]);
		pickerRecipeId = null;
		pickerFreeText = '';
		pickerIsFreeText = false;
		pickerServings = 2;
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
			await loadWeek();
			pickerOpen = false;
		} finally {
			pickerSaving = false;
		}
	}

	async function deleteEntry(date: string) {
		await fetch('/api/meal-plan', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ date })
		});
		const next = { ...entries };
		delete next[date];
		entries = next;
	}

	async function updateServings(date: string, delta: number) {
		const entry = entries[date];
		if (!entry) return;
		const newServings = Math.max(1, (entry.servings ?? 1) + delta);
		entries = { ...entries, [date]: { ...entry, servings: newServings } };
		await fetch('/api/meal-plan', {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				date,
				recipeId: entry.recipeId,
				note: entry.note,
				servings: newServings
			})
		});
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

	const hasAnyEntry = $derived(Object.keys(entries).length > 0);

	function handleDayTap(date: string) {
		const entry = entries[date];
		if (!entry) {
			// Leerer Tag → immer Picker öffnen, kein Edit-Modus nötig
			openPicker(date);
		} else if (editMode) {
			// Gefüllter Tag im Edit-Modus → Picker zum Überschreiben
			openPicker(date);
		} else if (entry.recipeId) {
			// Gefüllter Tag mit Rezept → zum Rezept navigieren
			goto(`/rezepte/${entry.recipeId}`);
		}
		// Freitext ohne Rezept im View-Modus → nichts
	}
</script>

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
			onclick={() => openListSheet(weekDays.map(d => toISO(d)).filter(d => !!entries[d]))}
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

	<button
		onclick={() => editMode = !editMode}
		class="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 active:opacity-60 transition-opacity"
		style="background-color: {editMode ? 'color-mix(in srgb, var(--color-primary) 20%, var(--color-surface-container))' : 'var(--color-surface-container)'}; outline: {editMode ? '1.5px solid color-mix(in srgb, var(--color-primary) 40%, transparent)' : 'none'}"
	>
		{#if editMode}
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="20 6 9 17 4 12"/>
			</svg>
		{:else}
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
				<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
			</svg>
		{/if}
	</button>
</div>

<!-- Day cards -->
{#if loading}
	<div class="flex justify-center py-10">
		<div class="w-5 h-5 rounded-full border-2 animate-spin"
		     style="border-color: var(--color-primary); border-top-color: transparent"></div>
	</div>
{:else}
	<div class="space-y-2 pb-4">
		{#each weekDays as day, i (toISO(day))}
			{@const date = toISO(day)}
			{@const entry = entries[date]}
			{@const isToday = toISO(day) === toISO(today)}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				onclick={() => handleDayTap(date)}
				class="flex items-center gap-3 px-4 py-3 rounded-2xl transition-opacity active:opacity-70"
				style="background-color: var(--color-surface-card); cursor: pointer"
			>
				<!-- Day label -->
				<div class="flex-shrink-0 w-10 text-center">
					<div class="text-xs font-semibold uppercase tracking-wide" style="color: {isToday ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}">{dayLabels[i]}</div>
					<div class="text-[11px] mt-0.5" style="color: {isToday ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}; opacity: {isToday ? 1 : 0.7}">{formatDayDate(day)}</div>
				</div>

				<!-- Content -->
				<div class="flex-1 min-w-0">
					{#if entry}
						<div class="flex items-center gap-2.5">
							{#if entry.recipeId}
								<!-- Recipe thumbnail -->
								<div class="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden"
								     style="background-color: var(--color-surface-container)">
									{#if entry.recipeImageUrl}
										<img src={entry.recipeImageUrl} alt="" class="w-full h-full object-cover" />
									{:else}
										<div class="w-full h-full flex items-center justify-center text-sm font-bold"
										     style="color: var(--color-primary)">{entry.recipeTitle?.[0]?.toUpperCase() ?? '?'}</div>
									{/if}
								</div>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.recipeTitle}</div>
								</div>
							{:else}
								<!-- Free text with icon -->
								<div class="w-9 h-9 rounded-xl flex-shrink-0 overflow-hidden flex items-center justify-center"
								     style="background-color: var(--color-surface-container)">
									<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
										<path d="M4 21H20V17C21 14 23 12 22 9C21 6 19 4 17 4C16 4 15 8 15 8C14 6 13 3 12 3C11 3 10 6 9 8C9 8 8 6 7 4C5 4 3 6 2 9C1 12 3 14 4 17Z"/>
									</svg>
								</div>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.note}</div>
								</div>
							{/if}
						</div>
					{:else}
						<!-- Empty -->
						<div class="text-sm" style="color: var(--color-primary); opacity: 0.65">{t.meal_plan_empty_day}</div>
					{/if}
				</div>

				<!-- Right side: servings stepper + actions -->
				{#if entry}
					<div class="flex items-center gap-1.5 flex-shrink-0" onclick={(e) => e.stopPropagation()}>
						{#if editMode}
						<!-- Servings stepper (nur im Edit-Modus) -->
						<button
							onclick={() => updateServings(date, -1)}
							aria-label="Portionen verringern"
							class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
							style="background-color: var(--color-surface-container)"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
						<span class="text-xs font-semibold w-4 text-center" style="color: var(--color-on-surface)">{entry.servings ?? (entry.recipeServings ?? 2)}</span>
						<button
							onclick={() => updateServings(date, 1)}
							aria-label="Portionen erhöhen"
							class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60"
							style="background-color: var(--color-surface-container)"
						>
							<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
						</button>
						{:else}
						<!-- Portionen-Anzeige (nur lesen, im View-Modus) -->
						<span class="text-xs font-semibold px-1.5" style="color: var(--color-on-surface-variant)">{entry.servings ?? (entry.recipeServings ?? 2)}P</span>
						{/if}

						{#if editMode}
							<!-- Delete -->
							<button
								onclick={() => deleteEntry(date)}
								aria-label={t.meal_plan_remove}
								class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60 ml-1"
								style="background-color: color-mix(in srgb, #ef4444 15%, var(--color-surface-container))"
							>
								<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							</button>
						{:else}
							<!-- Cart icon -->
							<button
								onclick={() => openListSheet([date])}
								aria-label={t.meal_plan_add_to_list}
								class="w-7 h-7 rounded-lg flex items-center justify-center active:opacity-60 ml-1"
								style="background-color: color-mix(in srgb, var(--color-primary) 15%, var(--color-surface-container))"
							>
								<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
									<line x1="3" y1="6" x2="21" y2="6"/>
									<path d="M16 10a4 4 0 0 1-8 0"/>
								</svg>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
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
				{t.meal_plan_add_title} {dayLabels[weekDays.findIndex(d => toISO(d) === pickerTargetDate)]} · {formatDayDate(weekDays[weekDays.findIndex(d => toISO(d) === pickerTargetDate)])}
			</h2>
		</div>

		<!-- Recipe list (scrollable) — recipes + free text as last item -->
		<div class="flex-1 overflow-y-auto px-4 space-y-2 min-h-0 pb-3">
			{#if pickerIsFreeText}
				<!-- Free text input mode -->
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
				<!-- Free text as last item in list -->
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

		<!-- Fixed bottom: (if selected) multi-day + servings + add, then search -->
		<div class="flex-shrink-0 px-4 pt-3 pb-6 space-y-3">
		<!-- Multi-day + servings + save -->
		{#if pickerRecipeId || pickerIsFreeText}
			<div class="space-y-3">
				<!-- Multi-day selector -->
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

				<!-- Servings + Add -->
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
			<!-- Search bar always at the very bottom -->
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
				<!-- Neue Liste anlegen -->
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
