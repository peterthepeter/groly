<script lang="ts">
	import { onMount } from 'svelte';
	import { beforeNavigate } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';

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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[60]" style="background: rgba(0,0,0,0.5)" onclick={onclose}></div>

<div class="fixed left-0 right-0 bottom-0 z-[61] rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
     style="background-color: var(--modal-bg)">
	<div class="flex justify-center pt-3 pb-1 shrink-0">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
	</div>

	<div class="px-5 pb-3">
		<p class="font-bold text-lg" style="color: {ACCENT}">{t.recipe_track_title}</p>

		<!-- Gericht-Kopf -->
		<div class="flex items-center gap-3 mt-3">
			{#if recipeImageUrl}
				<img src={recipeImageUrl} alt="" class="w-10 h-10 rounded-xl object-cover bg-black/5 shrink-0" />
			{:else}
				<div class="w-10 h-10 rounded-xl flex items-center justify-center text-base font-bold shrink-0"
				     style="background: color-mix(in srgb, {ACCENT} 10%, transparent); color: {ACCENT}">
					{recipeTitle.slice(0, 1).toUpperCase()}
				</div>
			{/if}
			<div class="min-w-0 flex-1">
				<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{recipeTitle}</div>
				<div class="text-xs tabular-nums" style="color: var(--color-on-surface-variant)">
					{components.length} {t.nutrition_ingredients} · {basePerPortionKcal} kcal/{t.recipe_nutrition_per_portion_short}
				</div>
			</div>
		</div>

		<!-- Eingaben: Portionen + Datum + Zeit in einer Bubble -->
		<div class="rounded-2xl overflow-hidden mt-3"
		     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			<!-- Name (wie New meal) -->
			<div class="flex items-center px-2" style="height: 46px">
				{#if customMode}
					<input type="text" bind:value={name} placeholder={t.nutrition_name_placeholder}
					       class="flex-1 min-w-0 px-1.5 bg-transparent outline-none"
					       style="font-size: 16px; color: var(--color-on-surface)" />
					<button onclick={() => { customMode = false; name = MEAL_NAMES[0]; }}
					        class="shrink-0 w-7 h-7 flex items-center justify-center opacity-50 active:opacity-100 text-sm"
					        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_cancel}>✕</button>
				{:else}
					<div class="relative flex-1 min-w-0">
						<select
							value={customMode ? '__custom__' : name}
							onchange={(e) => {
								const v = (e.currentTarget as HTMLSelectElement).value;
								if (v === '__custom__') { customMode = true; name = ''; }
								else { customMode = false; name = v; }
							}}
							class="w-full pl-1.5 pr-8 bg-transparent outline-none appearance-none"
							style="font-size: 16px; height: 46px; color: var(--color-on-surface)">
							{#each MEAL_NAMES as n}
								<option value={n}>{n}</option>
							{/each}
							<option value="__custom__">{t.nutrition_custom_name_option}</option>
						</select>
						<svg class="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
					</div>
				{/if}
			</div>
			<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
			<div class="flex items-center justify-between px-3.5" style="height: 46px">
				<span class="text-sm" style="color: var(--color-on-surface)">{t.recipe_nutrition_portions}</span>
				<div class="flex items-center gap-2.5">
					<button onclick={() => changePortions(-0.5)} disabled={portions <= 0.5}
					        class="w-7 h-7 rounded-full flex items-center justify-center active:opacity-60 disabled:opacity-30"
					        style="border: 1px solid var(--bubble-interactive-border)" aria-label="-">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
					</button>
					<span class="text-sm font-bold tabular-nums w-7 text-center" style="color: var(--color-on-surface)">{portions}</span>
					<button onclick={() => changePortions(0.5)}
					        class="w-7 h-7 rounded-full flex items-center justify-center active:opacity-60"
					        style="border: 1px solid var(--bubble-interactive-border)" aria-label="+">
						<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					</button>
				</div>
			</div>
			<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
			<div class="flex items-center px-2" style="height: 46px">
				<input type="date" bind:value={date}
				       class="flex-1 min-w-0 px-1.5 bg-transparent outline-none tabular-nums"
				       style="font-size: 16px; color: var(--color-on-surface)" />
				<div class="w-px h-5 mx-1" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
				<input type="time" bind:value={time}
				       class="px-1.5 bg-transparent outline-none tabular-nums shrink-0"
				       style="font-size: 16px; color: var(--color-on-surface)" />
			</div>
		</div>

		<!-- kcal-Vorschau -->
		<div class="flex items-baseline justify-center gap-1.5 mt-3">
			<span class="text-xl font-bold tabular-nums" style="color: {ACCENT}">{totalKcal}</span>
			<span class="text-xs" style="color: var(--color-on-surface-variant)">kcal{#if portions !== 1} · {basePerPortionKcal}/{t.recipe_nutrition_per_portion_short}{/if}</span>
		</div>
	</div>

	<div class="px-5 pt-1 shrink-0 flex gap-2" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
		<button onclick={onclose}
		        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
		        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
			{t.nutrition_cancel}
		</button>
		<button onclick={save} disabled={saving || components.length === 0}
		        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center"
		        style="background: {ACCENT}; color: #fff">
			{#if saving}
				<div class="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin"></div>
			{:else}
				{t.nutrition_log_meal}
			{/if}
		</button>
	</div>
</div>
