<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { getMoodLevel, findTag } from '$lib/mood';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';

	let {
		todayEntry = null as { date: string; mood: number; activities: string[]; note: string | null } | null,
		todayDate,
		onreload,
		embedded = false
	}: {
		todayEntry: { date: string; mood: number; activities: string[]; note: string | null } | null;
		todayDate: string;
		onreload: () => void;
		embedded?: boolean;
	} = $props();

	let entrySheetOpen = $state(false);
	let expanded = $state(false);

	const moodLevel = $derived(todayEntry ? getMoodLevel(todayEntry.mood) : null);
	const hasDetails = $derived(
		!!todayEntry && (todayEntry.activities.length > 0 || !!todayEntry.note)
	);

	function getTagLabel(key: string): string {
		const tag = findTag(key);
		if (!tag) return key;
		const labelKey = tag.labelKey as keyof typeof t;
		return (t[labelKey] as string) ?? key;
	}
	function getTagIcon(key: string): string {
		return findTag(key)?.icon ?? '';
	}
</script>

{#if todayEntry && moodLevel}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="overflow-hidden active:opacity-80 cursor-pointer {embedded ? '' : 'rounded-2xl'}"
	style={embedded ? '' : 'background-color: var(--color-surface-card)'}
	onclick={() => entrySheetOpen = true}
>
	<!-- Header row — always visible -->
	<div class="flex items-center gap-2 px-4 pt-3 pb-2">
		<p class="font-semibold text-sm flex-1" style="color: #F472B6">{t.mood_tracker_label}</p>
		<!-- Mood pill (visual indicator) -->
		<div
			class="flex items-center gap-1.5 px-1 py-1 text-xs font-semibold shrink-0"
			style="color: {moodLevel.color}"
		>
			<MoodIcon value={moodLevel.value} size={16}/>
			<span>{(t[moodLevel.labelKey as keyof typeof t] as string) ?? ''}</span>
		</div>
		{#if hasDetails}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<button
				onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
				class="shrink-0 w-7 h-7 flex items-center justify-center active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
			>
				<svg
					width="14" height="14" viewBox="0 0 24 24" fill="none"
					stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)"
				>
					<polyline points="9 6 15 12 9 18"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Progress bar reflecting mood level (1-5) -->
	<div class="px-4 pt-2 pb-3">
		<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
			<div
				class="h-full rounded-full"
				style="width: {moodLevel.value * 20}%; background: linear-gradient(90deg, color-mix(in srgb, {moodLevel.color} 28%, transparent), color-mix(in srgb, {moodLevel.color} 65%, transparent)); transition: width 0.4s ease"
			></div>
		</div>
	</div>

	{#if expanded && hasDetails}
		<div class="px-4 pb-3 flex flex-col gap-2" style="border-top: 1px solid var(--color-outline-variant)">
			{#if todayEntry.activities.length > 0}
				<div class="flex flex-wrap gap-1 pt-2">
					{#each todayEntry.activities as key}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
							<ActivityIcon icon={getTagIcon(key)} size={11} color="var(--color-on-surface-variant)" />{getTagLabel(key)}
						</span>
					{/each}
				</div>
			{/if}
			{#if todayEntry.note}
				<p class="text-xs leading-relaxed" style="color: var(--color-on-surface-variant)">{todayEntry.note}</p>
			{/if}
		</div>
	{/if}
</div>
{/if}

<MoodEntrySheet
	bind:open={entrySheetOpen}
	date={todayDate}
	initialMood={todayEntry?.mood ?? null}
	initialActivities={todayEntry?.activities ?? []}
	initialNote={todayEntry?.note ?? ''}
	onsaved={() => { entrySheetOpen = false; onreload(); }}
/>
