<script lang="ts">
	import { goto } from '$app/navigation';
	import AddComponentSheet from './AddComponentSheet.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import NutritionFoodRow from './NutritionFoodRow.svelte';
	import NutritionMacroStrip from './NutritionMacroStrip.svelte';
	import { t } from '$lib/i18n.svelte';

	type Component = {
		id?: string;
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
		kcal?: number;
	};

	type Meal = {
		id: string;
		name: string;
		date: string;
		time: string;
		components: Component[];
		imageUrl?: string | null;
		favoriteName?: string | null;
	};

	let { meal, onclose, onsaved, ondelete = null }: {
		meal: Meal;
		onclose: () => void;
		onsaved: () => void;
		ondelete?: (() => void | Promise<void>) | null;
	} = $props();

	// Entwurf nur für NEUE Mahlzeiten (bestehende sind schon gespeichert)
	// svelte-ignore state_referenced_locally
	const isNewMeal = meal.id === '';
	const DRAFT_KEY = 'nutrition_meal_draft';

	function loadDraft(): { date: string; name: string; time: string; components: Component[]; imageUrl?: string | null; favoriteName?: string | null; caffeineDrinkIds?: string[] } | null {
		if (!isNewMeal || typeof localStorage === 'undefined') return null;
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (!raw) return null;
			const d = JSON.parse(raw);
			if (d && d.date === meal.date && Array.isArray(d.components) && d.components.length > 0) return d;
		} catch { /* noop */ }
		return null;
	}
	const draft = loadDraft();

	// svelte-ignore state_referenced_locally
	let name = $state(draft?.name ?? meal.name);
	// svelte-ignore state_referenced_locally
	let time = $state(draft?.time ?? meal.time);
	// svelte-ignore state_referenced_locally
	let date = $state(meal.date);
	// svelte-ignore state_referenced_locally
	let components = $state<Component[]>((draft?.components ?? meal.components).map(c => ({ ...c })));
	// svelte-ignore state_referenced_locally
	let mealImageUrl = $state<string | null>(draft?.imageUrl ?? meal.imageUrl ?? null);
	// svelte-ignore state_referenced_locally
	let favoriteName = $state<string | null>(draft?.favoriteName ?? meal.favoriteName ?? null);
	// Koffein-Getränke verknüpfter Gericht-Vorlagen, die beim Speichern mitgeloggt werden
	// (Nutrition → Koffein). Nur relevant für neue Mahlzeiten aus Vorlagen.
	// svelte-ignore state_referenced_locally
	let caffeineDrinkIds = $state<string[]>(draft?.caffeineDrinkIds ?? []);
	// svelte-ignore state_referenced_locally
	let customMode = $state(
		!!(draft?.name ?? meal.name)?.trim() &&
		![t.meal_name_breakfast, t.meal_name_lunch, t.meal_name_vesper, t.meal_name_dinner, t.meal_name_snack].includes(draft?.name ?? meal.name)
	);
	// svelte-ignore state_referenced_locally
	let draftRestored = $state(!!draft);
	let saving = $state(false);
	let addSheetOpen = $state(false);
	let editingComponentIndex = $state<number | null>(null);
	let saveFavOpen = $state(false);
	let favName = $state('');
	let favImageUrl = $state<string | null>(null);
	let favImageUploading = $state(false);
	let favImageInput = $state<HTMLInputElement | null>(null);
	let savingFav = $state(false);

	async function handleFavImageSelect(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		favImageUploading = true;
		let uploadBlob: Blob = file;
		try {
			uploadBlob = await compressImage(file, 800, 0.78);
		} catch { /* fall back */ }
		try {
			const fd = new FormData();
			fd.append('image', uploadBlob, 'photo.jpg');
			const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
			if (res.ok) favImageUrl = (await res.json()).url;
		} catch { /* ignore */ }
		favImageUploading = false;
	}

	async function compressImage(file: File, maxPx: number, quality: number): Promise<Blob> {
		const bitmap = await createImageBitmap(file, { resizeWidth: maxPx, resizeQuality: 'medium' });
		const canvas = document.createElement('canvas');
		canvas.width = bitmap.width;
		canvas.height = bitmap.height;
		canvas.getContext('2d')!.drawImage(bitmap, 0, 0);
		bitmap.close();
		return new Promise<Blob>((resolve, reject) => {
			canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
		});
	}

	const MEAL_NAMES = $derived([t.meal_name_breakfast, t.meal_name_lunch, t.meal_name_vesper, t.meal_name_dinner, t.meal_name_snack]);

	function effectiveGrams(c: Component): number {
		if (c.unit === 'piece') return c.amount * (c.gramsPerPiece ?? 0);
		return c.amount;
	}

	function compKcal(c: Component): number {
		const grams = effectiveGrams(c);
		return ((c.kcalPer100 ?? 0) * grams) / 100;
	}

	function compMacro(c: Component, per100: number | null): number {
		return ((per100 ?? 0) * effectiveGrams(c)) / 100;
	}
	const totalKcal = $derived(Math.round(components.reduce((s, c) => s + compKcal(c), 0)));
	const totalProtein = $derived(components.reduce((s, c) => s + compMacro(c, c.proteinPer100), 0));
	const totalFat = $derived(components.reduce((s, c) => s + compMacro(c, c.fatPer100), 0));
	const totalCarbs = $derived(components.reduce((s, c) => s + compMacro(c, c.carbsPer100), 0));
	const totalFiber = $derived(components.reduce((s, c) => s + compMacro(c, c.fiberPer100), 0));
	const macroItems = $derived([
		{ label: t.nutrition_protein, value: totalProtein },
		{ label: t.nutrition_fat, value: totalFat },
		{ label: t.nutrition_carbs, value: totalCarbs },
		{ label: t.nutrition_fiber, value: totalFiber }
	]);

	// Entwurf laufend zwischenspeichern, sobald mindestens eine Zutat drin ist
	$effect(() => {
		if (!isNewMeal || typeof localStorage === 'undefined') return;
		const snapshot = { date: meal.date, name, time, components, imageUrl: mealImageUrl, favoriteName, caffeineDrinkIds };
		try {
			if (components.length > 0) {
				localStorage.setItem(DRAFT_KEY, JSON.stringify(snapshot));
			} else {
				localStorage.removeItem(DRAFT_KEY);
			}
		} catch { /* noop */ }
	});

	function clearDraft() {
		if (typeof localStorage === 'undefined') return;
		try { localStorage.removeItem(DRAFT_KEY); } catch { /* noop */ }
	}

	function discardDraft() {
		clearDraft();
		name = meal.name;
		time = meal.time;
		components = [];
		mealImageUrl = meal.imageUrl ?? null;
		favoriteName = meal.favoriteName ?? null;
		caffeineDrinkIds = [];
		draftRestored = false;
	}

	function removeComponent(i: number) {
		components = components.filter((_, idx) => idx !== i);
	}

	function addComponent(c: Component) {
		if (editingComponentIndex !== null) {
			components = components.map((existing, idx) => idx === editingComponentIndex ? c : existing);
			editingComponentIndex = null;
		} else {
			components = [...components, c];
		}
		addSheetOpen = false;
	}

	function editComponent(i: number) {
		editingComponentIndex = i;
		addSheetOpen = true;
	}

	function applyFavorite(payload: { components: Component[]; defaultMealName: string | null; favoriteName: string; imageUrl: string | null; caffeineDrinkId: string | null }) {
		// Name nur übernehmen, wenn noch nichts angepasst wurde (leer oder Default-Vorschlag)
		if (payload.defaultMealName && (!name.trim() || MEAL_NAMES.includes(name))) {
			name = payload.defaultMealName;
			customMode = !MEAL_NAMES.includes(name);
		}
		// Gericht-Name + Bild der Vorlage übernehmen (erste Vorlage gewinnt, falls schon gesetzt)
		if (!favoriteName) favoriteName = payload.favoriteName;
		if (!mealImageUrl) mealImageUrl = payload.imageUrl;
		// Zutaten anhängen (Favoriten kombinierbar)
		components = [...components, ...payload.components.map((c) => ({ ...c }))];
		// Verknüpftes Koffein-Getränk merken (mehrere Vorlagen kombinierbar → mehrere Logs)
		if (payload.caffeineDrinkId && !caffeineDrinkIds.includes(payload.caffeineDrinkId)) {
			caffeineDrinkIds = [...caffeineDrinkIds, payload.caffeineDrinkId];
		}
		addSheetOpen = false;
		editingComponentIndex = null;
	}

	function openSaveFavorite() {
		favName = favoriteName ?? (MEAL_NAMES.includes(name) ? '' : name.trim());
		favImageUrl = mealImageUrl;
		saveFavOpen = true;
	}

	async function saveAsFavorite() {
		if (savingFav) return;
		if (!favName.trim() || components.length === 0) return;
		savingFav = true;
		try {
			const res = await fetch('/api/nutrition/meal-favorites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					displayName: favName.trim(),
					defaultMealName: name.trim() || null,
					imageUrl: favImageUrl,
					components: components.map((c) => ({
						productBarcode: c.productBarcode,
						genericFoodId: c.genericFoodId,
						customName: c.customName,
						displayName: c.displayName,
						imageUrl: c.imageUrl,
						amount: c.amount,
						unit: c.unit,
						gramsPerPiece: c.gramsPerPiece,
						kcalPer100: c.kcalPer100,
						proteinPer100: c.proteinPer100,
						fatPer100: c.fatPer100,
						carbsPer100: c.carbsPer100,
						sugarPer100: c.sugarPer100,
						fiberPer100: c.fiberPer100,
						saltPer100: c.saltPer100
					}))
				})
			});
			if (res.ok) {
				// Mahlzeit übernimmt den Gericht-Block (Name + Bild) der neuen Vorlage
				favoriteName = favName.trim();
				mealImageUrl = favImageUrl;
				saveFavOpen = false;
			}
		} finally {
			savingFav = false;
		}
	}

	async function save() {
		if (saving) return;
		if (!name.trim()) return;
		if (!/^\d{2}:\d{2}$/.test(time)) return;
		if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return;
		saving = true;
		try {
			const payload = {
				name: name.trim(), time, date, components, imageUrl: mealImageUrl, favoriteName,
				// Koffein-Spiegel nur beim erstmaligen Loggen (neue Mahlzeit), nicht beim Bearbeiten
				...(meal.id ? {} : { caffeineDrinkIds })
			};
			const url = meal.id ? `/api/nutrition/meals/${meal.id}` : '/api/nutrition/meals';
			const method = meal.id ? 'PATCH' : 'POST';
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(payload)
			});
			if (res.ok) {
				clearDraft();
				onsaved();
			}
		} finally {
			saving = false;
		}
	}
</script>


<ManageSheetShell accent="#FB923C" title={meal.id ? t.nutrition_edit_meal : t.nutrition_new_meal} subtitle={draftRestored ? t.nutrition_draft_restored : null} {onclose} zIndex={60} maxHeight="92dvh">
	{#snippet headerActions()}
		<button type="button" onclick={() => { onclose(); goto('/tracker/nutrition/favorites'); }} class="nutrition-header-action" aria-label={t.nutrition_favorites_manage}>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
			<span>{t.nutrition_favorites_label}</span>
		</button>
		{#if meal.id && ondelete}
			<button type="button" onclick={ondelete} class="nutrition-header-delete">
				{t.nutrition_delete_meal}
			</button>
		{/if}
	{/snippet}
	{#snippet body()}
		<div class="manage-stack">
			{#if draftRestored}
				<div class="nutrition-draft-row">
					<span>{t.nutrition_draft_restored}</span>
					<button type="button" onclick={discardDraft}>{t.nutrition_discard_draft}</button>
				</div>
			{/if}

			{#if favoriteName}
				<div class="nutrition-template-identity">
					{#if mealImageUrl}
						<img src={mealImageUrl} alt="" />
					{:else}
						<span>{favoriteName.slice(0, 1).toUpperCase()}</span>
					{/if}
					<strong>{favoriteName}</strong>
					<button type="button" onclick={() => { favoriteName = null; mealImageUrl = null; }} aria-label={t.nutrition_remove}>×</button>
				</div>
			{/if}

			<div>
				<span class="manage-section-title">{t.nutrition_meal_details_section}</span>
				<section class="manage-settings-surface">
					<div class="manage-settings-row nutrition-name-row">
				<select
					value={customMode ? '__custom__' : name}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						if (v === '__custom__') { customMode = true; name = ''; }
						else { customMode = false; name = v; }
					}}
					class="nutrition-flat-select">
					{#each MEAL_NAMES as n}
						<option value={n}>{n}</option>
					{/each}
					<option value="__custom__">{t.nutrition_custom_name_option}</option>
				</select>
					<svg class="nutrition-select-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
					</div>
			{#if customMode}
				<label class="manage-settings-row nutrition-flat-input-row">
					<span class="manage-settings-label">{t.nutrition_name}</span>
					<input type="text" bind:value={name} placeholder={t.nutrition_name_placeholder}
					       class="manage-settings-input" />
				</label>
			{/if}
					<div class="manage-settings-row nutrition-date-time-row">
				<input type="date" bind:value={date}
				       class="nutrition-native-input" />
				<span aria-hidden="true"></span>
				<input type="time" bind:value={time}
				       class="nutrition-native-input nutrition-time-input" />
					</div>
				</section>
			</div>

			<div>
				<div class="nutrition-section-heading">
					<span class="manage-section-title">{t.nutrition_ingredients}</span>
					<strong>{totalKcal} kcal</strong>
				</div>
				<section class="manage-settings-surface nutrition-food-list">
				{#each components as c, i (i)}
					{@const kcal = Math.round(compKcal(c))}
					<NutritionFoodRow
						title={c.displayName}
						meta={`${c.amount}${c.unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : c.unit}`}
						trailing={`${kcal} kcal`}
						imageUrl={c.imageUrl}
						onactivate={() => editComponent(i)}
						onremove={() => removeComponent(i)}
						removeLabel={t.nutrition_remove}
					/>
				{/each}
				<button type="button" onclick={() => { editingComponentIndex = null; addSheetOpen = true; }} class="nutrition-add-row">
					{t.nutrition_add_food_or_meal}
				</button>
				</section>
			</div>

			{#if components.length > 0}
				<section class="manage-section nutrition-meal-summary">
					<NutritionMacroStrip items={macroItems} />
				</section>
			{/if}

			{#if components.length >= 2 && !favoriteName}
				<button type="button" onclick={openSaveFavorite} class="nutrition-secondary-action">
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
					{t.nutrition_save_as_template}
				</button>
			{/if}

		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" onclick={onclose} class="manage-secondary">{t.nutrition_cancel}</button>
		<button type="button" onclick={save} disabled={saving || !name.trim() || components.length === 0} class="manage-primary disabled:opacity-40">
			{saving ? '…' : (meal.id ? t.nutrition_save : t.nutrition_log_meal)}
		</button>
	{/snippet}
</ManageSheetShell>

{#if addSheetOpen}
	<AddComponentSheet
		initial={editingComponentIndex !== null ? components[editingComponentIndex] : null}
		onclose={() => { addSheetOpen = false; editingComponentIndex = null; }}
		onadd={addComponent}
		onpickmeal={applyFavorite}
	/>
{/if}

{#if saveFavOpen}
	<ManageSheetShell accent="#FB923C" title={t.nutrition_save_as_template} onclose={() => (saveFavOpen = false)} zIndex={70} maxHeight="92dvh">
		{#snippet body()}
			<div class="manage-stack">
			<input bind:this={favImageInput} type="file" accept="image/*" style="display:none" onchange={handleFavImageSelect} />
			<div>
				{#if favImageUrl}
					<div class="relative rounded-xl overflow-hidden" style="border: 1px solid var(--bubble-interactive-border)">
						<img src={favImageUrl} alt="" class="w-full object-cover" style="max-height: 160px" />
						<button onclick={() => (favImageUrl = null)}
						        class="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:opacity-70"
						        style="background: rgba(0,0,0,0.55); color: #fff" aria-label={t.nutrition_remove}>✕</button>
					</div>
				{:else}
					<button onclick={() => favImageInput?.click()} disabled={favImageUploading}
					        class="w-full py-3 rounded-xl text-sm font-medium active:opacity-70 flex items-center justify-center gap-2"
					        style="border: 1px dashed var(--bubble-interactive-border); color: #FB923C">
						{#if favImageUploading}
							<div class="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style="border-color: #FB923C; border-top-color: transparent"></div>
						{:else}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
						{/if}
						{t.nutrition_add_image}
					</button>
				{/if}
			</div>
			<label>
				<span class="manage-label">{t.nutrition_name}</span>
				<input type="text" bind:value={favName} placeholder={t.nutrition_meal_favorite_name_placeholder}
				       class="manage-input" />
			</label>
			</div>
		{/snippet}
		{#snippet footer()}
			<button type="button" onclick={() => (saveFavOpen = false)} class="manage-secondary">{t.nutrition_cancel}</button>
			<button type="button" onclick={saveAsFavorite} disabled={savingFav || !favName.trim()} class="manage-primary disabled:opacity-40">{savingFav ? '…' : t.nutrition_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}

<style>
	.nutrition-header-action { display: flex; min-height: 40px; align-items: center; justify-content: center; gap: 5px; padding-inline: 8px; border-radius: 12px; color: var(--color-on-surface-variant); font-size: 11px; font-weight: 650; }
	.nutrition-header-action:active { background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; }
	.nutrition-header-delete { min-height: 40px; padding-inline: 7px; border-radius: 12px; color: var(--color-error); font-size: 11px; font-weight: 650; white-space: nowrap; }
	.nutrition-header-delete:active { background: color-mix(in srgb, var(--color-error) 9%, transparent); }
	.nutrition-draft-row { display: flex; min-height: 40px; align-items: center; justify-content: space-between; gap: 8px; padding: 6px 10px; border: 1px solid color-mix(in srgb, #FB923C 28%, transparent); border-radius: 12px; background: color-mix(in srgb, #FB923C 7%, transparent); color: var(--color-on-surface-variant); font-size: 11px; }
	.nutrition-draft-row button { min-height: 32px; padding-inline: 8px; color: #FB923C; font-weight: 650; }
	.nutrition-template-identity { display: flex; min-height: 48px; align-items: center; gap: 10px; padding: 7px 9px; border: 1px solid var(--bubble-container-border); border-radius: 14px; background: var(--bubble-container-bg); }
	.nutrition-template-identity img, .nutrition-template-identity > span { display: flex; width: 34px; height: 34px; flex: none; align-items: center; justify-content: center; border-radius: 9px; object-fit: cover; background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; font-size: 12px; font-weight: 700; }
	.nutrition-template-identity strong { overflow: hidden; min-width: 0; flex: 1; color: var(--color-on-surface); font-size: 13px; text-overflow: ellipsis; white-space: nowrap; }
	.nutrition-template-identity button { width: 40px; height: 40px; flex: none; color: var(--color-on-surface-variant); font-size: 18px; }
	.nutrition-name-row { position: relative; display: flex; align-items: center; }
	.nutrition-flat-select { width: 100%; height: 40px; padding: 0 28px 0 0; border: 0; outline: 0; appearance: none; background: transparent; color: var(--color-on-surface); font-size: 16px; }
	.nutrition-select-icon { position: absolute; right: 12px; pointer-events: none; }
	.nutrition-flat-input-row { display: grid; grid-template-columns: minmax(0, .75fr) minmax(0, 1.25fr); align-items: center; gap: 12px; }
	.nutrition-date-time-row { display: grid; grid-template-columns: minmax(0, 1fr) 1px minmax(108px, .7fr); align-items: center; gap: 8px; }
	.nutrition-date-time-row > span { height: 22px; background: var(--bubble-container-border); }
	.nutrition-native-input { width: 100%; min-width: 0; height: 38px; border: 0; outline: 0; background: transparent; color: #FB923C; font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; }
	.nutrition-time-input { text-align: center; }
	.nutrition-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
	.nutrition-section-heading strong { color: #FB923C; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-food-list :global(.nutrition-food-row + .nutrition-food-row) { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-add-row { width: 100%; min-height: 44px; border-top: 1px solid var(--bubble-container-border); color: #FB923C; font-size: 13px; font-weight: 650; }
	.nutrition-meal-summary { padding: 10px; }
	.nutrition-secondary-action { display: flex; min-height: 40px; align-items: center; justify-content: center; gap: 6px; border: 1px solid var(--bubble-container-border); border-radius: 12px; color: #FB923C; font-size: 12px; font-weight: 650; }
</style>
