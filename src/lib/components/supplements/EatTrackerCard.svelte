<script lang="ts">
	import { goto } from '$app/navigation';
	import { t, currentLang, nutrition_meals_count } from '$lib/i18n.svelte';
	import TrackerTileShell from './TrackerTileShell.svelte';

	type Meal = {
		id: string;
		name: string;
		time: string;
		components: { kcal: number; protein?: number; fat?: number; carbs?: number; fiber?: number }[];
	};

	let {
		meals = [],
		goalKcal = null as number | null,
		goalProtein = null as number | null,
		goalFat = null as number | null,
		goalCarbs = null as number | null,
		goalFiber = null as number | null,
		embedded = false,
		tileMode = false,
		expanded = $bindable(false)
	}: {
		meals: Meal[];
		goalKcal: number | null;
		goalProtein?: number | null;
		goalFat?: number | null;
		goalCarbs?: number | null;
		goalFiber?: number | null;
		embedded?: boolean;
		tileMode?: boolean;
		expanded?: boolean;
	} = $props();

	function sumComponent(key: 'kcal' | 'protein' | 'fat' | 'carbs' | 'fiber'): number {
		return meals.reduce((sum, m) => sum + m.components.reduce((s, c) => s + (c[key] ?? 0), 0), 0);
	}

	const totalKcal = $derived(sumComponent('kcal'));
	const rounded = $derived(Math.round(totalKcal));
	const percent = $derived(goalKcal && goalKcal > 0 ? Math.min(100, (totalKcal / goalKcal) * 100) : 0);

	// Kompakte Makro-Ringe (44px) – gleiche Farben/Logik wie die Ringe auf der Detailseite:
	// Eiweiß/Ballaststoffe als 'min'-Ziel, Fett/KH als 'max' (Überschreitung wird rot).
	const macros = $derived([
		{ label: t.nutrition_protein, value: sumComponent('protein'), goal: goalProtein, goalType: 'min', color: '#9F7AEA' },
		{ label: t.nutrition_fat, value: sumComponent('fat'), goal: goalFat, goalType: 'max', color: '#FB923C' },
		{ label: t.nutrition_carbs, value: sumComponent('carbs'), goal: goalCarbs, goalType: 'max', color: '#60A5FA' },
		{ label: t.nutrition_fiber, value: sumComponent('fiber'), goal: goalFiber, goalType: 'min', color: 'var(--color-primary)' }
	]);

	function fmtG(v: number): string {
		return v < 10 ? v.toFixed(1) : Math.round(v).toString();
	}

	function go() {
		goto('/tracker/nutrition');
	}

	function fmtKcal(kcal: number): string {
		return kcal.toLocaleString(currentLang());
	}
</script>

{#if tileMode}
	<TrackerTileShell accent="#FB923C" title={t.nutrition_label} expandable={meals.length > 0} bind:expanded onactivate={go}>
		{#snippet headerMeta()}<span>{nutrition_meals_count(meals.length)}</span>{/snippet}
		{#snippet body()}
			<div class="h-7 pl-3.5 grid grid-cols-4 gap-1">
				{#each macros as macro}
					{@const ratio = macro.goal && macro.goal > 0 ? macro.value / macro.goal : 0}
					{@const pct = macro.goal ? Math.min(100, ratio * 100) : 100}
					{@const over = macro.goal && ratio > 1}
					{@const color = macro.goalType === 'max' && over ? '#EF4444' : macro.color}
					<div class="min-w-0 flex flex-col justify-center">
						<p class="text-[8px] leading-none truncate" style="color: var(--color-on-surface-variant)">{macro.label}</p>
						<div class="flex items-end gap-1 mt-0.5">
							<p class="text-[10px] leading-none font-semibold tabular-nums truncate" style="color: var(--color-on-surface)">{fmtG(macro.value)}g</p>
						</div>
						<div class="h-0.5 rounded-full overflow-hidden mt-0.5" style="background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent)"><div class="h-full rounded-full" style="width: {pct}%; background-color: {color}"></div></div>
					</div>
				{/each}
			</div>
			<div class="h-8 pt-1 flex flex-col justify-end">
				<div class="h-[18px] flex items-center justify-between gap-1 text-[11px] leading-none tabular-nums">
					<span style="color: var(--color-on-surface-variant)">kcal</span>
					<span class="font-normal" style="color: var(--color-on-surface)">{fmtKcal(rounded)}{#if goalKcal}<span style="color: var(--color-on-surface-variant)"> / {fmtKcal(goalKcal)}</span>{/if}</span>
				</div>
				<div class="h-1.5 rounded-full overflow-hidden" style="background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent)"><div class="h-full rounded-full transition-all" style="width: {percent}%; background-color: {percent >= 100 ? '#EF4444' : '#FB923C'}"></div></div>
			</div>
		{/snippet}
		{#snippet details()}
			{#if meals.length > 0}
				<div class="flex flex-col gap-1">
					{#each meals.slice(0, 4) as m (m.id)}
						{@const kcal = Math.round(m.components.reduce((sum, component) => sum + (component.kcal ?? 0), 0))}
						<button type="button" onclick={(event) => { event.stopPropagation(); go(); }} class="flex items-center gap-2 text-sm text-left active:opacity-70">
							<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant); min-width: 38px">{m.time}</span>
							<span class="flex-1 truncate" style="color: var(--color-on-surface)">{m.name}</span>
							<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">{fmtKcal(kcal)} kcal</span>
						</button>
					{/each}
					{#if meals.length > 4}<div class="text-[11px] pt-0.5" style="color: var(--color-on-surface-variant)">+ {meals.length - 4}</div>{/if}
				</div>
			{:else}
				<div class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_empty_today_hint}</div>
			{/if}
		{/snippet}
	</TrackerTileShell>
{:else}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="overflow-hidden {embedded ? '' : 'rounded-2xl'}"
	style={embedded ? '' : 'background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)'}
>
	<!-- Header: click navigates, chevron toggles -->
	<div class="flex items-center gap-2 px-4 pt-3 pb-2 cursor-pointer active:opacity-80" onclick={go}>
		<div class="flex items-center gap-2 flex-1 min-w-0">
			<span class="rounded-full shrink-0" style="width: 6px; height: 6px; background-color: #FB923C"></span>
			<p class="font-semibold text-sm leading-tight min-w-0 whitespace-nowrap truncate" style="color: var(--color-on-surface)">{t.nutrition_label}</p>
		</div>
		<div class="text-xs shrink-0" style="color: var(--color-on-surface-variant)">{nutrition_meals_count(meals.length)}</div>
		<button onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
		        class="shrink-0 w-6 h-6 flex items-center justify-center active:opacity-60"
		        aria-label={expanded ? 'Einklappen' : 'Aufklappen'}>
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
			     style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
				<polyline points="9 6 15 12 9 18"/>
			</svg>
		</button>
	</div>

	<!-- Bar (only if goal set) -->
	{#if goalKcal}
		<div class="px-4 pb-3 cursor-pointer" onclick={go}>
			<div class="flex items-baseline justify-between gap-1 mb-1">
				<span class="text-[10px]" style="color: var(--color-on-surface-variant)">kcal</span>
				<span class="text-xs font-semibold tabular-nums" style="color: var(--color-on-surface)">{fmtKcal(rounded)} <span class="font-normal" style="color: var(--color-on-surface-variant)">/ {fmtKcal(goalKcal)}</span></span>
			</div>
			<div class="rounded-full h-1.5 overflow-hidden" style="background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent)">
				<div class="h-full rounded-full transition-all" style="width: {percent}%; background-color: {percent >= 100 ? '#EF4444' : '#FB923C'}"></div>
			</div>
			<div class="grid grid-cols-4 gap-x-3 gap-y-1 mt-2">
				{#each macros as macro}
					{@const ratio = macro.goal && macro.goal > 0 ? macro.value / macro.goal : 0}
					{@const pct = Math.min(100, ratio * 100)}
					{@const over = macro.goal && ratio > 1}
					{@const color = macro.goalType === 'max' && over ? '#EF4444' : macro.color}
					<div class="flex flex-col gap-1 min-w-0">
						<div class="flex items-baseline justify-between gap-1">
							<span class="text-[10px] truncate" style="color: var(--color-on-surface-variant)">{macro.label}</span>
							<span class="text-[10px] font-semibold tabular-nums shrink-0" style="color: var(--color-on-surface)">{fmtG(macro.value)}g</span>
						</div>
						<div class="rounded-full h-1.5 overflow-hidden" style="background-color: color-mix(in srgb, var(--color-on-surface) 10%, transparent)">
							<div class="h-full rounded-full transition-all" style="width: {pct}%; background-color: {color}"></div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Meals list (compact) – nur wenn aufgeklappt -->
	{#if expanded}
		{#if meals.length > 0}
			<div class="px-4 pb-3 flex flex-col gap-1 cursor-pointer" onclick={go}>
				{#each meals.slice(0, 4) as m (m.id)}
					{@const kcal = Math.round(m.components.reduce((s, c) => s + (c.kcal ?? 0), 0))}
					<div class="flex items-center gap-2 text-sm">
						<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant); min-width: 38px">{m.time}</span>
						<span class="flex-1 truncate" style="color: var(--color-on-surface)">{m.name}</span>
						<span class="text-xs tabular-nums shrink-0" style="color: var(--color-on-surface-variant)">{fmtKcal(kcal)} kcal</span>
					</div>
				{/each}
				{#if meals.length > 4}
					<div class="text-[11px] pt-0.5" style="color: var(--color-on-surface-variant)">
						+ {meals.length - 4}
					</div>
				{/if}
			</div>
		{:else}
			<div class="px-4 pb-3 text-xs" style="color: var(--color-on-surface-variant)">
				{t.nutrition_empty_today_hint}
			</div>
		{/if}
	{/if}
</div>
{/if}
