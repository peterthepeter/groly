<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';
	import ManageSheetShell from '$lib/components/supplements/ManageSheetShell.svelte';

	type Comp = {
		productBarcode: string | null;
		genericFoodId: string | null;
		customName: string | null;
		displayName: string;
		imageUrl: string | null;
		amount: number;
		unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null;
		kcalPer100: number | null;
		proteinPer100: number | null;
		fatPer100: number | null;
		carbsPer100: number | null;
		sugarPer100: number | null;
		fiberPer100: number | null;
		saltPer100: number | null;
	};

	let { recipeTitle, recipeImageUrl, components, mappedServings, onclose, onsaved }: {
		recipeTitle: string;
		recipeImageUrl: string | null;
		components: Comp[];
		mappedServings: number;
		onclose: () => void;
		onsaved?: (kcal: number) => void;
	} = $props();

	const ACCENT = '#FB923C';

	function pad(n: number) { return String(n).padStart(2, '0'); }
	const now = new Date();
	let portions = $state(1);
	let date = $state(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
	let time = $state(`${pad(now.getHours())}:${pad(now.getMinutes())}`);
	let saving = $state(false);

	// Meal-Name wie beim normalen Loggen: Auswahl + nach Uhrzeit vorbelegt; Rezept bleibt
	// der Gericht-Block (favoriteName), damit der Name nicht doppelt erscheint.
	const MEAL_NAMES = $derived([t.meal_name_breakfast, t.meal_name_lunch, t.meal_name_vesper, t.meal_name_dinner, t.meal_name_snack]);
	function defaultMealName(tm: string): string {
		const [h, m] = tm.split(':').map(Number);
		const minutes = h * 60 + (m || 0);
		if (minutes < 4 * 60) return t.meal_name_snack;
		if (minutes <= 10 * 60 + 30) return t.meal_name_breakfast;
		if (minutes <= 14 * 60 + 30) return t.meal_name_lunch;
		if (minutes <= 17 * 60 + 30) return t.meal_name_vesper;
		if (minutes <= 22 * 60) return t.meal_name_dinner;
		return t.meal_name_snack;
	}
	let name = $state(defaultMealName(`${pad(now.getHours())}:${pad(now.getMinutes())}`));
	let customMode = $state(false);

	const scale = $derived(mappedServings > 0 ? portions / mappedServings : 0);

	onMount(() => {
		try { history.pushState(null, '', location.href); } catch { /* noop */ }
	});
	// Zurück/Wische schließt das Sheet, statt das Rezept zu verlassen.
	beforeNavigate(({ type, cancel }) => {
		if (type !== 'popstate') return;
		cancel();
		onclose();
	});

	function effGrams(c: Comp): number {
		return c.unit === 'piece' ? c.amount * (c.gramsPerPiece ?? 0) : c.amount;
	}
	const totalKcal = $derived(
		Math.round(components.reduce((s, c) => s + ((c.kcalPer100 ?? 0) * effGrams(c)) / 100, 0) * scale)
	);
	const basePerPortionKcal = $derived(
		mappedServings > 0
			? Math.round(components.reduce((s, c) => s + ((c.kcalPer100 ?? 0) * effGrams(c)) / 100, 0) / mappedServings)
			: 0
	);

	function changePortions(d: number) {
		const next = portions + d;
		if (next >= 0.5) portions = parseFloat(next.toFixed(1));
	}

	async function save() {
		if (saving || portions <= 0 || components.length === 0) return;
		saving = true;
		try {
			const scaled = components.map((c) => ({
				productBarcode: c.productBarcode,
				genericFoodId: c.genericFoodId,
				customName: c.customName,
				displayName: c.displayName,
				imageUrl: c.imageUrl,
				amount: parseFloat((c.amount * scale).toFixed(2)),
				unit: c.unit,
				gramsPerPiece: c.gramsPerPiece,
				kcalPer100: c.kcalPer100,
				proteinPer100: c.proteinPer100,
				fatPer100: c.fatPer100,
				carbsPer100: c.carbsPer100,
				sugarPer100: c.sugarPer100,
				fiberPer100: c.fiberPer100,
				saltPer100: c.saltPer100
			})).filter((c) => c.amount > 0);
			const res = await fetch('/api/nutrition/meals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: (name.trim() || recipeTitle).slice(0, 60),
					favoriteName: recipeTitle,
					imageUrl: recipeImageUrl,
					date,
					time,
					components: scaled
				})
			});
			if (res.ok) {
				onsaved?.(totalKcal);
				onclose();
			}
		} finally {
			saving = false;
		}
	}
</script>

<ManageSheetShell accent={ACCENT} title={t.recipe_track_title} {onclose} zIndex={61} maxHeight="92dvh">
	{#snippet body()}
		<div class="manage-stack">
			<section class="recipe-track-identity">
				{#if recipeImageUrl}<img src={recipeImageUrl} alt="" />{:else}<span>{recipeTitle.slice(0, 1).toUpperCase()}</span>{/if}
				<div><strong>{recipeTitle}</strong><small>{components.length} {t.nutrition_ingredients} · {basePerPortionKcal} kcal/{t.recipe_nutrition_per_portion_short}</small></div>
			</section>
			<section class="manage-settings-surface">
				<div class="manage-settings-row recipe-name-row">
					{#if customMode}<input type="text" bind:value={name} placeholder={t.nutrition_name_placeholder} class="manage-settings-input" />{:else}<select bind:value={name} onchange={(event) => { const value = event.currentTarget.value; if (value === '__custom__') { customMode = true; name = ''; } }} class="recipe-flat-select">{#each MEAL_NAMES as mealName}<option value={mealName}>{mealName}</option>{/each}<option value="__custom__">{t.nutrition_custom_name_option}</option></select>{/if}
				</div>
				<div class="manage-settings-row recipe-portions-row">
					<span class="manage-settings-label">{t.recipe_nutrition_portions}</span>
					<div><button type="button" onclick={() => changePortions(-0.5)} disabled={portions <= 0.5} aria-label="−">−</button><strong>{portions}</strong><button type="button" onclick={() => changePortions(0.5)} aria-label="+">+</button></div>
				</div>
				<div class="manage-settings-row recipe-date-row"><input type="date" bind:value={date} /><span></span><input type="time" bind:value={time} /></div>
			</section>
			<section class="manage-section recipe-track-total"><strong>{totalKcal}</strong><span>kcal{#if portions !== 1} · {basePerPortionKcal}/{t.recipe_nutrition_per_portion_short}{/if}</span></section>
		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" class="manage-secondary" onclick={onclose}>{t.nutrition_cancel}</button>
		<button type="button" class="manage-primary disabled:opacity-40" onclick={save} disabled={saving || components.length === 0}>{saving ? '…' : t.nutrition_log_meal}</button>
	{/snippet}
</ManageSheetShell>

<style>
	.recipe-track-identity { display: flex; min-height: 58px; align-items: center; gap: 11px; padding: 8px 10px; border: 1px solid var(--bubble-container-border); border-radius: 14px; background: var(--bubble-container-bg); }
	.recipe-track-identity img, .recipe-track-identity > span { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, #FB923C 9%, transparent); color: #FB923C; font-weight: 700; }
	.recipe-track-identity div { display: grid; min-width: 0; gap: 2px; }
	.recipe-track-identity strong, .recipe-track-identity small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.recipe-track-identity strong { color: var(--color-on-surface); font-size: 14px; font-weight: 650; }
	.recipe-track-identity small { color: var(--color-on-surface-variant); font-size: 11px; }
	.recipe-name-row { display: flex; align-items: center; }
	.recipe-flat-select { width: 100%; height: 40px; border: 0; outline: 0; background: transparent; color: var(--color-on-surface); font-size: 16px; }
	.recipe-portions-row { display: flex; align-items: center; justify-content: space-between; }
	.recipe-portions-row > div { display: flex; align-items: center; gap: 10px; }
	.recipe-portions-row button { width: 36px; height: 36px; border: 1px solid var(--bubble-container-border); border-radius: 999px; color: #FB923C; font-size: 18px; }
	.recipe-portions-row strong { min-width: 30px; text-align: center; color: var(--color-on-surface); font-size: 14px; font-variant-numeric: tabular-nums; }
	.recipe-date-row { display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(105px, .7fr); align-items: center; gap: 8px; }
	.recipe-date-row input { width: 100%; min-width: 0; height: 38px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 600; }
	.recipe-date-row span { height: 22px; background: var(--bubble-container-border); }
	.recipe-track-total { display: flex; align-items: baseline; justify-content: center; gap: 6px; padding: 11px; }
	.recipe-track-total strong { color: #FB923C; font-size: 22px; font-weight: 740; font-variant-numeric: tabular-nums; }
	.recipe-track-total span { color: var(--color-on-surface-variant); font-size: 11px; }
</style>
