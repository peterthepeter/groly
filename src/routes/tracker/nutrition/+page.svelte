<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import MealEditSheet from '$lib/components/supplements/MealEditSheet.svelte';
	import NutritionGoalSheet from '$lib/components/supplements/NutritionGoalSheet.svelte';
	import NutritionMacroStrip from '$lib/components/supplements/NutritionMacroStrip.svelte';
	import TrackerSectionNav from '$lib/components/supplements/TrackerSectionNav.svelte';
	import { toLocalDateKey } from '$lib/dates';
	import { userSettings } from '$lib/userSettings.svelte';
	import { t, currentLang, nutrition_kcal_over, nutrition_kcal_remaining, nutrition_of_goal } from '$lib/i18n.svelte';

	type Component = {
		id: string;
		sortOrder: number;
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
		kcal: number;
		protein: number;
		fat: number;
		carbs: number;
		sugar: number;
		fiber: number;
		salt: number;
	};
	type Meal = { id: string; name: string; date: string; time: string; components: Component[]; imageUrl?: string | null; favoriteName?: string | null };

	let { data } = $props();

	let menuOpen = $state(false);
	let dateStr = $state(
		(() => {
			const param = $page.url.searchParams.get('date');
			return param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : toLocalDateKey(new Date());
		})()
	);
	let meals = $state<Meal[]>([]);
	let goalKcal = $state<number | null>(null);
	let goalProtein = $state<number | null>(null);
	let goalFat = $state<number | null>(null);
	let goalCarbs = $state<number | null>(null);
	let goalFiber = $state<number | null>(null);
	let loading = $state(true);
	let editSheetOpen = $state(false);
	let editingMeal = $state<Meal | null>(null);
	let goalSheetOpen = $state(false);

	const todayStr = toLocalDateKey(new Date());
	const isToday = $derived(dateStr === todayStr);

	function shiftDate(days: number) {
		const d = new Date(dateStr + 'T00:00:00');
		d.setDate(d.getDate() + days);
		dateStr = toLocalDateKey(d);
	}

	function formatDate(s: string): string {
		const d = new Date(s + 'T00:00:00');
		if (s === todayStr) return t.nutrition_today;
		const yest = new Date(); yest.setDate(yest.getDate() - 1);
		if (s === toLocalDateKey(yest)) return t.nutrition_yesterday;
		return d.toLocaleDateString(currentLang(), { weekday: 'short', day: 'numeric', month: 'long' });
	}

	async function load() {
		loading = true;
		try {
			const [mealsRes, goalsRes] = await Promise.all([
				fetch(`/api/nutrition/meals?date=${dateStr}`),
				fetch('/api/nutrition/goals')
			]);
			if (mealsRes.ok) {
				const d = await mealsRes.json();
				meals = d.meals ?? [];
			}
			if (goalsRes.ok) {
				const d = await goalsRes.json();
				goalKcal = d.goals?.dailyKcal ?? null;
				goalProtein = d.goals?.dailyProtein ?? null;
				goalFat = d.goals?.dailyFat ?? null;
				goalCarbs = d.goals?.dailyCarbs ?? null;
				goalFiber = d.goals?.dailyFiber ?? null;
			}
		} catch {
			// noop
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get('new') === '1') {
			openNewMeal();
			const url = new URL(window.location.href);
			url.searchParams.delete('new');
			history.replaceState(history.state, '', url.pathname + url.search);
		}
	});

	$effect(() => {
		// Reload when date changes
		void dateStr;
		load();
	});

	const totals = $derived.by(() => {
		const t = { kcal: 0, protein: 0, fat: 0, carbs: 0, sugar: 0, fiber: 0, salt: 0 };
		for (const m of meals) {
			for (const c of m.components) {
				t.kcal += c.kcal ?? 0;
				t.protein += c.protein ?? 0;
				t.fat += c.fat ?? 0;
				t.carbs += c.carbs ?? 0;
				t.sugar += c.sugar ?? 0;
				t.fiber += c.fiber ?? 0;
				t.salt += c.salt ?? 0;
			}
		}
		return t;
	});

	function fmtKcal(v: number): string { return Math.round(v).toLocaleString(currentLang()); }
	function fmtG(v: number): string { return v < 10 ? v.toFixed(1) : Math.round(v).toString(); }

	function defaultMealName(time: string): string {
		const [h, m] = time.split(':').map(Number);
		const minutes = h * 60 + (m || 0);
		if (minutes < 4 * 60) return t.meal_name_snack;
		if (minutes <= 10 * 60 + 30) return t.meal_name_breakfast;
		if (minutes <= 14 * 60 + 30) return t.meal_name_lunch;
		if (minutes <= 17 * 60 + 30) return t.meal_name_vesper;
		if (minutes <= 22 * 60) return t.meal_name_dinner;
		return t.meal_name_snack;
	}

	function openNewMeal() {
		const now = new Date();
		const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		editingMeal = {
			id: '',
			name: defaultMealName(time),
			date: dateStr,
			time,
			components: []
		};
		editSheetOpen = true;
	}

	function openEditMeal(m: Meal) {
		editingMeal = m;
		editSheetOpen = true;
	}

	async function deleteMeal(id: string) {
		if (!confirm(t.nutrition_confirm_delete)) return false;
		const res = await fetch(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
		if (res.ok) await load();
		return res.ok;
	}

	function percentKcal(): number {
		if (!goalKcal) return 0;
		return Math.min(100, (totals.kcal / goalKcal) * 100);
	}

	const macroItems = $derived([
		{ label: t.nutrition_protein, value: totals.protein, goal: goalProtein, goalType: 'min' as const },
		{ label: t.nutrition_fat, value: totals.fat, goal: goalFat, goalType: 'max' as const },
		{ label: t.nutrition_carbs, value: totals.carbs, goal: goalCarbs, goalType: 'max' as const },
		{ label: t.nutrition_fiber, value: totals.fiber, goal: goalFiber, goalType: 'min' as const }
	]);

	const kcalStatus = $derived.by(() => {
		if (!goalKcal) return null;
		const delta = Math.round(Math.abs(goalKcal - totals.kcal)).toLocaleString(currentLang());
		return totals.kcal > goalKcal ? nutrition_kcal_over(delta) : nutrition_kcal_remaining(delta);
	});

	function fabClick() {
		openNewMeal();
	}
</script>

<AppHeader title={t.nutrition_label} onMenuOpen={() => (menuOpen = true)} onBack={() => goto('/tracker')}>
	{#snippet actions()}
		<button
			onclick={() => goto('/tracker/nutrition/favorites')}
			class="min-h-10 flex-shrink-0 px-2 flex items-center justify-center text-xs font-semibold active:opacity-60 transition-opacity"
			style="color: var(--color-on-surface-variant)"
			aria-label={t.nutrition_favorites_manage}
		>
			{t.nutrition_favorites_label}
		</button>
	{/snippet}
</AppHeader>
<HamburgerMenu bind:open={menuOpen} user={data?.user ?? null} />

<div class="px-4 pb-3" style="padding-top: 5.25rem">
	<TrackerSectionNav activeSection="nutrition" nutritionEnabled={userSettings.nutritionTrackerEnabled} />
</div>

<main class="px-4 pb-32">
	<!-- Datums-Navigation -->
	<div class="flex items-center justify-between mb-4">
		<button onclick={() => shiftDate(-1)} class="w-9 h-9 flex items-center justify-center active:opacity-50"
		        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_prev_day}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="15 18 9 12 15 6"/>
			</svg>
		</button>
		<div class="text-center">
			<div style="position: relative; display: inline-block">
				<span class="text-sm font-semibold select-none" style="color: var(--color-on-surface); pointer-events: none">{formatDate(dateStr)}</span>
				<input type="date" bind:value={dateStr} max={todayStr}
				       style="position: absolute; inset: 0; width: 100%; height: 100%; opacity: 0.001; cursor: pointer; border: none; padding: 0; background: transparent"
				       aria-label={t.nutrition_pick_date} />
			</div>
			{#if !isToday}
				<button onclick={() => (dateStr = todayStr)} class="block mx-auto text-xs underline mt-0.5" style="color: #FB923C">
					{t.nutrition_jump_today}
				</button>
			{/if}
		</div>
		<button onclick={() => shiftDate(1)} disabled={isToday}
		        class="w-9 h-9 flex items-center justify-center active:opacity-50 disabled:opacity-25"
		        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_next_day}>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<polyline points="9 18 15 12 9 6"/>
			</svg>
		</button>
	</div>

	<!-- Tagesbilanz -->
	<section class="nutrition-summary">
		<div class="nutrition-summary-head">
			<div class="min-w-0">
				<div class="nutrition-kcal-value">
					{fmtKcal(totals.kcal)} <span>kcal</span>
				</div>
				{#if goalKcal}
					<p class="nutrition-goal-copy">{nutrition_of_goal(`${fmtKcal(goalKcal)} kcal`)}</p>
				{:else}
					<p class="nutrition-goal-copy">{t.nutrition_no_goal_set}</p>
				{/if}
			</div>
			<div class="nutrition-summary-actions">
				{#if kcalStatus}<span class="nutrition-kcal-status" data-over={totals.kcal > (goalKcal ?? 0)}>{kcalStatus}</span>{/if}
				<button onclick={() => (goalSheetOpen = true)}>{t.nutrition_goals_button}</button>
			</div>
		</div>
		{#if goalKcal}
			<div class="nutrition-kcal-track">
				<div style="width: {percentKcal()}%; background-color: {totals.kcal > goalKcal ? 'var(--color-error)' : '#FB923C'}"></div>
			</div>
		{/if}
		{#if !goalKcal && !goalProtein && !goalFat && !goalCarbs && !goalFiber}
			<button onclick={() => (goalSheetOpen = true)}
			        class="nutrition-empty-goal-action">
				+ {t.nutrition_set_goal_cta}
			</button>
		{:else}
			<NutritionMacroStrip items={macroItems} />
		{/if}
	</section>

	<!-- Mahlzeiten -->
	{#if loading}
		<div class="flex justify-center py-12">
			<div class="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
			     style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if meals.length === 0}
		<div class="text-center py-12">
			<p class="text-sm" style="color: var(--color-on-surface-variant)">
				{t.nutrition_no_meals}
			</p>
		</div>
	{:else}
		<section class="nutrition-day-log" aria-label={t.nutrition_meals_section}>
			{#each meals as m (m.id)}
				{@const mealKcal = m.components.reduce((s, c) => s + (c.kcal ?? 0), 0)}
				{@const mealP = m.components.reduce((s, c) => s + (c.protein ?? 0), 0)}
				{@const mealF = m.components.reduce((s, c) => s + (c.fat ?? 0), 0)}
				{@const mealC = m.components.reduce((s, c) => s + (c.carbs ?? 0), 0)}
				{@const singleImg = !m.favoriteName && m.components.length === 1 ? m.components[0].imageUrl : null}
				<button type="button" class="nutrition-meal-entry" onclick={() => openEditMeal(m)}>
					<span class="nutrition-meal-time">{m.time}</span>
					<span class="nutrition-meal-content">
						<span class="nutrition-meal-heading">
							<span>{m.name}</span>
							<strong>{fmtKcal(mealKcal)} kcal</strong>
						</span>
						<span class="nutrition-meal-macros">
							{t.nutrition_protein.charAt(0)} {fmtG(mealP)} g · {t.nutrition_fat.charAt(0)} {fmtG(mealF)} g · {t.nutrition_carbs.charAt(0)} {fmtG(mealC)} g
						</span>
					{#if m.favoriteName}
						<span class="nutrition-meal-favorite">
							{#if m.imageUrl}
								<img src={m.imageUrl} alt="" />
							{/if}
							<span>{m.favoriteName}</span>
						</span>
					{/if}
					{#if singleImg}
						<span class="nutrition-component-row nutrition-component-row-image">
							<img src={singleImg} alt="" />
							<span>
								{m.components[0].displayName}
								<small>· {m.components[0].amount}{m.components[0].unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : m.components[0].unit}</small>
							</span>
							<strong>{fmtKcal(m.components[0].kcal)} kcal</strong>
						</span>
					{:else if m.components.length > 0}
						<span class="nutrition-component-list">
							{#each m.components as c (c.id)}
								<span class="nutrition-component-row">
									<span>
										{c.displayName}
										<small>· {c.amount}{c.unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : c.unit}</small>
									</span>
									<strong>{fmtKcal(c.kcal)} kcal</strong>
								</span>
							{/each}
						</span>
					{/if}
					</span>
				</button>
			{/each}
		</section>
	{/if}
</main>

<AppBottomNav activeTab="tracker" trackerBack onFabTap={fabClick} fabLabel={t.nutrition_add_meal} fabColor="#FB923C" />

{#if editSheetOpen && editingMeal}
	<MealEditSheet
		meal={editingMeal}
		ondelete={editingMeal.id ? async () => { if (editingMeal && await deleteMeal(editingMeal.id)) { editSheetOpen = false; editingMeal = null; } } : null}
		onclose={() => { editSheetOpen = false; editingMeal = null; }}
		onsaved={() => { editSheetOpen = false; editingMeal = null; void load(); }}
	/>
{/if}

<style>
	.nutrition-summary,
	.nutrition-day-log {
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: 20px;
		background: var(--bubble-container-bg);
	}

	.nutrition-summary { margin-bottom: 14px; padding: 14px 15px 15px; }

	.nutrition-summary-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 11px;
	}

	.nutrition-kcal-value {
		color: var(--color-on-surface);
		font-size: 26px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		letter-spacing: -0.025em;
		line-height: 1;
	}

	.nutrition-kcal-value span { color: var(--color-on-surface-variant); font-size: 14px; font-weight: 500; letter-spacing: 0; }
	.nutrition-goal-copy { margin-top: 5px; color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.2; }

	.nutrition-summary-actions { display: grid; justify-items: end; gap: 5px; }
	.nutrition-summary-actions button { min-height: 32px; padding-inline: 10px; border-radius: 10px; color: #FB923C; font-size: 12px; font-weight: 650; }
	.nutrition-summary-actions button:active { background: color-mix(in srgb, #FB923C 9%, transparent); }
	.nutrition-kcal-status { max-width: 145px; overflow: hidden; color: #FB923C; font-size: 10px; font-weight: 600; line-height: 1.15; text-align: right; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-kcal-status[data-over='true'] { color: var(--color-error); }

	.nutrition-kcal-track { height: 3px; margin-bottom: 13px; overflow: hidden; border-radius: 999px; background: color-mix(in srgb, var(--color-on-surface) 9%, transparent); }
	.nutrition-kcal-track div { height: 100%; border-radius: inherit; transition: width 180ms cubic-bezier(0.2, 0.8, 0.2, 1); }

	.nutrition-empty-goal-action { width: 100%; min-height: 40px; border-radius: 10px; background: var(--bubble-interactive-bg); color: #FB923C; font-size: 13px; font-weight: 650; }

	.nutrition-day-log { display: flex; flex-direction: column; }
	.nutrition-meal-entry { display: grid; grid-template-columns: 48px minmax(0, 1fr); min-height: 64px; padding: 12px 12px 12px 11px; text-align: left; touch-action: manipulation; }
	.nutrition-meal-entry + .nutrition-meal-entry { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-meal-entry:active { background: color-mix(in srgb, #FB923C 5%, transparent); }

	.nutrition-meal-time { padding-top: 2px; color: var(--color-on-surface-variant); font-size: 11px; font-variant-numeric: tabular-nums; }
	.nutrition-meal-content { display: grid; min-width: 0; gap: 4px; }
	.nutrition-meal-heading { display: flex; min-width: 0; align-items: baseline; gap: 8px; }
	.nutrition-meal-heading > span { overflow: hidden; min-width: 0; flex: 1; color: var(--color-on-surface); font-size: 14px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-meal-heading strong { flex: none; color: #FB923C; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-meal-macros { color: var(--color-on-surface-variant); font-size: 10px; font-variant-numeric: tabular-nums; line-height: 1.2; }

	.nutrition-meal-favorite { display: flex; min-width: 0; align-items: center; gap: 7px; margin-top: 3px; color: var(--color-on-surface); font-size: 12px; font-weight: 600; }
	.nutrition-meal-favorite img { width: 24px; height: 24px; flex: none; border-radius: 7px; object-fit: cover; }
	.nutrition-meal-favorite span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

	.nutrition-component-list { display: grid; gap: 3px; margin-top: 3px; }
	.nutrition-component-row { display: flex; min-width: 0; align-items: baseline; gap: 8px; color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.2; }
	.nutrition-component-row > span { overflow: hidden; min-width: 0; flex: 1; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-component-row small { opacity: 0.62; font-size: inherit; }
	.nutrition-component-row strong { flex: none; font-weight: 500; font-variant-numeric: tabular-nums; }
	.nutrition-component-row-image { align-items: center; margin-top: 4px; }
	.nutrition-component-row-image img { width: 26px; height: 26px; flex: none; border-radius: 7px; object-fit: cover; }

	@media (max-width: 360px) {
		.nutrition-summary { padding-inline: 13px; }
		.nutrition-kcal-value { font-size: 24px; }
		.nutrition-kcal-status { max-width: 116px; }
		.nutrition-meal-entry { grid-template-columns: 43px minmax(0, 1fr); padding-inline: 10px; }
	}

	@media (prefers-reduced-motion: reduce) {
		.nutrition-kcal-track div { transition: none; }
	}
</style>

{#if goalSheetOpen}
	<NutritionGoalSheet
		initialKcal={goalKcal}
		initialProtein={goalProtein}
		initialFat={goalFat}
		initialCarbs={goalCarbs}
		initialFiber={goalFiber}
		onclose={() => (goalSheetOpen = false)}
		onsaved={() => { goalSheetOpen = false; void load(); }}
	/>
{/if}
