<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import MealEditSheet from '$lib/components/supplements/MealEditSheet.svelte';
	import NutritionGoalSheet from '$lib/components/supplements/NutritionGoalSheet.svelte';
	import { toLocalDateKey } from '$lib/dates';
	import { t, currentLang } from '$lib/i18n.svelte';

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
		void load();
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
		if (!confirm(t.nutrition_confirm_delete)) return;
		const res = await fetch(`/api/nutrition/meals/${id}`, { method: 'DELETE' });
		if (res.ok) await load();
	}

	function percentKcal(): number {
		if (!goalKcal) return 0;
		return Math.min(100, (totals.kcal / goalKcal) * 100);
	}

	function fabClick() {
		openNewMeal();
	}
</script>

<AppHeader title={t.nutrition_label} onMenuOpen={() => (menuOpen = true)} onBack={() => goto('/tracker')}>
	{#snippet actions()}
		<button
			onclick={() => goto('/tracker/nutrition/favorites')}
			class="w-9 h-9 flex-shrink-0 flex items-center justify-center active:opacity-60 transition-opacity"
			aria-label={t.nutrition_favorites_manage}
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="#FB923C" stroke="#FB923C" stroke-width="2" stroke-linejoin="round">
				<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
			</svg>
		</button>
	{/snippet}
</AppHeader>
<HamburgerMenu bind:open={menuOpen} user={data?.user ?? null} />

<main class="px-4 pb-32" style="padding-top: 5.25rem">
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

	<!-- Tages-Summary -->
	<div class="rounded-2xl p-4 mb-4"
	     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
		<div class="flex items-baseline justify-between mb-2">
			<div>
				<div class="text-2xl font-semibold tabular-nums" style="color: var(--color-on-surface)">
					{fmtKcal(totals.kcal)}
					<span class="text-base font-normal" style="color: var(--color-on-surface-variant)">kcal</span>
					{#if goalKcal}
						<span class="text-xs font-normal" style="color: var(--color-on-surface-variant)">/ {fmtKcal(goalKcal)} kcal</span>
					{/if}
				</div>
			</div>
			<button onclick={() => (goalSheetOpen = true)}
			        class="text-xs px-2 py-1 active:opacity-60"
			        style="color: #FB923C">
				{t.nutrition_goal_button}
			</button>
		</div>
		{#if goalKcal}
			<div class="rounded-full h-2 overflow-hidden mb-3"
			     style="background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent)">
				<div class="h-full transition-all" style="width: {percentKcal()}%; background-color: {totals.kcal > goalKcal ? '#EF4444' : '#FB923C'}"></div>
			</div>
		{/if}
		{#if !goalKcal && !goalProtein && !goalFat && !goalCarbs && !goalFiber}
			<button onclick={() => (goalSheetOpen = true)}
			        class="w-full py-2 rounded-full text-sm font-medium active:opacity-70"
			        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: #FB923C">
				+ {t.nutrition_set_goal_cta}
			</button>
		{:else}
		<div class="grid grid-cols-4 gap-2">
			{#each [
				{ label: t.nutrition_protein, value: totals.protein, goal: goalProtein, goalType: 'min' as const, tint: '#9F7AEA' },
				{ label: t.nutrition_fat, value: totals.fat, goal: goalFat, goalType: 'max' as const, tint: '#FB923C' },
				{ label: t.nutrition_carbs, value: totals.carbs, goal: goalCarbs, goalType: 'max' as const, tint: '#60A5FA' },
				{ label: t.nutrition_fiber, value: totals.fiber, goal: goalFiber, goalType: 'min' as const, tint: 'var(--color-primary)' }
			] as macro}
				{@const ratio = macro.goal && macro.goal > 0 ? macro.value / macro.goal : 0}
				{@const pct = Math.min(100, ratio * 100)}
				{@const over = macro.goal && ratio > 1}
				{@const color = macro.goalType === 'max' && over ? '#EF4444' : macro.tint}
				{@const r = 22}
				{@const c = 2 * Math.PI * r}
				<div class="flex flex-col items-center">
					<div class="relative" style="width: 56px; height: 56px">
						<svg width="56" height="56" viewBox="0 0 56 56" style="transform: rotate(-90deg)">
							<circle cx="28" cy="28" r={r} fill="none" stroke="color-mix(in srgb, var(--color-on-surface) 10%, transparent)" stroke-width="4"/>
							{#if macro.goal}
								<circle cx="28" cy="28" r={r} fill="none"
								        stroke={color} stroke-width="4"
								        stroke-linecap="round"
								        stroke-dasharray={c}
								        stroke-dashoffset={c - (c * pct) / 100}
								        style="transition: stroke-dashoffset 0.3s"/>
							{/if}
						</svg>
						<div class="absolute inset-0 flex items-center justify-center">
							<span class="text-xs font-semibold tabular-nums" style="color: var(--color-on-surface)">{fmtG(macro.value)}<span class="text-[9px] font-normal" style="color: var(--color-on-surface-variant)">g</span></span>
						</div>
					</div>
					<div class="text-[10px] mt-1" style="color: var(--color-on-surface-variant)">{macro.label}{#if macro.goal}<span class="opacity-60"> / {macro.goal}g</span>{/if}</div>
				</div>
			{/each}
		</div>
		{/if}
	</div>

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
		<div class="flex flex-col gap-2">
			{#each meals as m (m.id)}
				{@const mealKcal = m.components.reduce((s, c) => s + (c.kcal ?? 0), 0)}
				{@const mealP = m.components.reduce((s, c) => s + (c.protein ?? 0), 0)}
				{@const mealF = m.components.reduce((s, c) => s + (c.fat ?? 0), 0)}
				{@const mealC = m.components.reduce((s, c) => s + (c.carbs ?? 0), 0)}
				{@const singleImg = !m.favoriteName && m.components.length === 1 ? m.components[0].imageUrl : null}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="rounded-2xl p-3 active:opacity-80 cursor-pointer"
				     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
				     onclick={() => openEditMeal(m)}>
					<div class="flex items-center gap-2">
						<span class="text-xs tabular-nums" style="color: var(--color-on-surface-variant); min-width: 38px">{m.time}</span>
						<span class="font-semibold flex-1 truncate" style="color: var(--color-on-surface)">{m.name}</span>
						<span class="text-sm font-medium tabular-nums shrink-0" style="color: #FB923C">{fmtKcal(mealKcal)} kcal</span>
						<button onclick={(e) => { e.stopPropagation(); deleteMeal(m.id); }}
						        class="opacity-40 active:opacity-100 text-sm w-7 h-7 flex items-center justify-center shrink-0"
						        aria-label={t.nutrition_remove}>✕</button>
					</div>
					<div class="text-[11px] tabular-nums leading-none" style="color: var(--color-on-surface-variant); margin-left: 46px; margin-top: -2px">
						{t.nutrition_protein.charAt(0)} {fmtG(mealP)}g · {t.nutrition_fat.charAt(0)} {fmtG(mealF)}g · {t.nutrition_carbs.charAt(0)} {fmtG(mealC)}g
					</div>
					{#if m.favoriteName}
						<div class="flex items-center gap-[14px]" style="margin-top: -3px">
							{#if m.imageUrl}
								<img src={m.imageUrl} alt="" class="w-8 h-8 rounded-lg object-cover bg-black/5 shrink-0" />
							{:else}
								<div class="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-semibold shrink-0"
								     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
									{m.favoriteName.slice(0, 1).toUpperCase()}
								</div>
							{/if}
							<span class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{m.favoriteName}</span>
						</div>
					{/if}
						{#if singleImg}
						<div class="flex items-center gap-[14px] mt-2">
							<img src={singleImg} alt="" class="w-8 h-8 rounded-lg object-cover bg-black/5 shrink-0" />
							<span class="flex-1 truncate text-xs" style="color: var(--color-on-surface-variant)">
								{m.components[0].displayName}
								<span class="opacity-60">· {m.components[0].amount}{m.components[0].unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : m.components[0].unit}</span>
							</span>
							<span class="tabular-nums shrink-0 text-xs" style="color: var(--color-on-surface-variant)">{fmtKcal(m.components[0].kcal)} kcal</span>
						</div>
					{:else if m.components.length > 0}
						<div class="flex flex-col gap-0.5" style="margin-left: 46px; margin-top: {m.favoriteName ? '-2px' : '0.375rem'}">
							{#each m.components as c (c.id)}
								<div class="flex items-center gap-2 text-xs">
									<span class="flex-1 truncate" style="color: var(--color-on-surface-variant)">
										{c.displayName}
										<span class="opacity-60">· {c.amount}{c.unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : c.unit}</span>
									</span>
									<span class="tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">{fmtKcal(c.kcal)} kcal</span>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{/if}
</main>

<AppBottomNav activeTab="tracker" onFabTap={fabClick} fabLabel={t.nutrition_add_meal} fabColor="#FB923C" />

{#if editSheetOpen && editingMeal}
	<MealEditSheet
		meal={editingMeal}
		onclose={() => { editSheetOpen = false; editingMeal = null; }}
		onsaved={() => { editSheetOpen = false; editingMeal = null; void load(); }}
	/>
{/if}

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
