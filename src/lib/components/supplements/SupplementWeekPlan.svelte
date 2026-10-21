<script module lang="ts">
	export type { WeekSchedule } from '#lib/supplementWeekPlan';
</script>

<script lang="ts">
	import { t } from '#lib/i18n.svelte';
	import { todayKey } from '#lib/dates';
	import { buildSupplementWeekPlan, type WeekSchedule, type WeekCompletion } from '#lib/supplementWeekPlan';

	type WeekEntry = { id: string; supplementId: string; name: string; time: string; done: boolean };
	let { schedules, accent = 'var(--color-primary)', compact = false, onSelectSupplement = null, completion = null, onToggleTime = null }: {
		schedules: WeekSchedule[];
		accent?: string;
		compact?: boolean;
		onSelectSupplement?: ((id: string) => void) | null;
		completion?: WeekCompletion | null;
		onToggleTime?: ((time: string) => void) | null;
	} = $props();

	const today = todayKey();
	const dayLabels = $derived([
		t.supplement_day_mo, t.supplement_day_di, t.supplement_day_mi,
		t.supplement_day_do, t.supplement_day_fr, t.supplement_day_sa, t.supplement_day_so
	]);
	const weekPlan = $derived(buildSupplementWeekPlan(schedules, today, completion));

	function groupsFor(entries: WeekEntry[]) {
		const groups = new Map<string, WeekEntry[]>();
		for (const entry of entries) {
			const group = groups.get(entry.time) ?? [];
			group.push(entry);
			groups.set(entry.time, group);
		}
		return Array.from(groups, ([time, entries]) => ({ time, entries, done: entries.every(entry => entry.done) }));
	}

</script>

<div class="supplement-week-plan" class:compact style:--week-plan-accent={accent}>
	{#if schedules.length === 0}
		<p class="week-empty">{t.supplement_weekplan_empty}</p>
	{:else}
		{#each weekPlan as row, i (row.day)}
			<div class="week-day" class:inset-row-divider={i < weekPlan.length - 1} class:today={row.date === today} data-date={row.date}>
				<span class="week-day-label">{dayLabels[i]}</span>
				<div class="week-day-entries">
					{#if row.entries.length === 0}
						<span class="week-day-empty">—</span>
					{:else if completion}
						{#each groupsFor(row.entries) as group (group.time)}
							{#snippet intakeContents()}
								<span class="week-check" class:checked={group.done} aria-hidden="true">
									{#if group.done}<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12" /></svg>{/if}
								</span>
								<span class="week-time">{group.time}</span>
								<span class="week-intake-names">
									{#each group.entries as entry, entryIndex (entry.id)}
										{#if entryIndex > 0}<span> · </span>{/if}<span class:done={entry.done}>{entry.name}</span>
									{/each}
								</span>
							{/snippet}
							{#if row.date === today && onToggleTime}
								<button type="button" class="week-intake" aria-pressed={group.done} onclick={() => onToggleTime?.(group.time)}>{@render intakeContents()}</button>
							{:else}
								<div class="week-intake">{@render intakeContents()}</div>
							{/if}
						{/each}
					{:else}
						{#each row.entries as entry}
							{#snippet entryContents(entry: WeekEntry)}
								<span class="week-time">{entry.time}</span>
								<span class="week-name">{entry.name}</span>
							{/snippet}
							{#if onSelectSupplement}
								<button type="button" class="week-entry" onclick={() => onSelectSupplement?.(entry.supplementId)}>{@render entryContents(entry)}</button>
							{:else}
								<div class="week-entry">{@render entryContents(entry)}</div>
							{/if}
						{/each}
					{/if}
				</div>
			</div>
		{/each}
	{/if}
</div>

<style>
	.week-day { display: grid; grid-template-columns: 3.25rem minmax(0, 1fr); align-items: start; gap: 8px; padding: 8px 12px; }
	.week-day.today { background: color-mix(in srgb, var(--week-plan-accent) 7%, transparent); }
	.week-day-label { padding-top: 4px; font-size: 11px; font-weight: 700; line-height: 20px; text-transform: uppercase; letter-spacing: .025em; color: var(--color-on-surface-variant); }
	.today .week-day-label { color: var(--week-plan-accent); }
	.week-day-entries { min-width: 0; }
	.week-entry { display: grid; width: 100%; grid-template-columns: 3.25rem minmax(0, 1fr); align-items: start; padding: 2px 0; text-align: left; line-height: 20px; }
	button.week-entry:active { opacity: .5; }
	button.week-entry:focus-visible { outline: 2px solid var(--week-plan-accent); outline-offset: 1px; }
	.week-time { font-size: 12px; font-variant-numeric: tabular-nums; color: var(--color-on-surface-variant); }
	.week-name { min-width: 0; overflow-wrap: anywhere; font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
	.week-day-empty { display: block; padding: 2px 0; line-height: 20px; color: var(--color-on-surface-variant); opacity: .5; }
	.week-empty { padding: 24px 16px; font-size: 13px; text-align: center; color: var(--color-on-surface-variant); }
	.compact .week-day { grid-template-columns: 2rem minmax(0, 1fr); padding: 4px 16px; }
	.compact .week-day-label { padding-top: 4px; }
	.compact .week-entry { grid-template-columns: 3rem minmax(0, 1fr); }
	.compact .week-name { font-size: 13px; font-weight: 550; }
	.week-intake { display: grid; grid-template-columns: 16px 3rem minmax(0, 1fr); align-items: center; gap: 8px; min-height: 28px; width: 100%; text-align: left; }
	.week-intake .week-time { color: var(--week-plan-accent); font-size: 13px; font-weight: 600; }
	.week-intake-names { min-width: 0; padding: 4px 0; overflow-wrap: anywhere; font-size: 13px; line-height: 20px; color: var(--color-on-surface); }
	.week-intake-names .done { text-decoration: line-through; color: var(--color-on-surface-variant); }
	.week-check { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; border: 1px solid var(--week-plan-accent); border-radius: 50%; color: var(--color-bg); }
	.week-check.checked { background: var(--week-plan-accent); }
	button.week-intake:active { opacity: .6; }
	button.week-intake:focus-visible { outline: 2px solid var(--week-plan-accent); outline-offset: -2px; }
</style>
