<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';

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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => open = false}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="p-6 space-y-5">
			<div class="flex justify-center mb-1">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<div class="flex items-center gap-2">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
				</svg>
				<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.water_edit_title}</p>
			</div>

			<!-- Goal section -->
			<div class="rounded-2xl p-4 space-y-3" style="background-color: var(--color-surface-card)">
				<p class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.water_goal_label}</p>
				<div class="flex items-center gap-2">
					<input
						type="number"
						inputmode="numeric"
						min="1"
						bind:value={goalInput}
						onblur={saveGoal}
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveGoal()}
						class="flex-1 h-10 px-3 rounded-xl border-0 outline-none font-semibold"
						style="background-color: var(--color-surface-container); color: #60A5FA; font-size: 16px"
					/>
					<span class="text-sm shrink-0" style="color: var(--color-on-surface-variant)">ml</span>
				</div>
			</div>

			<!-- Presets section -->
			<div class="rounded-2xl p-4 space-y-3" style="background-color: var(--color-surface-card)">
				<p class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.water_presets_label}</p>
				<div class="flex gap-2">
					{#each presetInputs as _, i}
						<div class="flex-1 flex items-center gap-1">
							<input
								type="number"
								inputmode="numeric"
								min="1"
								bind:value={presetInputs[i]}
								onblur={savePresets}
								onkeydown={(e) => e.key === 'Enter' && savePresets()}
								class="w-full h-10 px-2 rounded-xl border-0 outline-none text-center font-semibold"
								style="background-color: var(--color-surface-container); color: #60A5FA; font-size: 16px"
							/>
							<span class="text-[10px] shrink-0" style="color: var(--color-on-surface-variant)">ml</span>
						</div>
					{/each}
				</div>
			</div>

			<div class="flex gap-2">
				<button
					onclick={() => open = false}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.close}</button>
				<button
					onclick={() => { saveGoal(); savePresets(); open = false; }}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80"
					style="background: linear-gradient(135deg, #60A5FA, #3B82F6); color: white"
				>{t.supplement_reminders_save}</button>
			</div>
		</div>
	</div>
{/if}
