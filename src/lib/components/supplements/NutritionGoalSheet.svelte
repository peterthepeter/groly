<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
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
	let sex = $state<'female' | 'male'>('male');
	let age = $state('30');
	let height = $state('175');
	let weight = $state('70');
	let activity = $state<'sedentary' | 'light' | 'moderate' | 'active' | 'very-active'>('light');

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

	const ACTIVITY_FACTORS = {
		sedentary: 1.2,
		light: 1.375,
		moderate: 1.55,
		active: 1.725,
		'very-active': 1.9
	};

	const calculated = $derived.by(() => {
		const a = parseInt(age, 10);
		const h = parseFloat(height);
		const w = parseFloat(weight);
		if (!Number.isFinite(a) || a < 10 || a > 120) return null;
		if (!Number.isFinite(h) || h < 100 || h > 250) return null;
		if (!Number.isFinite(w) || w < 30 || w > 300) return null;
		// Mifflin-St Jeor
		const bmr = sex === 'male'
			? 10 * w + 6.25 * h - 5 * a + 5
			: 10 * w + 6.25 * h - 5 * a - 161;
		const tdee = Math.round(bmr * ACTIVITY_FACTORS[activity]);
		return { bmr: Math.round(bmr), tdee };
	});

	// Protein g/kg je nach Aktivitätslevel (DGE / ISSN angelehnt).
	const PROTEIN_PER_KG = {
		sedentary: 0.8,
		light: 1.2,
		moderate: 1.4,
		active: 1.6,
		'very-active': 1.8
	};

	function applyCalculatedToFields() {
		if (!calculated) return;
		const k = calculated.tdee;
		const w = parseFloat(weight);
		kcal = String(k);
		if (Number.isFinite(w) && w >= 30 && w <= 300) {
			const proteinG = Math.round(w * PROTEIN_PER_KG[activity]);
			const fatG = Math.round((k * 0.3) / 9);
			const carbsG = Math.max(0, Math.round((k - proteinG * 4 - fatG * 9) / 4));
			protein = String(proteinG);
			fat = String(fatG);
			carbs = String(carbsG);
		}
		if (!fiber.trim()) fiber = '30';
	}

	// Live-Update: Änderungen an Sex / Age / Height / Weight / Activity
	// übernehmen kcal + Makros automatisch in die Felder.
	$effect(() => {
		void sex; void age; void height; void weight; void activity;
		applyCalculatedToFields();
	});

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
			<section class="manage-section">
				<!-- Rechner: zuerst Daten eingeben, dann wird berechnet -->
				<p class="text-xs mb-3" style="color: var(--color-on-surface-variant)">
					{t.nutrition_calc_intro}
				</p>

				<!-- Geschlecht -->
				<div class="manage-chip-grid mb-3 !grid-cols-2">
					<button type="button" onclick={() => (sex = 'female')}
					        class="manage-chip" data-selected={sex === 'female'}>
						{t.nutrition_female}
					</button>
					<button type="button" onclick={() => (sex = 'male')}
					        class="manage-chip" data-selected={sex === 'male'}>
						{t.nutrition_male}
					</button>
				</div>

				<div class="grid grid-cols-3 gap-2 mb-3">
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_age}</span>
						<input type="text" inputmode="numeric" value={age}
						       oninput={(e) => (age = digitsOnly((e.target as HTMLInputElement).value))}
						       class="manage-input mt-1" />
					</label>
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_height_cm}</span>
						<input type="text" inputmode="numeric" value={height}
						       oninput={(e) => (height = digitsOnly((e.target as HTMLInputElement).value))}
						       class="manage-input mt-1" />
					</label>
					<label class="block">
						<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_weight_kg}</span>
						<input type="text" inputmode="decimal" value={weight}
						       oninput={(e) => (weight = decimalOnly((e.target as HTMLInputElement).value))}
						       class="manage-input mt-1" />
					</label>
				</div>

				<label class="block mb-3">
					<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.nutrition_activity}</span>
					<select bind:value={activity}
					        class="manage-select mt-1 appearance-none">
						<option value="sedentary">{t.nutrition_activity_sedentary}</option>
						<option value="light">{t.nutrition_activity_light}</option>
						<option value="moderate">{t.nutrition_activity_moderate}</option>
						<option value="active">{t.nutrition_activity_active}</option>
						<option value="very-active">{t.nutrition_activity_very_active}</option>
					</select>
				</label>

				<div class="text-xs mb-3" style="color: var(--color-on-surface-variant); min-height: 1.25rem">
					{#if calculated}
						{t.nutrition_estimated_tdee}: <span class="font-semibold tabular-nums" style="color: #FB923C">{calculated.tdee} kcal</span> · BMR {calculated.bmr} kcal
					{:else}
						{t.nutrition_calc_need_inputs}
					{/if}
				</div>

		<div class="h-px mb-3" style="background-color: var(--bubble-interactive-border)"></div>

		<!-- Tagesziel: kcal + Makros (werden vom Rechner befüllt, manuell überschreibbar) -->
		<label class="block mb-3">
			<span class="text-xs uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.nutrition_daily_kcal}</span>
			<input type="text" inputmode="numeric" value={kcal}
			       oninput={(e) => (kcal = digitsOnly((e.target as HTMLInputElement).value))}
			       placeholder="2000"
		       class="manage-input mt-1" />
		</label>

		<!-- Makros (optional) -->
		<div class="text-xs uppercase tracking-wide mb-2" style="color: var(--color-on-surface-variant)">
			{t.nutrition_protein} · {t.nutrition_fat} · {t.nutrition_carbs} · {t.nutrition_fiber}
		</div>
		<div class="grid grid-cols-4 gap-2">
			<label class="block">
				<span class="text-[11px]" style="color: var(--color-on-surface-variant)">{t.nutrition_protein_g}</span>
				<input type="text" inputmode="numeric" value={protein}
				       oninput={(e) => (protein = digitsOnly((e.target as HTMLInputElement).value))}
				       class="manage-input mt-1 !px-2" />
			</label>
			<label class="block">
				<span class="text-[11px]" style="color: var(--color-on-surface-variant)">{t.nutrition_fat_g}</span>
				<input type="text" inputmode="numeric" value={fat}
				       oninput={(e) => (fat = digitsOnly((e.target as HTMLInputElement).value))}
				       class="manage-input mt-1 !px-2" />
			</label>
			<label class="block">
				<span class="text-[11px]" style="color: var(--color-on-surface-variant)">{t.nutrition_carbs_g}</span>
				<input type="text" inputmode="numeric" value={carbs}
				       oninput={(e) => (carbs = digitsOnly((e.target as HTMLInputElement).value))}
				       class="manage-input mt-1 !px-2" />
			</label>
			<label class="block">
				<span class="text-[11px]" style="color: var(--color-on-surface-variant)">{t.nutrition_fiber_g}</span>
				<input type="text" inputmode="numeric" value={fiber}
				       oninput={(e) => (fiber = digitsOnly((e.target as HTMLInputElement).value))}
				       class="manage-input mt-1 !px-2" />
			</label>
		</div>
			</section>
		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" onclick={onclose} class="manage-secondary">{t.nutrition_cancel}</button>
		<button type="button" onclick={save} disabled={saving} class="manage-primary disabled:opacity-40">{saving ? '…' : t.nutrition_save}</button>
	{/snippet}
</ManageSheetShell>
