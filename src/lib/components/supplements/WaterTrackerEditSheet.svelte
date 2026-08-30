<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';

	let {
		open = $bindable<boolean>(false)
	}: {
		open: boolean;
	} = $props();

	let goalInput = $state(String(userSettings.waterGoalMl ?? 2000));
	let presetInputs = $state<[string, string]>(['100', '200']);

	$effect(() => {
		if (open) {
			goalInput = String(userSettings.waterGoalMl ?? 2000);
			const p = userSettings.waterPresets ?? [100, 200];
			presetInputs = [String(p[0]), String(p[1])];
		}
	});

	function saveGoal() {
		const val = Math.max(1, Math.round(Number(goalInput)) || 2000);
		userSettings.waterGoalMl = val;
		goalInput = String(val);
	}

	function savePresets() {
		const vals = presetInputs.map(v => Math.max(1, Math.round(Number(v)) || 1));
		userSettings.waterPresets = [vals[0], vals[1]];
		presetInputs = [String(vals[0]), String(vals[1])];
	}

	function selectValue(event: FocusEvent) {
		(event.currentTarget as HTMLInputElement).select();
	}
</script>

{#if open}
	<ManageSheetShell accent="#60A5FA" title={t.water_edit_title} onclose={() => open = false}>
		{#snippet body()}
			<section class="manage-settings-surface">
				<label class="manage-settings-row grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3">
					<span class="manage-settings-label">{t.water_goal_label}</span>
					<span class="grid grid-cols-[minmax(0,1fr)_22px] items-center gap-1">
						<input type="number" inputmode="numeric" min="1" bind:value={goalInput} onfocus={selectValue} onblur={saveGoal} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveGoal()} class="manage-settings-input text-right" />
						<span class="manage-settings-unit">ml</span>
					</span>
				</label>
				<div class="manage-settings-row grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3">
					<span class="manage-settings-label">{t.water_presets_label}</span>
					<div class="grid grid-cols-2 gap-2">
						{#each presetInputs as _, i}
							<label class="grid grid-cols-[minmax(0,1fr)_20px] items-center gap-1">
								<input type="number" inputmode="numeric" min="1" bind:value={presetInputs[i]} onfocus={selectValue} onblur={savePresets} onkeydown={(e) => e.key === 'Enter' && savePresets()} class="manage-settings-input text-right" aria-label="{t.water_presets_label} {i + 1}" />
								<span class="manage-settings-unit">ml</span>
							</label>
						{/each}
					</div>
				</div>
			</section>
		{/snippet}
		{#snippet footer()}
				<button
					onclick={() => open = false}
					class="manage-secondary active:opacity-70"
				>{t.close}</button>
				<button
					onclick={() => { saveGoal(); savePresets(); open = false; }}
					class="manage-primary active:opacity-80"
				>{t.supplement_reminders_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}
