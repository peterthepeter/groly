<script lang="ts">
	import { goto } from '$app/navigation';
	import { t, currentLang, nutrition_kcal_remaining, nutrition_kcal_over } from '$lib/i18n.svelte';

	type Meal = {
		id: string;
		name: string;
		time: string;
		components: { kcal: number }[];
	};

	let {
		meals = [],
		goalKcal = null as number | null,
		embedded = false
	}: {
		meals: Meal[];
		goalKcal: number | null;
		embedded?: boolean;
	} = $props();

	let expanded = $state(false);

	const totalKcal = $derived(
		meals.reduce((sum, m) => sum + m.components.reduce((s, c) => s + (c.kcal ?? 0), 0), 0)
	);
	const rounded = $derived(Math.round(totalKcal));
	const percent = $derived(goalKcal && goalKcal > 0 ? Math.min(100, (totalKcal / goalKcal) * 100) : 0);
	const remaining = $derived(goalKcal ? Math.max(0, goalKcal - rounded) : null);

	function go() {
		goto('/tracker/nutrition');
	}

	function fmtKcal(kcal: number): string {
		return kcal.toLocaleString(currentLang());
	}
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="overflow-hidden {embedded ? '' : 'rounded-2xl'}"
	style={embedded ? '' : 'background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)'}
>
	<!-- Header: click navigates, chevron toggles -->
	<div class="flex items-center gap-2 px-4 pt-3 pb-2 cursor-pointer active:opacity-80" onclick={go}>
		<div class="flex items-center gap-2 shrink-0">
			<span class="rounded-full" style="width: 6px; height: 6px; background-color: #FB923C"></span>
			<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{t.nutrition_label}</p>
		</div>
		<div class="flex-1"></div>
		<div class="text-xs shrink-0" style="color: var(--color-on-surface-variant)">
			{#if goalKcal}
				{fmtKcal(rounded)} / {fmtKcal(goalKcal)} kcal
			{:else}
				{fmtKcal(rounded)} kcal
			{/if}
		</div>
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
		<div class="px-4 pb-2 cursor-pointer" onclick={go}>
			<div class="rounded-full h-1.5 overflow-hidden" style="background-color: color-mix(in srgb, var(--color-on-surface) 8%, transparent)">
				<div class="h-full rounded-full transition-all" style="width: {percent}%; background-color: {percent >= 100 ? '#EF4444' : '#FB923C'}"></div>
			</div>
			{#if remaining !== null && remaining > 0}
				<div class="text-[11px] mt-1" style="color: var(--color-on-surface-variant)">
					{nutrition_kcal_remaining(fmtKcal(remaining))}
				</div>
			{:else if goalKcal && rounded > goalKcal}
				<div class="text-[11px] mt-1" style="color: #EF4444">
					{nutrition_kcal_over(fmtKcal(rounded - goalKcal))}
				</div>
			{/if}
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
