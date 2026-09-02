<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { findTag } from '$lib/mood';
	import ManageSheetShell from './ManageSheetShell.svelte';

	type ReviewLog = { date: string; mood: number; energy?: number | null; activities?: string | string[] | null };
	let { logs, from, to, compact = false, dismissible = false, ondismiss }: {
		logs: ReviewLog[]; from: string; to: string; compact?: boolean; dismissible?: boolean; ondismiss?: () => void;
	} = $props();
	let detailOpen = $state(false);
	const parsedActivities = (value: ReviewLog['activities']): string[] => {
		if (Array.isArray(value)) return value;
		try { return value ? JSON.parse(value) : []; } catch { return []; }
	};
	const summary = $derived.by(() => {
		const energies = logs.map(log => log.energy).filter((value): value is number => typeof value === 'number');
		const counts = new Map<string, number>();
		for (const log of logs) for (const key of new Set(parsedActivities(log.activities))) counts.set(key, (counts.get(key) ?? 0) + 1);
		const ranked = [...counts].sort((a, b) => b[1] - a[1]);
		return {
			mood: logs.length ? logs.reduce((sum, log) => sum + log.mood, 0) / logs.length : null,
			energy: energies.length ? energies.reduce((sum, value) => sum + value, 0) / energies.length : null,
			feelings: ranked.filter(([key]) => findTag(key)?.kind === 'feeling').slice(0, 3),
			factors: ranked.filter(([key]) => findTag(key)?.kind !== 'feeling').slice(0, 3)
		};
	});
	const formatDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(currentLang(), { day: 'numeric', month: 'short' });
	function label(key: string): string {
		const tag = findTag(key); if (!tag) return key;
		return (t[tag.labelKey as keyof typeof t] as string) ?? key;
	}
</script>

{#snippet content()}
	<div class="grid grid-cols-3 divide-x" style="border-color: var(--color-outline-variant)">
		<div class="px-2 text-center"><p class="text-lg font-bold" style="color:#F472B6">{summary.mood?.toFixed(1) ?? '–'}</p><p class="text-[10px]" style="color:var(--color-on-surface-variant)">{t.mood_weekly_avg_mood}</p></div>
		<div class="px-2 text-center"><p class="text-lg font-bold" style="color:#F472B6">{summary.energy?.toFixed(1) ?? '–'}</p><p class="text-[10px]" style="color:var(--color-on-surface-variant)">{summary.energy === null ? t.mood_not_recorded : t.mood_weekly_avg_energy}</p></div>
		<div class="px-2 text-center"><p class="text-lg font-bold" style="color:#F472B6">{logs.length}/7</p><p class="text-[10px]" style="color:var(--color-on-surface-variant)">{t.mood_weekly_logged_days}</p></div>
	</div>
	{#if summary.feelings.length || summary.factors.length}
		<div class="pt-3 space-y-2">
			{#if summary.feelings.length}<p class="text-xs" style="color:var(--color-on-surface-variant)"><span class="font-semibold" style="color:var(--color-on-surface)">{t.mood_weekly_feelings}:</span> {summary.feelings.map(([key, count]) => `${label(key)} (${count}×)`).join(' · ')}</p>{/if}
			{#if summary.factors.length}<p class="text-xs" style="color:var(--color-on-surface-variant)"><span class="font-semibold" style="color:var(--color-on-surface)">{t.mood_weekly_factors}:</span> {summary.factors.map(([key, count]) => `${label(key)} (${count}×)`).join(' · ')}</p>{/if}
		</div>
	{/if}
{/snippet}

{#if compact}
	<div class="rounded-2xl overflow-hidden" style="background-color:var(--bubble-container-bg);border:1px solid var(--bubble-container-border)">
		<div class="flex items-start gap-2 px-4 pt-3">
			<button class="flex-1 text-left active:opacity-70" onclick={() => detailOpen = true}>
				<p class="text-sm font-semibold" style="color:#F472B6">{t.mood_weekly_title}</p><p class="text-[11px]" style="color:var(--color-on-surface-variant)">{formatDate(from)} – {formatDate(to)}</p>
			</button>
			{#if dismissible}<button onclick={ondismiss} aria-label={t.mood_weekly_hide} class="p-1 active:opacity-60" style="color:var(--color-on-surface-variant)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>{/if}
		</div>
		<button onclick={() => detailOpen = true} class="w-full px-4 py-3 text-left active:opacity-70">{@render content()}</button>
	</div>
{:else}
	<div class="mt-4 pt-4" style="border-top:1px solid var(--color-outline-variant)"><p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color:#F472B6">{t.mood_weekly_title}</p>{@render content()}</div>
{/if}

{#if detailOpen}
	<ManageSheetShell accent="#F472B6" title={t.mood_weekly_title} subtitle={`${formatDate(from)} – ${formatDate(to)}`} onclose={() => detailOpen = false} showFooter={false}>
		{#snippet headerActions()}<button onclick={() => detailOpen = false} aria-label={t.close} class="p-2 active:opacity-60" style="color:var(--color-on-surface-variant)"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>{/snippet}
		{#snippet body()}<div class="py-2">{@render content()}</div>{/snippet}
	</ManageSheetShell>
{/if}
