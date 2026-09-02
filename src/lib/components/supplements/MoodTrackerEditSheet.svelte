<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import SupplementActiveToggle from './SupplementActiveToggle.svelte';
	let { open = $bindable(false) }: { open: boolean } = $props();
</script>

{#if open}
	<ManageSheetShell accent="#F472B6" title={t.mood_settings_title} onclose={() => open = false}>
		{#snippet body()}
			<section class="manage-settings-surface">
				<div class="manage-settings-row mood-toggle-row">
					<div><strong>{t.mood_weekly_setting}</strong><span>{t.mood_weekly_setting_desc}</span></div>
					<SupplementActiveToggle active={userSettings.moodWeeklyReviewEnabled} label={t.mood_weekly_setting} onclick={() => userSettings.moodWeeklyReviewEnabled = !userSettings.moodWeeklyReviewEnabled} accent="#F472B6" />
				</div>
			</section>
		{/snippet}
		{#snippet footer()}<button onclick={() => open = false} class="manage-primary col-span-2 active:opacity-70">{t.close}</button>{/snippet}
	</ManageSheetShell>
{/if}

<style>
	.mood-toggle-row { display: flex; align-items: center; gap: 12px; }
	.mood-toggle-row > div { display: grid; min-width: 0; flex: 1; gap: 2px; }
	.mood-toggle-row strong { color: var(--color-on-surface); font-size: 13px; font-weight: 600; line-height: 1.25; }
	.mood-toggle-row span { color: var(--color-on-surface-variant); font-size: 11px; line-height: 1.35; }
</style>
