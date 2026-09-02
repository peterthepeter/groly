<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

{#if open}
	<ManageSheetShell accent="#F472B6" title={t.mood_settings_title} onclose={() => open = false} showFooter={false}>
		{#snippet body()}
			<section class="manage-settings-surface">
				<div class="manage-settings-row flex items-center gap-3">
					<div class="flex-1 min-w-0"><p class="manage-settings-label">{t.mood_weekly_setting}</p><p class="manage-settings-hint">{t.mood_weekly_setting_desc}</p></div>
					<button onclick={() => userSettings.moodWeeklyReviewEnabled = !userSettings.moodWeeklyReviewEnabled} class="shrink-0 w-10 h-5 rounded-full relative overflow-hidden transition-colors" style="background-color:{userSettings.moodWeeklyReviewEnabled ? '#F472B6' : 'var(--color-surface-container)'}" role="switch" aria-checked={userSettings.moodWeeklyReviewEnabled} aria-label={t.mood_weekly_setting}>
						<span class="absolute top-0.5 left-0 h-4 w-4 rounded-full transition-transform" style="background:white;transform:translateX({userSettings.moodWeeklyReviewEnabled ? '1.25rem' : '0.125rem'})"></span>
					</button>
				</div>
			</section>
		{/snippet}
	</ManageSheetShell>
{/if}
