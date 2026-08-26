<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { MEDITATION_SOUNDS } from '$lib/audio/meditationSounds';
	import { playMeditationSound, stopAllMeditationSounds } from '$lib/audio/meditationAudio';
	import ManageSheetShell from './ManageSheetShell.svelte';

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
	<ManageSheetShell accent="#9F7AEA" title={t.meditation_edit_title} onclose={close} density="comfortable">
		{#snippet body()}
			<div class="manage-stack">
			<!-- Daily goal -->
			<div class="manage-section">
				<p class="manage-label">{t.meditation_goal_label}</p>
				<div class="manage-chip-grid">
					{#each GOAL_OPTIONS as min}
						<button
							onclick={() => userSettings.meditationDailyGoalMinutes = min}
							class="manage-chip active:opacity-70"
							data-selected={userSettings.meditationDailyGoalMinutes === min}
						>{min} min</button>
					{/each}
				</div>
			</div>

			<!-- Default duration -->
			<div class="manage-section">
				<p class="manage-label">{t.meditation_default_duration}</p>
				<div class="manage-chip-grid">
					{#each DURATION_OPTIONS as min}
						<button
							onclick={() => userSettings.meditationDefaultDurationMinutes = min}
							class="manage-chip active:opacity-70"
							data-selected={userSettings.meditationDefaultDurationMinutes === min}
						>{min} min</button>
					{/each}
				</div>
			</div>

			<!-- Prep seconds -->
			<div class="manage-section">
				<p class="manage-label">{t.meditation_prep_seconds}</p>
				<div class="manage-chip-grid">
					{#each PREP_OPTIONS as sec}
						<button
							onclick={() => userSettings.meditationPrepSeconds = sec}
							class="manage-chip active:opacity-70"
							data-selected={userSettings.meditationPrepSeconds === sec}
						>{sec === 0 ? t.meditation_prep_none : `${sec} s`}</button>
					{/each}
				</div>
			</div>

			<!-- Volume -->
			<div class="manage-section">
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
			<div class="manage-section">
				<p class="manage-section-title">{t.meditation_start_sound}</p>
				<div class="space-y-1.5">
					{#each MEDITATION_SOUNDS as snd}
						<div class="flex items-center gap-2">
							<button
								onclick={() => userSettings.meditationStartSound = snd.filename}
								class="manage-chip flex-1 text-left active:opacity-70"
								data-selected={userSettings.meditationStartSound === snd.filename}
							>{soundLabel(snd.filename)}</button>
							<button
								onclick={() => preview(snd.filename)}
								class="manage-icon-button active:opacity-60"
								style="width: 36px; height: 36px; color: var(--color-on-surface-variant)"
								aria-label="Play"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>

			<!-- End sound -->
			<div class="manage-section">
				<p class="manage-section-title">{t.meditation_end_sound}</p>
				<div class="space-y-1.5">
					{#each MEDITATION_SOUNDS as snd}
						<div class="flex items-center gap-2">
							<button
								onclick={() => userSettings.meditationEndSound = snd.filename}
								class="manage-chip flex-1 text-left active:opacity-70"
								data-selected={userSettings.meditationEndSound === snd.filename}
							>{soundLabel(snd.filename)}</button>
							<button
								onclick={() => preview(snd.filename)}
								class="manage-icon-button active:opacity-60"
								style="width: 36px; height: 36px; color: var(--color-on-surface-variant)"
								aria-label="Play"
							>
								<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
							</button>
						</div>
					{/each}
				</div>
			</div>

			</div>
		{/snippet}
		{#snippet footer()}
			<button
				onclick={close}
				class="manage-primary col-span-2 active:opacity-70"
			>{t.close}</button>
		{/snippet}
	</ManageSheetShell>
{/if}
