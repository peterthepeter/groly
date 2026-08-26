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
</script>

{#if open}
	<ManageSheetShell accent="#60A5FA" title={t.water_edit_title} onclose={() => open = false}>
		{#snippet body()}
			<div class="manage-section">
				<div class="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3 pb-2">
					<p class="m-0 text-sm font-semibold" style="color: var(--color-on-surface-variant)">{t.water_goal_label}</p>
					<div class="grid grid-cols-[minmax(0,1fr)_22px] items-center gap-1">
						<input type="number" inputmode="numeric" min="1" bind:value={goalInput} onblur={saveGoal} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveGoal()} class="manage-input text-center font-semibold" style="height: 36px; color: #60A5FA" />
						<span class="text-xs" style="color: var(--color-on-surface-variant)">ml</span>
					</div>
				</div>
				<div class="grid grid-cols-[minmax(0,1fr)_128px] items-center gap-3 border-t pt-2" style="border-color: var(--bubble-container-border)">
					<p class="m-0 text-sm font-semibold" style="color: var(--color-on-surface-variant)">{t.water_presets_label}</p>
					<div class="grid grid-cols-2 gap-1.5">
						{#each presetInputs as _, i}
							<label class="relative">
								<input type="number" inputmode="numeric" min="1" bind:value={presetInputs[i]} onblur={savePresets} onkeydown={(e) => e.key === 'Enter' && savePresets()} class="manage-input text-center font-semibold" style="height: 36px; padding-right: 16px; color: #60A5FA" />
								<span class="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[9px]" style="color: var(--color-on-surface-variant)">ml</span>
							</label>
						{/each}
					</div>
				</div>
			</div>
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
