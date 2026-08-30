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
	<ManageSheetShell accent="#9F7AEA" title={t.meditation_edit_title} onclose={close}>
		{#snippet body()}
			<div class="manage-settings-surface">
				<!-- Daily goal -->
				<label class="manage-settings-row meditation-choice-row">
					<span class="manage-settings-label">{t.meditation_goal_label}</span>
					<select
						value={userSettings.meditationDailyGoalMinutes}
						onchange={(event) => userSettings.meditationDailyGoalMinutes = Number(event.currentTarget.value)}
						class="meditation-select"
					>
					{#each GOAL_OPTIONS as min}
						<option value={min}>{min} min</option>
					{/each}
					</select>
				</label>

				<!-- Default duration -->
				<label class="manage-settings-row meditation-choice-row">
					<span class="manage-settings-label">{t.meditation_default_duration}</span>
					<select
						value={userSettings.meditationDefaultDurationMinutes}
						onchange={(event) => userSettings.meditationDefaultDurationMinutes = Number(event.currentTarget.value)}
						class="meditation-select"
					>
					{#each DURATION_OPTIONS as min}
						<option value={min}>{min} min</option>
					{/each}
					</select>
				</label>

				<!-- Preparation -->
				<label class="manage-settings-row meditation-choice-row">
					<span class="manage-settings-label">{t.meditation_prep_seconds}</span>
					<select
						value={userSettings.meditationPrepSeconds}
						onchange={(event) => userSettings.meditationPrepSeconds = Number(event.currentTarget.value)}
						class="meditation-select"
					>
					{#each PREP_OPTIONS as sec}
						<option value={sec}>{sec === 0 ? t.meditation_prep_none : `${sec} s`}</option>
					{/each}
					</select>
				</label>

				<!-- Volume -->
				<label class="manage-settings-row meditation-volume-row">
					<span class="meditation-volume-heading">
						<span class="manage-settings-label">{t.meditation_volume}</span>
						<span class="meditation-value">{userSettings.meditationVolume ?? 70}%</span>
					</span>
					<input
						type="range"
						min="0"
						max="100"
						step="5"
						value={userSettings.meditationVolume ?? 70}
						oninput={(event) => userSettings.meditationVolume = Number(event.currentTarget.value)}
						class="meditation-volume"
					/>
				</label>

				<!-- Start sound -->
				<div class="manage-settings-row meditation-sound-row">
					<label class="manage-settings-label" for="meditation-start-sound">{t.meditation_start_sound}</label>
					<select
						id="meditation-start-sound"
						value={userSettings.meditationStartSound}
						onchange={(event) => userSettings.meditationStartSound = event.currentTarget.value}
						class="meditation-select"
					>
					{#each MEDITATION_SOUNDS as snd}
						<option value={snd.filename}>{soundLabel(snd.filename)}</option>
					{/each}
					</select>
					<button
						type="button"
						onclick={() => preview(userSettings.meditationStartSound)}
						class="meditation-preview active:opacity-60"
						aria-label={t.meditation_preview_sound}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
					</button>
				</div>

				<!-- End sound -->
				<div class="manage-settings-row meditation-sound-row">
					<label class="manage-settings-label" for="meditation-end-sound">{t.meditation_end_sound}</label>
					<select
						id="meditation-end-sound"
						value={userSettings.meditationEndSound}
						onchange={(event) => userSettings.meditationEndSound = event.currentTarget.value}
						class="meditation-select"
					>
					{#each MEDITATION_SOUNDS as snd}
						<option value={snd.filename}>{soundLabel(snd.filename)}</option>
					{/each}
					</select>
					<button
						type="button"
						onclick={() => preview(userSettings.meditationEndSound)}
						class="meditation-preview active:opacity-60"
						aria-label={t.meditation_preview_sound}
					>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>
					</button>
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

<style>
	.meditation-choice-row,
	.meditation-sound-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, auto);
		align-items: center;
		gap: 12px;
	}

	.meditation-sound-row {
		grid-template-columns: minmax(82px, 0.75fr) minmax(0, 1.25fr) 32px;
		gap: 8px;
	}

	.meditation-select {
		min-width: 0;
		max-width: 100%;
		height: 40px;
		padding: 0;
		border: 0;
		outline: 0;
		appearance: none;
		background: transparent;
		color: #9F7AEA;
		font-size: 16px;
		font-weight: 600;
		text-align: right;
		text-align-last: right;
	}

	.meditation-volume-row {
		display: grid;
		gap: 2px;
		padding-block: 7px;
	}

	.meditation-volume-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.meditation-value {
		color: #9F7AEA;
		font-size: 16px;
		font-weight: 600;
	}

	.meditation-volume {
		width: 100%;
		height: 24px;
		accent-color: #9F7AEA;
	}

	.meditation-preview {
		display: flex;
		width: 32px;
		height: 40px;
		align-items: center;
		justify-content: center;
		color: #9F7AEA;
	}
</style>
