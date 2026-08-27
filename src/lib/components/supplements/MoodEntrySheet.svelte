<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { MOOD_LEVELS, ACTIVITY_CATEGORIES, type ActivityTag } from '$lib/mood';
	import { clearMoodDraft, loadMoodDraft, saveMoodDraft } from '$lib/moodDraft';
	import { userSettings } from '$lib/userSettings.svelte';
	import { page } from '$app/stores';
	import { untrack } from 'svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';

	let {
		open = $bindable(false),
		date = '',
		initialMood = null as number | null,
		initialActivities = [] as string[],
		initialNote = '' as string,
		initialGratitude = '' as string,
		onsaved
	}: {
		open: boolean;
		date: string;
		initialMood?: number | null;
		initialActivities?: string[];
		initialNote?: string;
		initialGratitude?: string;
		onsaved: () => void;
	} = $props();

	let selectedMood = $state<number | null>(null);
	let selectedActivities = $state<Set<string>>(new Set());
	let note = $state('');
	let gratitude = $state('');
	let saving = $state(false);
	let collapsedCats = $state<Set<string>>(new Set());
	let scrollEl = $state<HTMLElement | null>(null);
	let initializedKey = $state<string | null>(null);
	let draftReady = $state(false);
	let baselineSignature = $state('');
	const draftUserId = $derived($page.data.user?.id ?? 'anonymous');

	type DraftValues = {
		mood: number | null;
		activities: string[];
		note: string;
		gratitude: string;
	};

	function getDraftStorage(): Storage | null {
		try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
	}

	function draftSignature(draft: DraftValues): string {
		return JSON.stringify([
			draft.mood,
			[...draft.activities].sort(),
			draft.note,
			draft.gratitude
		]);
	}

	function currentDraft(): DraftValues {
		return {
			mood: selectedMood,
			activities: [...selectedActivities],
			note,
			gratitude
		};
	}

	$effect(() => {
		const nextKey = open && date ? `${draftUserId}:${date}` : null;
		if (!nextKey) {
			initializedKey = null;
			draftReady = false;
			return;
		}
		if (initializedKey === nextKey) return;

		initializedKey = nextKey;
		draftReady = false;
		const initial = untrack((): DraftValues => ({
			mood: initialMood ?? null,
			activities: [...initialActivities],
			note: initialNote ?? '',
			gratitude: initialGratitude ?? ''
		}));
		baselineSignature = draftSignature(initial);
		const storage = getDraftStorage();
		const restored = storage ? loadMoodDraft(storage, draftUserId, date) : null;
		const values = restored ?? initial;
		selectedMood = values.mood;
		selectedActivities = new Set(values.activities);
		note = values.note;
		gratitude = values.gratitude;
		draftReady = true;

		// Scroll to bottom so Sport category is visible first
		Promise.resolve().then(() => {
			if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight;
		});
	});

	// Persist only values that differ from the last saved server state. The key
	// includes the user and date, so drafts never leak between accounts or days.
	$effect(() => {
		if (!open || !date || !draftReady) return;
		const storage = getDraftStorage();
		if (!storage) return;
		const draft = currentDraft();
		if (draftSignature(draft) === baselineSignature) {
			clearMoodDraft(storage, draftUserId, date);
		} else {
			saveMoodDraft(storage, draftUserId, date, draft);
		}
	});

	// Categories reversed so Sport is at the bottom (visible on open), Weather at the top
	const reversedCategories = $derived(
		[...ACTIVITY_CATEGORIES].reverse().map(cat => ({
			...cat,
			tags: cat.tags.filter(tag => !(userSettings.hiddenMoodTags ?? []).includes(tag.key))
		})).filter(cat => cat.tags.length > 0)
	);

	function toggleActivity(key: string) {
		const next = new Set(selectedActivities);
		if (next.has(key)) next.delete(key); else next.add(key);
		selectedActivities = next;
	}

	function toggleCat(key: string) {
		const next = new Set(collapsedCats);
		if (next.has(key)) next.delete(key); else next.add(key);
		collapsedCats = next;
	}

	function formatDate(d: string): string {
		if (!d) return '';
		const date = new Date(d + 'T12:00:00');
		return date.toLocaleDateString(currentLang(), { weekday: 'long', day: 'numeric', month: 'long' });
	}

	async function save() {
		if (!selectedMood || saving) return;
		saving = true;
		try {
			const res = await fetch('/api/mood-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date,
					mood: selectedMood,
					activities: [...selectedActivities],
					note: note.trim() || null,
					gratitude: gratitude.trim() || null
				})
			});
			if (res.ok) {
				const storage = getDraftStorage();
				if (storage) clearMoodDraft(storage, draftUserId, date);
				draftReady = false;
				open = false;
				onsaved();
			}
		} finally {
			saving = false;
		}
	}

	function getTagLabel(tag: ActivityTag): string {
		const key = tag.labelKey as keyof typeof t;
		return (t[key] as string) ?? tag.key;
	}

	function getCatLabel(labelKey: string): string {
		const key = labelKey as keyof typeof t;
		return (t[key] as string) ?? labelKey;
	}

	function getMoodLabel(labelKey: string): string {
		const key = labelKey as keyof typeof t;
		return (t[key] as string) ?? labelKey;
	}
</script>

{#if open}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-40"
		style="background: rgba(0,0,0,0.5)"
		onclick={() => open = false}
	></div>

	<!-- Sheet -->
	<div
		class="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
		style="background-color: var(--modal-bg); max-height: 92dvh; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)"
	>
		<!-- Handle -->
		<div class="flex justify-center pt-3 pb-1 shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
		</div>

		<!-- Header -->
		<div class="px-5 pb-3 shrink-0">
			<p class="font-bold text-lg" style="color: #F472B6">{t.mood_entry_title}</p>
			<p class="text-sm" style="color: var(--color-on-surface-variant)">{formatDate(date)}</p>
		</div>

		<!-- Scrollable content — categories reversed, note at top, Sport at bottom -->
		<div bind:this={scrollEl} class="flex-1 overflow-y-auto px-5 pt-2 pb-2">
			<div class="space-y-5">

				<!-- Gratitude journal -->
				<div>
					<textarea
						bind:value={gratitude}
						placeholder={t.mood_gratitude_placeholder}
						rows="3"
						class="w-full rounded-2xl px-4 py-3 border-0 outline-none resize-none"
						style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface); font-size: 16px; line-height: 1.5"
					></textarea>
				</div>

				<!-- Note (at top, scroll all the way up to see) -->
				<div>
					<textarea
						bind:value={note}
						placeholder={t.mood_note_placeholder}
						rows="3"
						class="w-full rounded-2xl px-4 py-3 border-0 outline-none resize-none"
						style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface); font-size: 16px; line-height: 1.5"
					></textarea>
				</div>

				<!-- Activity categories — reversed: Weather first (top), Sport last (bottom) -->
				<div class="space-y-3">
					<p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--color-on-surface-variant)">{t.mood_activities_label}</p>
					{#each reversedCategories as cat}
						{@const collapsed = collapsedCats.has(cat.key)}
						<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
							<button
								onclick={() => toggleCat(cat.key)}
								class="w-full flex items-center justify-between px-3.5 py-2.5 active:opacity-70"
							>
								<p class="text-sm font-semibold" style="color: #F472B6">{getCatLabel(cat.labelKey)}</p>
								<svg
									width="14" height="14" viewBox="0 0 24 24" fill="none"
									stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
									style="color: var(--color-on-surface-variant); transition: transform 0.2s; transform: rotate({collapsed ? '0' : '90'}deg)"
								>
									<polyline points="9 18 15 12 9 6"/>
								</svg>
							</button>
							{#if !collapsed}
								<div class="grid grid-cols-4 gap-1.5 px-2.5 pb-2.5">
									{#each cat.tags as tag}
										{@const active = selectedActivities.has(tag.key)}
										<button
											onclick={() => toggleActivity(tag.key)}
											class="flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl transition-all active:scale-95"
											style="background-color: {active ? 'rgba(244,114,182,0.18)' : 'transparent'}; outline: {active ? '1.5px solid #F472B6' : 'none'}"
										>
											<ActivityIcon icon={tag.icon} size={20} color={active ? '#F472B6' : 'var(--color-on-surface-variant)'} />
											<span class="text-[9px] font-medium text-center leading-tight" style="color: {active ? '#F472B6' : 'var(--color-on-surface-variant)'}">{getTagLabel(tag)}</span>
										</button>
									{/each}
								</div>
							{/if}
						</div>
					{/each}
				</div>

			</div>
		</div>

		<!-- Mood selector — fixed above save button, always visible -->
		<div class="px-5 pt-3 shrink-0">
			<p class="text-xs font-semibold uppercase tracking-widest mb-2" style="color: #F472B6">{t.mood_tracker_label}</p>
			<div class="flex rounded-2xl overflow-hidden transition-all" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); box-shadow: {!selectedMood ? '0 0 0 1.5px rgba(244,114,182,0.4)' : 'none'}">
				{#each MOOD_LEVELS as level}
					{@const active = selectedMood === level.value}
					<button
						onclick={() => selectedMood = level.value}
						class="flex-1 flex flex-col items-center gap-1 py-3 transition-all active:scale-95"
						style="background-color: {active ? level.bgColor : 'transparent'}"
					>
						<MoodIcon value={level.value} size={26} style="color: {active ? level.color : 'var(--color-on-surface-variant)'}"/>
						<span class="text-[9px] font-semibold leading-tight text-center px-0.5" style="color: {active ? level.color : 'var(--color-on-surface-variant)'}">{getMoodLabel(level.labelKey)}</span>
					</button>
				{/each}
			</div>
		</div>

		<!-- Save button -->
		<div class="px-5 pt-2 shrink-0 flex gap-2">
			<button
				onclick={() => open = false}
				class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
				style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
			>{t.close}</button>
			<button
				onclick={save}
				disabled={!selectedMood || saving}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40 transition-opacity"
				style="background: linear-gradient(135deg, #F472B6, #EC4899); color: #fff"
			>{saving ? '…' : t.mood_save}</button>
		</div>
	</div>
{/if}
