<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { MEDITATION_SOUNDS } from '$lib/audio/meditationSounds';
	import { playMeditationSound, stopAllMeditationSounds } from '$lib/audio/meditationAudio';

	let {
		open = $bindable<boolean>(false)
	}: {
		open: boolean;
	} = $props();

	const PREP_OPTIONS = [0, 10, 20, 30, 60];
	const DURATION_OPTIONS = [5, 10, 15, 20, 30];
	const GOAL_OPTIONS = [10, 15, 20, 30, 45, 60];

	function soundLabel(filename: string): string {
		const s = MEDITATION_SOUNDS.find(x => x.filename === filename);
		if (!s) return filename;
		return currentLang() === 'en' ? s.labelEn : s.labelDe;
	}

	function preview(filename: string) {
		playMeditationSound(filename, userSettings.meditationVolume ?? 70);
	}

	function close() {
		stopAllMeditationSounds();
		open = false;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={close}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl overflow-y-auto"
	     style="background-color: var(--color-surface-low); max-height: 90vh">
		<div class="p-6 space-y-5">
			<div class="flex justify-center mb-1">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{t.meditation_edit_title}
			</p>

			<!-- Daily goal -->
			<div>
				<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.meditation_goal_label}</p>
				<div class="flex gap-1.5 flex-wrap">
					{#each GOAL_OPTIONS as min}
						<button
							onclick={() => userSettings.meditationDailyGoalMinutes = min}
							class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors active:opacity-70"
							style="background-color: {userSettings.meditationDailyGoalMinutes === min ? '#9F7AEA' : 'var(--color-surface-container)'}; color: {userSettings.meditationDailyGoalMinutes === min ? 'white' : 'var(--color-on-surface-variant)'}"
						>{min} min</button>
					{/each}
				</div>
			</div>

			<!-- Default duration -->
			<div>
				<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.meditation_default_duration}</p>
				<div class="flex gap-1.5 flex-wrap">
					{#each DURATION_OPTIONS as min}
						<button
							onclick={() => userSettings.meditationDefaultDurationMinutes = min}
							class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors active:opacity-70"
							style="background-color: {userSettings.meditationDefaultDurationMinutes === min ? '#9F7AEA' : 'var(--color-surface-container)'}; color: {userSettings.meditationDefaultDurationMinutes === min ? 'white' : 'var(--color-on-surface-variant)'}"
						>{min} min</button>
					{/each}
				</div>
			</div>

			<!-- Prep seconds -->
			<div>
				<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.meditation_prep_seconds}</p>
				<div class="flex gap-1.5 flex-wrap">
					{#each PREP_OPTIONS as sec}
						<button
							onclick={() => userSettings.meditationPrepSeconds = sec}
							class="px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors active:opacity-70"
							style="background-color: {userSettings.meditationPrepSeconds === sec ? '#9F7AEA' : 'var(--color-surface-container)'}; color: {userSettings.meditationPrepSeconds === sec ? 'white' : 'var(--color-on-surface-variant)'}"
						>{sec === 0 ? t.meditation_prep_none : `${sec} s`}</button>
					{/each}
				</div>
			</div>

			<!-- Volume -->
			<div>
				<div class="flex items-center justify-between mb-2">
					<p class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.meditation_volume}</p>
					<p class="text-xs font-semibold" style="color: #9F7AEA">{userSettings.meditationVolume ?? 70}%</p>
				</div>
				<input
					type="range"
					min="0"
					max="100"
					step="5"
					value={userSettings.meditationVolume ?? 70}
					oninput={(e) => userSettings.meditationVolume = Number((e.currentTarget as HTMLInputElement).value)}
					class="w-full"
					style="accent-color: #9F7AEA"
				/>
			</div>

			<!-- Start sound -->
			<div>
				<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.meditation_start_sound}</p>
				<div class="space-y-1.5">
					{#each MEDITATION_SOUNDS as snd}
						<div class="flex items-center gap-2">
							<button
								onclick={() => userSettings.meditationStartSound = snd.filename}
								class="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-left active:opacity-70"
								style="background-color: {userSettings.meditationStartSound === snd.filename ? '#9F7AEA' : 'var(--color-surface-container)'}; color: {userSettings.meditationStartSound === snd.filename ? 'white' : 'var(--color-on-surface)'}"
							>{soundLabel(snd.filename)}</button>
							<button
								onclick={() => preview(snd.filename)}
								class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
								aria-label="Play"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- End sound -->
			<div>
				<p class="text-xs font-medium mb-2" style="color: var(--color-on-surface-variant)">{t.meditation_end_sound}</p>
				<div class="space-y-1.5">
					{#each MEDITATION_SOUNDS as snd}
						<div class="flex items-center gap-2">
							<button
								onclick={() => userSettings.meditationEndSound = snd.filename}
								class="flex-1 px-3 py-2 rounded-xl text-xs font-semibold text-left active:opacity-70"
								style="background-color: {userSettings.meditationEndSound === snd.filename ? '#9F7AEA' : 'var(--color-surface-container)'}; color: {userSettings.meditationEndSound === snd.filename ? 'white' : 'var(--color-on-surface)'}"
							>{soundLabel(snd.filename)}</button>
							<button
								onclick={() => preview(snd.filename)}
								class="w-9 h-9 rounded-xl flex items-center justify-center active:opacity-60"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
								aria-label="Play"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>

			<button
				onclick={close}
				class="w-full py-3 rounded-2xl text-sm font-semibold active:opacity-70"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
			>{t.close}</button>
		</div>
	</div>
{/if}
