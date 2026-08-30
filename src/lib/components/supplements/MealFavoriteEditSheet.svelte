<script lang="ts">
	import { onMount } from 'svelte';
	import AddComponentSheet from './AddComponentSheet.svelte';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import NutritionFoodRow from './NutritionFoodRow.svelte';
	import NutritionMacroStrip from './NutritionMacroStrip.svelte';
	import SupplementActiveToggle from './SupplementActiveToggle.svelte';
	import { t } from '$lib/i18n.svelte';

	type CaffeineDrink = { id: string; name: string; defaultMl: number; caffeineMg: number };
	type Component = {
		id?: string; productBarcode: string | null; genericFoodId: string | null; customName: string | null;
		displayName: string; imageUrl: string | null; amount: number; unit: 'g' | 'ml' | 'piece';
		gramsPerPiece: number | null; kcalPer100: number | null; proteinPer100: number | null;
		fatPer100: number | null; carbsPer100: number | null; sugarPer100: number | null;
		fiberPer100: number | null; saltPer100: number | null; kcal?: number;
	};
	type ExistingMeal = { id: string; displayName: string; imageUrl?: string | null; caffeineDrinkId?: string | null; components: Component[] };

	let { existing = null, onclose, onsaved, ondelete = null }: {
		existing?: ExistingMeal | null; onclose: () => void; onsaved: () => void;
		ondelete?: (() => void | Promise<void>) | null;
	} = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(existing?.displayName ?? '');
	// svelte-ignore state_referenced_locally
	let components = $state<Component[]>((existing?.components ?? []).map((component) => ({ ...component })));
	// svelte-ignore state_referenced_locally
	let imageUrl = $state<string | null>(existing?.imageUrl ?? null);
	let imageUploading = $state(false);
	let imageFileInput = $state<HTMLInputElement | null>(null);
	let saving = $state(false);
	let addSheetOpen = $state(false);
	let editingComponentIndex = $state<number | null>(null);
	let caffeineDrinks = $state<CaffeineDrink[]>([]);
	// svelte-ignore state_referenced_locally
	let caffeineLinked = $state<boolean>(!!existing?.caffeineDrinkId);

	const linkedDrink = $derived.by(() => {
		const byName = caffeineDrinks.find((drink) => drink.name.trim().toLowerCase() === name.trim().toLowerCase());
		if (byName) return byName;
		if (existing?.caffeineDrinkId) return caffeineDrinks.find((drink) => drink.id === existing.caffeineDrinkId) ?? null;
		return null;
	});

	onMount(async () => {
		try {
			const response = await fetch('/api/caffeine-drinks');
			if (response.ok) caffeineDrinks = (await response.json()).drinks ?? [];
		} catch { /* optional enhancement */ }
	});

	async function handleImageSelect(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		imageUploading = true;
		let uploadBlob: Blob = file;
		try { uploadBlob = await compressImage(file, 800, 0.78); } catch { /* use original */ }
		try {
			const formData = new FormData();
			formData.append('image', uploadBlob, 'photo.jpg');
			const response = await fetch('/api/uploads/image', { method: 'POST', body: formData });
			if (response.ok) imageUrl = (await response.json()).url;
		} finally { imageUploading = false; }
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

	function effectiveGrams(component: Component): number {
		return component.unit === 'piece' ? component.amount * (component.gramsPerPiece ?? 0) : component.amount;
	}
	function componentValue(component: Component, per100: number | null): number {
		return ((per100 ?? 0) * effectiveGrams(component)) / 100;
	}

	const totalKcal = $derived(Math.round(components.reduce((sum, component) => sum + componentValue(component, component.kcalPer100), 0)));
	const macroItems = $derived([
		{ label: t.nutrition_protein, value: components.reduce((sum, c) => sum + componentValue(c, c.proteinPer100), 0) },
		{ label: t.nutrition_fat, value: components.reduce((sum, c) => sum + componentValue(c, c.fatPer100), 0) },
		{ label: t.nutrition_carbs, value: components.reduce((sum, c) => sum + componentValue(c, c.carbsPer100), 0) },
		{ label: t.nutrition_fiber, value: components.reduce((sum, c) => sum + componentValue(c, c.fiberPer100), 0) }
	]);

	function removeComponent(index: number) { components = components.filter((_, currentIndex) => currentIndex !== index); }
	function addComponent(component: Component) {
		if (editingComponentIndex !== null) {
			components = components.map((current, index) => index === editingComponentIndex ? component : current);
			editingComponentIndex = null;
		} else components = [...components, component];
		addSheetOpen = false;
	}
	function editComponent(index: number) { editingComponentIndex = index; addSheetOpen = true; }

	async function save() {
		if (saving || !name.trim() || components.length === 0) return;
		saving = true;
		const payload = {
			displayName: name.trim(), imageUrl,
			...(linkedDrink ? { caffeineDrinkId: caffeineLinked ? linkedDrink.id : null } : {}),
			components: components.map((component) => ({
				productBarcode: component.productBarcode, genericFoodId: component.genericFoodId,
				customName: component.customName, displayName: component.displayName, imageUrl: component.imageUrl,
				amount: component.amount, unit: component.unit, gramsPerPiece: component.gramsPerPiece,
				kcalPer100: component.kcalPer100, proteinPer100: component.proteinPer100,
				fatPer100: component.fatPer100, carbsPer100: component.carbsPer100,
				sugarPer100: component.sugarPer100, fiberPer100: component.fiberPer100, saltPer100: component.saltPer100
			}))
		};
		try {
			const response = await fetch(existing ? `/api/nutrition/meal-favorites/${existing.id}` : '/api/nutrition/meal-favorites', {
				method: existing ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(existing ? payload : { ...payload, defaultMealName: null })
			});
			if (response.ok) onsaved();
		} finally { saving = false; }
	}
</script>

<ManageSheetShell accent="#FB923C" title={existing ? t.nutrition_edit : t.nutrition_new_meal_favorite} {onclose} zIndex={60} maxHeight="92dvh">
	{#snippet body()}
		<div class="manage-stack">
			<input bind:this={imageFileInput} type="file" accept="image/*" class="hidden" onchange={handleImageSelect} />
			<div>
				<span class="manage-section-title">{t.nutrition_meal_details_section}</span>
				<section class="manage-settings-surface">
					<div class="nutrition-template-image-row">
						{#if imageUrl}<img src={imageUrl} alt="" />{:else}<span>{name.trim().slice(0, 1).toUpperCase() || 'M'}</span>{/if}
						<button type="button" onclick={() => imageFileInput?.click()} disabled={imageUploading}>{imageUploading ? '…' : t.nutrition_add_image}</button>
						{#if imageUrl}<button type="button" class="nutrition-image-remove" onclick={() => (imageUrl = null)} aria-label={t.nutrition_remove}>×</button>{/if}
					</div>
					<label class="manage-settings-row nutrition-flat-row">
						<span class="manage-settings-label">{t.nutrition_name}</span>
						<input type="text" bind:value={name} placeholder={t.nutrition_meal_favorite_name_placeholder} class="manage-settings-input" />
					</label>
					{#if linkedDrink}
						<div class="manage-settings-row nutrition-toggle-row">
							<div><strong>{t.nutrition_caffeine_link}</strong><span>{linkedDrink.name} · {linkedDrink.caffeineMg} mg</span></div>
							<SupplementActiveToggle active={caffeineLinked} label={t.nutrition_caffeine_link} onclick={() => (caffeineLinked = !caffeineLinked)} accent="#FB923C" />
						</div>
					{/if}
				</section>
			</div>

			<div>
				<div class="nutrition-section-heading"><span class="manage-section-title">{t.nutrition_ingredients}</span><strong>{totalKcal} kcal</strong></div>
				<section class="manage-settings-surface nutrition-food-list">
					{#each components as component, index (index)}
						<NutritionFoodRow title={component.displayName} meta={`${component.amount}${component.unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : component.unit}`} trailing={`${Math.round(componentValue(component, component.kcalPer100))} kcal`} imageUrl={component.imageUrl} onactivate={() => editComponent(index)} onremove={() => removeComponent(index)} removeLabel={t.nutrition_remove} />
					{/each}
					<button type="button" class="nutrition-add-row" onclick={() => { editingComponentIndex = null; addSheetOpen = true; }}>{t.nutrition_add_ingredient}</button>
				</section>
			</div>

			{#if components.length > 0}<section class="manage-section nutrition-summary"><NutritionMacroStrip items={macroItems} /></section>{/if}
			{#if ondelete}<button type="button" class="manage-danger nutrition-delete-action" onclick={ondelete}>{t.nutrition_delete_template}</button>{/if}
		</div>
	{/snippet}
	{#snippet footer()}
		<button type="button" class="manage-secondary" onclick={onclose}>{t.nutrition_cancel}</button>
		<button type="button" class="manage-primary disabled:opacity-40" onclick={save} disabled={saving || !name.trim() || components.length === 0}>{saving ? '…' : t.nutrition_save}</button>
	{/snippet}
</ManageSheetShell>

{#if addSheetOpen}<AddComponentSheet initial={editingComponentIndex !== null ? components[editingComponentIndex] : null} onclose={() => { addSheetOpen = false; editingComponentIndex = null; }} onadd={addComponent} />{/if}

<style>
	.nutrition-template-image-row { display: flex; min-height: 56px; align-items: center; gap: 10px; padding: 8px 11px; }
	.nutrition-template-image-row img, .nutrition-template-image-row > span { display: flex; width: 40px; height: 40px; flex: none; align-items: center; justify-content: center; border-radius: 10px; object-fit: cover; background: color-mix(in srgb, #FB923C 8%, transparent); color: #FB923C; font-size: 13px; font-weight: 700; }
	.nutrition-template-image-row button { min-height: 40px; flex: 1; text-align: left; color: #FB923C; font-size: 13px; font-weight: 650; }
	.nutrition-template-image-row .nutrition-image-remove { width: 40px; flex: none; text-align: center; color: var(--color-on-surface-variant); font-size: 19px; }
	.nutrition-flat-row { display: grid; grid-template-columns: minmax(0, .65fr) minmax(0, 1.35fr); align-items: center; gap: 12px; }
	.nutrition-toggle-row { display: flex; align-items: center; gap: 12px; }
	.nutrition-toggle-row > div { display: grid; min-width: 0; flex: 1; gap: 2px; }
	.nutrition-toggle-row strong { color: var(--color-on-surface); font-size: 13px; font-weight: 600; }
	.nutrition-toggle-row span { color: var(--color-on-surface-variant); font-size: 11px; }
	.nutrition-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
	.nutrition-section-heading strong { color: #FB923C; font-size: 13px; font-weight: 650; font-variant-numeric: tabular-nums; }
	.nutrition-food-list :global(.nutrition-food-row + .nutrition-food-row) { border-top: 1px solid var(--bubble-container-border); }
	.nutrition-add-row { width: 100%; min-height: 44px; border-top: 1px solid var(--bubble-container-border); color: #FB923C; font-size: 13px; font-weight: 650; }
	.nutrition-summary { padding: 10px; }
	.nutrition-delete-action { width: 100%; min-height: 40px; }
</style>
