<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { calculateNutritionTargets, type NutritionActivity, type NutritionSex } from '$lib/nutritionUtils';
	import ManageSheetShell from './ManageSheetShell.svelte';

	let {
		initialKcal = null,
		initialProtein = null,
		initialFat = null,
		initialCarbs = null,
		initialFiber = null,
		onclose,
		onsaved
	}: {
		initialKcal: number | null;
		initialProtein: number | null;
		initialFat: number | null;
		initialCarbs: number | null;
		initialFiber: number | null;
		onclose: () => void;
		onsaved: () => void;
	} = $props();

	// svelte-ignore state_referenced_locally
	let kcal = $state(initialKcal != null ? String(initialKcal) : '');
	// svelte-ignore state_referenced_locally
	let protein = $state(initialProtein != null ? String(initialProtein) : '');
	// svelte-ignore state_referenced_locally
	let fat = $state(initialFat != null ? String(initialFat) : '');
	// svelte-ignore state_referenced_locally
	let carbs = $state(initialCarbs != null ? String(initialCarbs) : '');
	// svelte-ignore state_referenced_locally
	let fiber = $state(initialFiber != null ? String(initialFiber) : '30');

	// Rechner – Werte werden in localStorage gemerkt
	let sex = $state<NutritionSex>('male');
	let age = $state('30');
	let height = $state('175');
	let weight = $state('70');
	let activity = $state<NutritionActivity>('light');

	// Sheet folgt visualViewport (Tastatur + iOS-Auto-Scroll)
	let maxHeight = $state(typeof window !== 'undefined' ? window.innerHeight : 800);
	let bottomOffset = $state(0);

	onMount(() => {
		try {
			const raw = localStorage.getItem('nutrition-calc');
			if (raw) {
				const v = JSON.parse(raw);
				if (v.sex === 'female' || v.sex === 'male') sex = v.sex;
				if (typeof v.age === 'string') age = v.age;
				if (typeof v.height === 'string') height = v.height;
				if (typeof v.weight === 'string') weight = v.weight;
				if (['sedentary', 'light', 'moderate', 'active', 'very-active'].includes(v.activity)) activity = v.activity;
			}
		} catch {
			// noop
		}
		const prevOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';
		const vv = window.visualViewport;
		const update = () => {
			if (vv) {
				maxHeight = vv.height;
				bottomOffset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
			} else {
				maxHeight = window.innerHeight;
				bottomOffset = 0;
			}
		};
		update();
		vv?.addEventListener('resize', update);
		vv?.addEventListener('scroll', update);
		return () => {
			document.body.style.overflow = prevOverflow;
			vv?.removeEventListener('resize', update);
			vv?.removeEventListener('scroll', update);
		};
	});

	$effect(() => {
		try {
			localStorage.setItem('nutrition-calc', JSON.stringify({ sex, age, height, weight, activity }));
		} catch {
			// noop
		}
	});

	const calculated = $derived.by(() => {
		return calculateNutritionTargets({
			sex,
			age: parseInt(age, 10),
			heightCm: parseFloat(height),
			weightKg: parseFloat(weight),
			activity
		});
	});

	function applyCalculatedToFields() {
		if (!calculated) return;
		kcal = String(calculated.tdee);
		protein = String(calculated.protein);
		fat = String(calculated.fat);
		carbs = String(calculated.carbs);
		fiber = String(calculated.fiber);
	}

	// Input-Sanitizer
	function digitsOnly(v: string): string {
		return v.replace(/[^0-9]/g, '');
	}
	function decimalOnly(v: string): string {
		// Erlaube Ziffern, Komma, Punkt; nur ein Trennzeichen insgesamt
		const cleaned = v.replace(/[^0-9.,]/g, '');
		const firstSep = cleaned.search(/[.,]/);
		if (firstSep === -1) return cleaned;
		return cleaned.slice(0, firstSep + 1) + cleaned.slice(firstSep + 1).replace(/[.,]/g, '');
	}

	function selectValue(event: FocusEvent) {
		(event.currentTarget as HTMLInputElement).select();
	}

	let saving = $state(false);
	async function save() {
		if (saving) return;
		saving = true;
		try {
			const payload = {
				dailyKcal: kcal.trim() ? parseInt(kcal, 10) : null,
				dailyProtein: protein.trim() ? parseFloat(protein.replace(',', '.')) : null,
				dailyFat: fat.trim() ? parseFloat(fat.replace(',', '.')) : null,
				dailyCarbs: carbs.trim() ? parseFloat(carbs.replace(',', '.')) : null,
				dailyFiber: fiber.trim() ? parseFloat(fiber.replace(',', '.')) : null
			};
			const res = await fetch('/api/nutrition/goals', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (res.ok) onsaved();
		} finally {
			saving = false;
		}
	}
</script>

<ManageSheetShell accent="#FB923C" title={t.nutrition_daily_goal} {onclose} zIndex={60} bottom={`${bottomOffset}px`} maxHeight={`${maxHeight}px`}>
	{#snippet body()}
		<div class="manage-stack">
			<div>
				<span class="manage-section-title">{t.nutrition_calculator_section}</span>
				<section class="manage-settings-surface">
			<p class="nutrition-intro">{t.nutrition_calc_intro}</p>

			<label class="manage-settings-row nutrition-choice-row">
				<span class="manage-settings-label">{t.nutrition_sex}</span>
				<select bind:value={sex} class="nutrition-select">
					<option value="female">{t.nutrition_female}</option>
					<option value="male">{t.nutrition_male}</option>
				</select>
			</label>

			<div class="manage-settings-row nutrition-number-grid nutrition-number-grid-three">
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_age}</span>
					<input type="text" inputmode="numeric" value={age} onfocus={selectValue}
						oninput={(event) => (age = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_height_cm}</span>
					<input type="text" inputmode="numeric" value={height} onfocus={selectValue}
						oninput={(event) => (height = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_weight_kg}</span>
					<input type="text" inputmode="decimal" value={weight} onfocus={selectValue}
						oninput={(event) => (weight = decimalOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
			</div>

			<label class="manage-settings-row nutrition-choice-row">
				<span class="manage-settings-label">{t.nutrition_activity}</span>
				<select bind:value={activity} class="nutrition-select nutrition-activity-select">
					<option value="sedentary">{t.nutrition_activity_sedentary}</option>
					<option value="light">{t.nutrition_activity_light}</option>
					<option value="moderate">{t.nutrition_activity_moderate}</option>
					<option value="active">{t.nutrition_activity_active}</option>
					<option value="very-active">{t.nutrition_activity_very_active}</option>
				</select>
			</label>

			<div class="manage-settings-row nutrition-estimate-row">
				<span class="manage-settings-label">{t.nutrition_estimated_tdee}</span>
				{#if calculated}
					<span class="nutrition-estimate-values">
						<strong>{calculated.tdee} kcal</strong>
						<small>BMR {calculated.bmr} kcal</small>
					</span>
				{:else}
					<span class="nutrition-estimate-empty">{t.nutrition_calc_need_inputs}</span>
				{/if}
			</div>
			{#if calculated}
				<div class="nutrition-apply-row">
					<button type="button" onclick={applyCalculatedToFields} class="nutrition-apply-estimate">
						{t.nutrition_apply_estimate}
					</button>
				</div>
			{/if}
				</section>
			</div>

			<div>
				<span class="manage-section-title">{t.nutrition_targets_section}</span>
				<section class="manage-settings-surface">
			<label class="manage-settings-row nutrition-choice-row">
				<span class="manage-settings-label">{t.nutrition_daily_kcal}</span>
				<input type="text" inputmode="numeric" value={kcal} placeholder="2000" onfocus={selectValue}
					oninput={(event) => (kcal = digitsOnly(event.currentTarget.value))}
					class="nutrition-inline-input" />
			</label>

			<div class="manage-settings-row nutrition-number-grid">
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_protein_g}</span>
					<input type="text" inputmode="numeric" value={protein} onfocus={selectValue}
						oninput={(event) => (protein = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_fat_g}</span>
					<input type="text" inputmode="numeric" value={fat} onfocus={selectValue}
						oninput={(event) => (fat = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
			</div>

			<div class="manage-settings-row nutrition-number-grid">
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_carbs_g}</span>
					<input type="text" inputmode="numeric" value={carbs} onfocus={selectValue}
						oninput={(event) => (carbs = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
				<label class="nutrition-number-field">
					<span class="manage-settings-label">{t.nutrition_fiber_g}</span>
					<input type="text" inputmode="numeric" value={fiber} onfocus={selectValue}
						oninput={(event) => (fiber = digitsOnly(event.currentTarget.value))}
						class="nutrition-number-input" />
				</label>
			</div>
				</section>
			</div>
		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" onclick={onclose} class="manage-secondary">{t.nutrition_cancel}</button>
		<button type="button" onclick={save} disabled={saving} class="manage-primary disabled:opacity-40">{saving ? '…' : t.nutrition_save}</button>
	{/snippet}
</ManageSheetShell>

<style>
	.nutrition-intro {
		min-height: 38px;
		padding: 9px 12px;
		color: var(--color-on-surface-variant);
		font-size: 12px;
		font-weight: 550;
		line-height: 1.35;
	}

	.nutrition-choice-row,
	.nutrition-estimate-row {
		display: grid;
		grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
		align-items: center;
		gap: 12px;
	}

	.nutrition-select,
	.nutrition-inline-input,
	.nutrition-number-input {
		min-width: 0;
		height: 36px;
		padding: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: #FB923C;
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.nutrition-select {
		max-width: 100%;
		appearance: none;
		text-align: right;
		text-align-last: right;
	}

	.nutrition-activity-select {
		width: 100%;
		white-space: nowrap;
		text-overflow: ellipsis;
	}

	.nutrition-inline-input {
		width: 100%;
		text-align: right;
	}

	.nutrition-number-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		align-items: center;
		gap: 20px;
		padding-block: 6px;
	}

	.nutrition-number-grid-three {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.nutrition-number-field {
		display: grid;
		min-width: 0;
		gap: 1px;
	}

	.nutrition-number-input {
		width: 100%;
	}

	.nutrition-estimate-values {
		display: grid;
		justify-items: end;
		line-height: 1.15;
	}

	.nutrition-estimate-values strong {
		color: #FB923C;
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.nutrition-estimate-values small,
	.nutrition-estimate-empty {
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 550;
	}

	.nutrition-estimate-empty {
		text-align: right;
	}

	.nutrition-apply-row {
		display: flex;
		justify-content: flex-end;
		padding: 7px 9px 9px;
		border-top: 1px solid var(--bubble-container-border);
	}

	.nutrition-apply-estimate {
		min-height: 36px;
		padding-inline: 14px;
		border: 1px solid color-mix(in srgb, #FB923C 52%, transparent);
		border-radius: 12px;
		color: #FB923C;
		font-size: 12px;
		font-weight: 650;
		touch-action: manipulation;
	}
</style>
