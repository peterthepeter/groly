<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { getMoodLevel, findTag } from '$lib/mood';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';
	import TrackerTileShell from './TrackerTileShell.svelte';

	let {
		todayEntry = null as { date: string; mood: number; activities: string[]; note: string | null; gratitude: string | null } | null,
		todayDate,
		onreload,
		embedded = false,
		tileMode = false,
		expanded = $bindable(false)
	}: {
		todayEntry: { date: string; mood: number; activities: string[]; note: string | null; gratitude: string | null } | null;
		todayDate: string;
		onreload: () => void;
		embedded?: boolean;
		tileMode?: boolean;
		expanded?: boolean;
	} = $props();

	let entrySheetOpen = $state(false);

	const moodLevel = $derived(todayEntry ? getMoodLevel(todayEntry.mood) : null);
	const hasDetails = $derived(
		!!todayEntry && (todayEntry.activities.length > 0 || !!todayEntry.note || !!todayEntry.gratitude)
	);
	const previewText = $derived(todayEntry?.gratitude?.trim() || todayEntry?.note?.trim() || '');

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
{#if tileMode}
	<TrackerTileShell accent="#F472B6" title={t.mood_tracker_label} expandable={hasDetails} bind:expanded onactivate={() => entrySheetOpen = true}>
		{#snippet body()}
			<div class="h-6 pl-3.5 flex items-center gap-1.5 text-[11px] font-semibold" style="color: {moodLevel.color}">
				<MoodIcon value={moodLevel.value} size={16}/>
				<span class="max-w-28 truncate">{(t[moodLevel.labelKey as keyof typeof t] as string) ?? ''}</span>
			</div>
			<div class="h-9 pl-3.5 min-w-0 flex flex-col justify-end gap-0.5">
				{#if todayEntry.activities.length > 0}
					<div class="h-[18px] flex items-center gap-1 min-w-0 overflow-hidden">
						{#each todayEntry.activities.slice(0, 2) as key}
							<span class="inline-flex items-center gap-0.5 min-w-0 max-w-[42%] text-[9px] leading-none px-1.5 py-1 rounded-full font-medium" style="background-color: color-mix(in srgb, #F472B6 12%, transparent); color: var(--color-on-surface)">
								<ActivityIcon icon={getTagIcon(key)} size={9} color="#F472B6" /><span class="truncate">{getTagLabel(key)}</span>
							</span>
						{/each}
						{#if todayEntry.activities.length > 2}<span class="text-[9px] font-semibold shrink-0" style="color: var(--color-on-surface-variant)">+{todayEntry.activities.length - 2}</span>{/if}
					</div>
				{/if}
				{#if previewText}<p class="h-[15px] text-[10px] leading-[15px] italic text-left truncate" style="color: var(--color-on-surface-variant)">{previewText}</p>{/if}
			</div>
		{/snippet}
		{#snippet details()}
			<div class="flex flex-col gap-2">
				{#if todayEntry.activities.length > 0}
					<div class="flex flex-wrap gap-1">
						{#each todayEntry.activities as key}<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style="background-color: color-mix(in srgb, #F472B6 12%, transparent); color: var(--color-on-surface)"><ActivityIcon icon={getTagIcon(key)} size={11} color="#F472B6" />{getTagLabel(key)}</span>{/each}
					</div>
				{/if}
				{#if todayEntry.gratitude}<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{todayEntry.gratitude}</p>{/if}
				{#if todayEntry.note}<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{todayEntry.note}</p>{/if}
			</div>
		{/snippet}
	</TrackerTileShell>
{:else}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
	class="overflow-hidden active:opacity-80 cursor-pointer {embedded ? '' : 'rounded-2xl'}"
	style={embedded ? '' : 'background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)'}
	onclick={() => entrySheetOpen = true}
>
		<!-- Header row — always visible -->
		<div class="flex items-center gap-2 px-4 pt-3 pb-3">
			<div class="flex items-center gap-2 shrink-0">
				<span class="rounded-full" style="width: 6px; height: 6px; background-color: #F472B6"></span>
				<p class="font-semibold text-sm" style="color: var(--color-on-surface)">{t.mood_tracker_label}</p>
			</div>
			<div class="flex-1 min-w-0"></div>
			<div class="flex items-center gap-1.5 text-xs font-semibold shrink-0" style="color: {moodLevel.color}">
				<MoodIcon value={moodLevel.value} size={16}/>
				<span>{(t[moodLevel.labelKey as keyof typeof t] as string) ?? ''}</span>
			</div>
			{#if hasDetails}
				<button
					onclick={(e) => { e.stopPropagation(); expanded = !expanded; }}
					class="shrink-0 w-7 h-7 flex items-center justify-center active:opacity-60"
					style="color: var(--color-on-surface-variant)"
					aria-label={expanded ? 'Einklappen' : 'Ausklappen'}
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
			{/if}
		</div>

	{#if expanded && hasDetails}
		<div class="px-4 pb-3 flex flex-col gap-2">
			{#if todayEntry.activities.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each todayEntry.activities as key}
						<span class="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style="background-color: color-mix(in srgb, #F472B6 12%, transparent); color: var(--color-on-surface)">
							<ActivityIcon icon={getTagIcon(key)} size={11} color="#F472B6" />{getTagLabel(key)}
						</span>
					{/each}
				</div>
			{/if}
			{#if todayEntry.gratitude}
				<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{todayEntry.gratitude}</p>
			{/if}
			{#if todayEntry.note}
				<p class="text-xs leading-relaxed italic whitespace-pre-wrap" style="color: var(--color-on-surface-variant); overflow-wrap: anywhere">{todayEntry.note}</p>
			{/if}
		</div>
	{/if}
</div>
{/if}
{/if}

<MoodEntrySheet
	bind:open={entrySheetOpen}
	date={todayDate}
	initialMood={todayEntry?.mood ?? null}
	initialActivities={todayEntry?.activities ?? []}
	initialNote={todayEntry?.note ?? ''}
	initialGratitude={todayEntry?.gratitude ?? ''}
	onsaved={() => { entrySheetOpen = false; onreload(); }}
/>
