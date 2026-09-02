<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { MOOD_LEVELS, ENERGY_LEVELS, ACTIVITY_CATEGORIES, type ActivityTag } from '$lib/mood';
	import { clearMoodDraft, loadMoodDraft, saveMoodDraft } from '$lib/moodDraft';
	import { userSettings } from '$lib/userSettings.svelte';
	import { page } from '$app/stores';
	import { tick, untrack } from 'svelte';
	import MoodIcon from './MoodIcon.svelte';
	import ActivityIcon from './ActivityIcon.svelte';

	let {
		open = $bindable(false), date = '', initialMood = null as number | null, initialEnergy = null as number | null,
		initialActivities = [] as string[], initialNote = '' as string,
		initialGratitude = '' as string, onsaved
	}: {
		open: boolean; date: string; initialMood?: number | null; initialEnergy?: number | null;
		initialActivities?: string[]; initialNote?: string;
		initialGratitude?: string; onsaved: () => void;
	} = $props();

	type MoodValue = 1 | 2 | 3 | 4 | 5;
	let selectedMood = $state<MoodValue | null>(null);
	let selectedEnergy = $state<MoodValue | null>(null);
	let selectedActivities = $state<Set<string>>(new Set());
	let note = $state('');
	let gratitude = $state('');
	let saving = $state(false);
	let activeStepKey = $state('mood');
	let visitedSteps = $state<Set<string>>(new Set());
	let scrollEl = $state<HTMLElement | null>(null);
	let stepNavEl = $state<HTMLElement | null>(null);
	let initializedKey = $state<string | null>(null);
	let draftReady = $state(false);
	let baselineSignature = $state('');
	const draftUserId = $derived($page.data.user?.id ?? 'anonymous');

	type DraftValues = { mood: MoodValue | null; energy: MoodValue | null; activities: string[]; note: string; gratitude: string };

	const activityCategories = $derived(
		ACTIVITY_CATEGORIES.map(category => ({
			...category,
			tags: category.tags.filter(tag => !(userSettings.hiddenMoodTags ?? []).includes(tag.key))
		})).filter(category => category.tags.length > 0)
	);

	function getDraftStorage(): Storage | null {
		try { return typeof localStorage === 'undefined' ? null : localStorage; } catch { return null; }
	}

	function draftSignature(draft: DraftValues): string {
		return JSON.stringify([draft.mood, draft.energy, [...draft.activities].sort(), draft.note, draft.gratitude]);
	}

	function currentDraft(): DraftValues {
		return { mood: selectedMood, energy: selectedEnergy, activities: [...selectedActivities], note, gratitude };
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
			mood: (initialMood as MoodValue | null) ?? null,
			energy: (initialEnergy as MoodValue | null) ?? null,
			activities: [...initialActivities],
			note: initialNote ?? '',
			gratitude: initialGratitude ?? ''
		}));
		baselineSignature = draftSignature(initial);
		const storage = getDraftStorage();
		const values = (storage ? loadMoodDraft(storage, draftUserId, date) : null) ?? initial;
		selectedMood = values.mood as MoodValue | null;
		selectedEnergy = values.energy as MoodValue | null;
		selectedActivities = new Set(values.activities);
		note = values.note;
		gratitude = values.gratitude;

		const initialVisited = new Set<string>();
		if (values.mood) initialVisited.add('mood');
		if (values.energy) initialVisited.add('energy');
		for (const category of activityCategories) {
			if (category.tags.some(tag => values.activities.includes(tag.key))) initialVisited.add(category.key);
		}
		if (values.note.trim() || values.gratitude.trim()) initialVisited.add('journal');
		activeStepKey = !values.mood ? 'mood' : !values.energy ? 'energy' : (activityCategories[0]?.key ?? 'journal');
		initialVisited.add(activeStepKey);
		visitedSteps = initialVisited;
		draftReady = true;

		void tick().then(() => {
			if (scrollEl) scrollEl.scrollTop = 0;
			centerStep(activeStepKey, false);
		});
	});

	$effect(() => {
		if (!open || !date || !draftReady) return;
		const storage = getDraftStorage();
		if (!storage) return;
		const draft = currentDraft();
		if (draftSignature(draft) === baselineSignature) clearMoodDraft(storage, draftUserId, date);
		else saveMoodDraft(storage, draftUserId, date, draft);
	});

	function toggleActivity(key: string) {
		const next = new Set(selectedActivities);
		if (next.has(key)) next.delete(key); else next.add(key);
		selectedActivities = next;
	}

	function markStepVisited(key: string) {
		const next = new Set(visitedSteps);
		next.add(key);
		visitedSteps = next;
	}

	function centerStep(key: string, smooth = true) {
		if (!stepNavEl) return;
		const button = Array.from(stepNavEl.querySelectorAll<HTMLElement>('[data-mood-step]'))
			.find(element => element.dataset.moodStep === key);
		if (!button) return;
		const navRect = stepNavEl.getBoundingClientRect();
		const buttonRect = button.getBoundingClientRect();
		const offset = buttonRect.left + buttonRect.width / 2 - (navRect.left + navRect.width / 2);
		stepNavEl.scrollBy({ left: offset, behavior: smooth ? 'smooth' : 'auto' });
	}

	async function activateStep(key: string) {
		markStepVisited(key);
		if (key === activeStepKey) return;
		activeStepKey = key;
		await tick();
		if (scrollEl) scrollEl.scrollTop = 0;
		requestAnimationFrame(() => centerStep(key));
	}

	function selectMood(value: MoodValue) {
		selectedMood = value;
		markStepVisited('mood');
		window.setTimeout(() => {
			if (open && activeStepKey === 'mood') void activateStep('energy');
		}, 180);
	}

	function selectEnergy(value: MoodValue) {
		selectedEnergy = value;
		markStepVisited('energy');
		window.setTimeout(() => {
			if (open && activeStepKey === 'energy') void activateStep(activityCategories[0]?.key ?? 'journal');
		}, 180);
	}

	function selectedTagsForCategory(category: { tags: ActivityTag[] }): ActivityTag[] {
		return category.tags.filter(tag => selectedActivities.has(tag.key));
	}

	function stepCount(key: string): number {
		if (key === 'journal') return Number(Boolean(note.trim())) + Number(Boolean(gratitude.trim()));
		const category = activityCategories.find(item => item.key === key);
		return category ? selectedTagsForCategory(category).length : 0;
	}

	function formatDate(value: string): string {
		if (!value) return '';
		const parsedDate = new Date(value + 'T12:00:00');
		return parsedDate.toLocaleDateString(currentLang(), { weekday: 'long', day: 'numeric', month: 'long' });
	}

	async function save() {
		if (!selectedMood || !selectedEnergy || saving) return;
		saving = true;
		try {
			const response = await fetch('/api/mood-logs', {
				method: 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					date, mood: selectedMood, energy: selectedEnergy, activities: [...selectedActivities],
					note: note.trim() || null, gratitude: gratitude.trim() || null
				})
			});
			if (response.ok) {
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

<style>
	.mood-sheet {
		--mood-accent: #f472b6;
		--mood-step-radius: 999px;
		height: min(92dvh, 760px);
	}
	.mood-workspace {
		display: flex;
		flex-direction: column;
		overscroll-behavior: contain;
	}
	.mood-panel {
		width: 100%;
		margin-top: auto;
		animation: reveal-panel 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) both;
	}
	.mood-step-nav {
		scrollbar-width: none;
		scroll-snap-type: x proximity;
		overscroll-behavior-x: contain;
	}
	.mood-step-nav::-webkit-scrollbar { display: none; }
	.mood-step {
		scroll-snap-align: center;
		border-radius: var(--mood-step-radius);
		transition: color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), border-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1), background-color 0.18s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	@keyframes reveal-panel {
		from { opacity: 0; transform: translateY(5px); }
		to { opacity: 1; transform: translateY(0); }
	}
	@media (prefers-reduced-motion: reduce) {
		.mood-panel, .mood-step { transition: none; animation: none; }
	}
</style>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.5)" onclick={() => open = false}></div>

	<div class="mood-sheet fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl flex flex-col max-w-[430px] mx-auto" style="background-color: var(--modal-bg); max-height: 92dvh; padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
		<div class="flex justify-center pt-3 pb-1 shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
		</div>
		<div class="px-5 pb-3 shrink-0">
			<p class="font-bold text-lg" style="color: var(--mood-accent)">{t.mood_entry_title}</p>
			<p class="text-sm" style="color: var(--color-on-surface-variant)">{formatDate(date)}</p>
		</div>

		<div bind:this={scrollEl} role="tabpanel" aria-label={t.mood_entry_title} class="mood-workspace flex-1 min-h-0 overflow-y-auto px-5 py-2">
			{#if activeStepKey === 'mood'}
				<section class="mood-panel">
					<p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--mood-accent)">{t.mood_tracker_label}</p>
					<div class="flex rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); box-shadow: {!selectedMood ? '0 0 0 1.5px rgba(244,114,182,0.4)' : 'none'}">
						{#each MOOD_LEVELS as level}
							{@const active = selectedMood === level.value}
							<button onclick={() => selectMood(level.value)} class="flex-1 flex flex-col items-center gap-1 py-4 transition-all active:scale-95" style="background-color: {active ? level.bgColor : 'transparent'}">
								<MoodIcon value={level.value} size={28} style="color: {active ? level.color : 'var(--color-on-surface-variant)'}"/>
								<span class="text-[9px] font-semibold leading-tight text-center px-0.5" style="color: {active ? level.color : 'var(--color-on-surface-variant)'}">{getMoodLabel(level.labelKey)}</span>
							</button>
						{/each}
					</div>
				</section>
			{:else if activeStepKey === 'energy'}
				<section class="mood-panel">
					<p class="text-xs font-semibold uppercase tracking-widest mb-3" style="color: var(--mood-accent)">{t.mood_energy_label}</p>
					<div class="grid grid-cols-5 rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); box-shadow: {!selectedEnergy ? '0 0 0 1.5px rgba(244,114,182,0.4)' : 'none'}">
						{#each ENERGY_LEVELS as level}
							{@const active = selectedEnergy === level.value}
							<button onclick={() => selectEnergy(level.value)} aria-label={(t[level.labelKey as keyof typeof t] as string) ?? ''} class="flex flex-col items-center justify-end gap-2 py-3 min-h-24 active:scale-95" style="background-color: {active ? 'rgba(244,114,182,0.16)' : 'transparent'}; color: {active ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}">
								<span class="flex items-end gap-0.5 h-8" aria-hidden="true">{#each Array(level.value) as _}<span class="w-1 rounded-full" style="height: {8 + level.value * 4}px; background-color: currentColor"></span>{/each}</span>
								<span class="text-[9px] font-semibold leading-tight text-center px-0.5">{(t[level.labelKey as keyof typeof t] as string) ?? ''}</span>
							</button>
						{/each}
					</div>
				</section>
			{:else if activeStepKey === 'journal'}
				<section class="mood-panel space-y-4">
					<div>
						<label for="mood-gratitude" class="block text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--mood-accent)">{t.mood_gratitude_label}</label>
						<textarea id="mood-gratitude" bind:value={gratitude} placeholder={t.mood_gratitude_placeholder} rows="5" class="w-full rounded-2xl px-4 py-3 border-0 outline-none resize-none" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface); font-size: 16px; line-height: 1.5"></textarea>
					</div>
					<div>
						<label for="mood-note" class="block text-xs font-semibold uppercase tracking-widest mb-2" style="color: var(--mood-accent)">{t.mood_note_label}</label>
						<textarea id="mood-note" bind:value={note} placeholder={t.mood_note_placeholder} rows="4" class="w-full rounded-2xl px-4 py-3 border-0 outline-none resize-none" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); color: var(--color-on-surface); font-size: 16px; line-height: 1.5"></textarea>
					</div>
				</section>
			{:else}
				{@const category = activityCategories.find(item => item.key === activeStepKey)}
				{#if category}
					{@const count = selectedTagsForCategory(category).length}
					<section class="mood-panel">
						<div class="flex items-center justify-between gap-3 mb-3">
							<p class="text-xs font-semibold uppercase tracking-widest" style="color: var(--mood-accent)">{getCatLabel(category.labelKey)}</p>
							{#if count > 0}<span class="min-w-5 h-5 px-1.5 rounded-full flex items-center justify-center text-[10px] font-semibold tabular-nums" style="background-color: color-mix(in srgb, var(--mood-accent) 14%, transparent); color: var(--mood-accent)">{count}</span>{/if}
						</div>
						<div class="grid grid-cols-4 gap-1.5 rounded-2xl p-2.5" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
							{#each category.tags as tag}
								{@const tagActive = selectedActivities.has(tag.key)}
								<button onclick={() => toggleActivity(tag.key)} class="flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl transition-all active:scale-95" style="background-color: {tagActive ? 'rgba(244,114,182,0.18)' : 'transparent'}; outline: {tagActive ? '1.5px solid var(--mood-accent)' : 'none'}">
									<ActivityIcon icon={tag.icon} size={21} color={tagActive ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'} />
									<span class="text-[9px] font-medium text-center leading-tight" style="color: {tagActive ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}">{getTagLabel(tag)}</span>
								</button>
							{/each}
						</div>
					</section>
				{/if}
			{/if}
		</div>

		<div class="px-5 pt-2 shrink-0">
			<div bind:this={stepNavEl} class="mood-step-nav flex gap-1.5 overflow-x-auto rounded-full p-1" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)" role="tablist" aria-label={t.mood_entry_title}>
				<button data-mood-step="mood" onclick={() => void activateStep('mood')} class="mood-step shrink-0 min-h-10 px-3 flex items-center gap-1.5 text-xs font-semibold" style="background-color: {activeStepKey === 'mood' ? 'color-mix(in srgb, var(--mood-accent) 16%, transparent)' : 'transparent'}; border: 1px solid {activeStepKey === 'mood' ? 'color-mix(in srgb, var(--mood-accent) 55%, transparent)' : 'transparent'}; color: {activeStepKey === 'mood' ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}" role="tab" aria-selected={activeStepKey === 'mood'}>
					{#if selectedMood}<MoodIcon value={selectedMood} size={15} style="color: var(--mood-accent)" />{/if}
					<span>{t.mood_tracker_label}</span>
					{#if visitedSteps.has('mood') && !selectedMood}<span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--mood-accent)"></span>{/if}
				</button>
				<button data-mood-step="energy" onclick={() => void activateStep('energy')} class="mood-step shrink-0 min-h-10 px-3 flex items-center gap-1.5 text-xs font-semibold" style="background-color: {activeStepKey === 'energy' ? 'color-mix(in srgb, var(--mood-accent) 16%, transparent)' : 'transparent'}; border: 1px solid {activeStepKey === 'energy' ? 'color-mix(in srgb, var(--mood-accent) 55%, transparent)' : 'transparent'}; color: {activeStepKey === 'energy' ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}" role="tab" aria-selected={activeStepKey === 'energy'}>
					<span>{t.mood_energy_short}</span>{#if selectedEnergy}<span class="font-bold">{selectedEnergy}/5</span>{:else if visitedSteps.has('energy')}<span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--mood-accent)"></span>{/if}
				</button>
				{#each activityCategories as category}
					{@const active = activeStepKey === category.key}
					{@const count = stepCount(category.key)}
					<button data-mood-step={category.key} onclick={() => void activateStep(category.key)} class="mood-step shrink-0 min-h-10 px-3 flex items-center gap-1.5 text-xs font-semibold" style="background-color: {active ? 'color-mix(in srgb, var(--mood-accent) 16%, transparent)' : 'transparent'}; border: 1px solid {active ? 'color-mix(in srgb, var(--mood-accent) 55%, transparent)' : 'transparent'}; color: {active ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}" role="tab" aria-selected={active}>
						<span>{getCatLabel(category.labelKey)}</span>
						{#if count > 0}<span class="min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] tabular-nums" style="background-color: color-mix(in srgb, var(--mood-accent) 18%, transparent); color: var(--mood-accent)">{count}</span>{:else if visitedSteps.has(category.key)}<span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--mood-accent)"></span>{/if}
					</button>
				{/each}
				<button data-mood-step="journal" onclick={() => void activateStep('journal')} class="mood-step shrink-0 min-h-10 px-3 flex items-center gap-1.5 text-xs font-semibold" style="background-color: {activeStepKey === 'journal' ? 'color-mix(in srgb, var(--mood-accent) 16%, transparent)' : 'transparent'}; border: 1px solid {activeStepKey === 'journal' ? 'color-mix(in srgb, var(--mood-accent) 55%, transparent)' : 'transparent'}; color: {activeStepKey === 'journal' ? 'var(--mood-accent)' : 'var(--color-on-surface-variant)'}" role="tab" aria-selected={activeStepKey === 'journal'}>
					<span>{t.mood_journal_step}</span>
					{#if stepCount('journal') > 0}<span class="min-w-4 h-4 px-1 rounded-full flex items-center justify-center text-[9px] tabular-nums" style="background-color: color-mix(in srgb, var(--mood-accent) 18%, transparent); color: var(--mood-accent)">{stepCount('journal')}</span>{:else if visitedSteps.has('journal')}<span class="w-1.5 h-1.5 rounded-full" style="background-color: var(--mood-accent)"></span>{/if}
				</button>
			</div>
		</div>

		<div class="px-5 pt-2 shrink-0 flex gap-2">
			<button onclick={() => open = false} class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70" style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">{t.close}</button>
			<button onclick={save} disabled={!selectedMood || !selectedEnergy || saving} class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40 transition-opacity" style="background: linear-gradient(135deg, #F472B6, #EC4899); color: #fff">{saving ? '…' : t.mood_save}</button>
		</div>
	</div>
{/if}
