<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { getMoodLevel, findTag } from '$lib/mood';
	import MoodEntrySheet from './MoodEntrySheet.svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';

	let {
		open = $bindable(false),
		entry = null as { date: string; mood: number; activities: string[]; note: string | null; gratitude: string | null } | null,
		onsaved,
		ondeleted
	}: {
		open: boolean;
		entry: { date: string; mood: number; activities: string[]; note: string | null; gratitude: string | null } | null;
		onsaved: () => void;
		ondeleted?: () => void;
	} = $props();

	let editOpen = $state(false);
	let confirmDelete = $state(false);
	let deleting = $state(false);

	function formatDate(d: string): string {
		if (!d) return '';
		const date = new Date(d + 'T12:00:00');
		return date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
	}

	async function deleteEntry() {
		if (!entry || deleting) return;
		deleting = true;
		try {
			const res = await fetch(`/api/mood-logs/${entry.date}`, { method: 'DELETE' });
			if (res.ok) {
				open = false;
				confirmDelete = false;
				ondeleted?.();
			}
		} finally {
			deleting = false;
		}
	}

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

{#if open && entry}
	{@const level = getMoodLevel(entry.mood)}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40"
		style="background: rgba(0,0,0,0.5)"
		onclick={() => { open = false; confirmDelete = false; }}
	></div>

	<!-- Sheet -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl max-w-[430px] mx-auto"
		style="background-color: var(--color-surface); padding-bottom: calc(env(safe-area-inset-bottom) + 1.25rem)"
	>
		<!-- Handle -->
		<div class="flex justify-center pt-3 pb-2">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
		</div>

		<div class="px-5 space-y-4">
			<!-- Date + mood -->
			<div class="flex items-center gap-3">
				<div class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0" style="background-color: {level.bgColor}; color: {level.color}">
					<MoodIcon value={entry.mood as 1|2|3|4|5} size={36}/>
				</div>
				<div>
					<p class="font-bold text-base" style="color: {level.color}">{(t[level.labelKey as keyof typeof t] as string) ?? ''}</p>
					<p class="text-sm" style="color: var(--color-on-surface-variant)">{formatDate(entry.date)}</p>
				</div>
				<div class="flex-1"></div>
			</div>

			<!-- Activities -->
			{#if entry.activities.length > 0}
				<div class="flex flex-wrap gap-1.5">
					{#each entry.activities as key}
						<span class="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium" style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface)">
							<ActivityIcon icon={getTagIcon(key)} size={12} color="var(--color-on-surface-variant)" />{getTagLabel(key)}
						</span>
					{/each}
				</div>
			{/if}

			<!-- Gratitude -->
			{#if entry.gratitude}
				<div>
					<p class="text-[11px] font-semibold uppercase tracking-widest mb-1.5" style="color: #F472B6">{t.mood_gratitude_label}</p>
					<p class="text-sm leading-relaxed px-3 py-2.5 rounded-xl whitespace-pre-wrap" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface)">{entry.gratitude}</p>
				</div>
			{/if}

			<!-- Note -->
			{#if entry.note}
				<p class="text-sm leading-relaxed px-3 py-2.5 rounded-xl whitespace-pre-wrap" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface)">{entry.note}</p>
			{/if}

			<!-- Delete + Edit -->
			{#if confirmDelete}
				<div class="flex gap-2">
					<button
						onclick={() => confirmDelete = false}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
						style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
					>{t.close}</button>
					<button
						onclick={deleteEntry}
						disabled={deleting}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70 disabled:opacity-40"
						style="background-color: rgba(239,68,68,0.15); color: #EF4444"
					>{deleting ? '…' : t.mood_delete}</button>
				</div>
			{:else}
				<div class="flex gap-2">
					<button
						onclick={() => confirmDelete = true}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70 flex items-center justify-center gap-1.5"
						style="background-color: rgba(239,68,68,0.1); color: #EF4444"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
						</svg>
						{t.mood_delete}
					</button>
					<button
						onclick={() => editOpen = true}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70 flex items-center justify-center gap-1.5"
						style="background-color: rgba(244,114,182,0.15); color: #F472B6"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
						{t.mood_edit}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<MoodEntrySheet
	bind:open={editOpen}
	date={entry?.date ?? ''}
	initialMood={entry?.mood ?? null}
	initialActivities={entry?.activities ?? []}
	initialNote={entry?.note ?? ''}
	initialGratitude={entry?.gratitude ?? ''}
	onsaved={() => { editOpen = false; open = false; onsaved(); }}
/>
