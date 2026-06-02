<script lang="ts">
	import { goto } from '$app/navigation';
	import AddComponentSheet from './AddComponentSheet.svelte';
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

	let { meal, onclose, onsaved }: {
		meal: Meal;
		onclose: () => void;
		onsaved: () => void;
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
	function fmtG(v: number): string { return v < 10 ? v.toFixed(1) : Math.round(v).toString(); }

	const totalKcal = $derived(Math.round(components.reduce((s, c) => s + compKcal(c), 0)));
	const totalProtein = $derived(components.reduce((s, c) => s + compMacro(c, c.proteinPer100), 0));
	const totalFat = $derived(components.reduce((s, c) => s + compMacro(c, c.fatPer100), 0));
	const totalCarbs = $derived(components.reduce((s, c) => s + compMacro(c, c.carbsPer100), 0));

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

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-[55]" style="background: rgba(0,0,0,0.5)" onclick={onclose}></div>

<div class="fixed bottom-0 left-0 right-0 z-[60] rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
     style="background-color: var(--modal-bg); max-height: 92dvh">
	<!-- Handle -->
	<div class="flex justify-center pt-3 pb-1 shrink-0">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
	</div>

	<!-- Title -->
	<div class="px-5 pb-2 shrink-0 flex items-center justify-between gap-2">
		<p class="font-bold text-lg" style="color: #FB923C">{meal.id ? t.nutrition_edit_meal : t.nutrition_new_meal}</p>
		<div class="flex items-center gap-2 shrink-0">
			{#if draftRestored}
				<button type="button" onclick={discardDraft}
				        class="flex items-center gap-1 text-xs active:opacity-60"
				        style="color: var(--color-on-surface-variant)">
					<span style="color: #FB923C">{t.nutrition_draft_restored}</span>
					<span class="underline">{t.nutrition_discard_draft}</span>
				</button>
			{/if}
			<button type="button" onclick={() => { onclose(); goto('/tracker/nutrition/favorites'); }}
			        class="w-9 h-9 rounded-lg flex items-center justify-center active:opacity-60"
			        style="color: var(--color-on-surface-variant)" aria-label={t.nutrition_edit}>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
					<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
				</svg>
			</button>
		</div>
	</div>

	<!-- Scrollable content -->
	<div class="overflow-y-auto px-5 py-2" style="min-height: 0">
		<!-- Gericht-Block (Bild + Name), nur wenn aus Vorlage übernommen -->
		{#if favoriteName}
			<div class="flex items-center gap-2.5 mb-3">
				{#if mealImageUrl}
					<img src={mealImageUrl} alt="" class="w-9 h-9 rounded-lg object-cover bg-black/5 shrink-0" />
				{:else}
					<div class="w-9 h-9 rounded-lg flex items-center justify-center text-base shrink-0"
					     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
						{favoriteName.slice(0, 1).toUpperCase()}
					</div>
				{/if}
				<span class="flex-1 min-w-0 text-sm font-semibold truncate" style="color: var(--color-on-surface)">{favoriteName}</span>
				<button onclick={() => { favoriteName = null; mealImageUrl = null; }}
				        class="opacity-50 active:opacity-100 text-sm w-7 h-7 flex items-center justify-center shrink-0"
				        aria-label={t.nutrition_remove}>✕</button>
			</div>
		{/if}

		<!-- Name + Datum/Zeit in einer Bubble (wie Track-Sheet) -->
		<div class="rounded-2xl overflow-hidden mb-3"
		     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			<div class="relative flex items-center" style="height: 46px">
				<select
					value={customMode ? '__custom__' : name}
					onchange={(e) => {
						const v = (e.currentTarget as HTMLSelectElement).value;
						if (v === '__custom__') { customMode = true; name = ''; }
						else { customMode = false; name = v; }
					}}
					class="w-full pl-3 pr-9 bg-transparent outline-none appearance-none"
					style="font-size: 16px; height: 46px; color: var(--color-on-surface)">
					{#each MEAL_NAMES as n}
						<option value={n}>{n}</option>
					{/each}
					<option value="__custom__">{t.nutrition_custom_name_option}</option>
				</select>
				<svg class="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
			</div>
			{#if customMode}
				<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
				<div class="flex items-center px-3" style="height: 46px">
					<input type="text" bind:value={name} placeholder={t.nutrition_name_placeholder}
					       class="w-full bg-transparent outline-none"
					       style="font-size: 16px; color: var(--color-on-surface)" />
				</div>
			{/if}
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
		<!-- Komponenten -->
		<div class="flex items-center justify-between mb-1.5">
			<div class="flex items-center gap-1.5">
				<span class="text-[11px] uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.nutrition_ingredients}</span>
				{#if components.length >= 2 && !favoriteName}
					<button type="button" onclick={openSaveFavorite}
					        class="flex items-center gap-1 active:opacity-60" style="color: #FB923C"
					        aria-label={t.nutrition_save_as_template}>
						<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
						</svg>
						<span class="text-[11px] font-medium">{t.nutrition_save_as_template}</span>
					</button>
				{/if}
			</div>
			<div class="flex flex-col items-end leading-tight">
				<span class="text-sm font-semibold" style="color: #FB923C">{totalKcal} kcal</span>
				{#if components.length > 0}
					<span class="text-[11px] tabular-nums" style="color: var(--color-on-surface-variant)">
						{t.nutrition_protein.charAt(0)} {fmtG(totalProtein)}g · {t.nutrition_fat.charAt(0)} {fmtG(totalFat)}g · {t.nutrition_carbs.charAt(0)} {fmtG(totalCarbs)}g
					</span>
				{/if}
			</div>
		</div>

		<div class="rounded-2xl overflow-hidden"
		     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				{#each components as c, i (i)}
					{@const kcal = Math.round(compKcal(c))}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="px-3 py-2 flex items-center gap-2.5 cursor-pointer active:opacity-80"
					     onclick={() => editComponent(i)}>
						{#if c.imageUrl}
							<img src={c.imageUrl} alt="" class="w-9 h-9 rounded-lg object-cover bg-black/5 shrink-0" />
						{:else}
							<div class="w-9 h-9 rounded-lg flex items-center justify-center text-sm shrink-0"
							     style="background: color-mix(in srgb, #FB923C 8%, transparent); color: var(--color-on-surface-variant)">
								{c.displayName.slice(0, 1).toUpperCase()}
							</div>
						{/if}
						<div class="flex-1 min-w-0">
							<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{c.displayName}</div>
							<div class="text-xs" style="color: var(--color-on-surface-variant)">
								{c.amount}{c.unit === 'piece' ? ` ${t.nutrition_unit_short_piece}` : c.unit} · {kcal} kcal
							</div>
						</div>
						<button onclick={(e) => { e.stopPropagation(); removeComponent(i); }}
						        class="opacity-50 active:opacity-100 text-sm w-7 h-7 flex items-center justify-center shrink-0"
						        aria-label={t.nutrition_remove}>✕</button>
					</div>
					<div class="h-px mx-3" style="background-color: var(--bubble-interactive-border); opacity: 0.5"></div>
				{/each}
				<!-- Zutat/Gericht hinzufügen – letzte Zeile in der Bubble -->
				<button onclick={() => { editingComponentIndex = null; addSheetOpen = true; }}
				        class="w-full px-3 py-2.5 flex items-center justify-center gap-1 active:opacity-70" style="color: #FB923C">
					<span class="text-sm font-medium">{t.nutrition_add_ingredient}</span>
				</button>
			</div>
	</div>

	<!-- Bottom buttons -->
	<div class="px-5 pt-2 shrink-0 flex gap-2" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
		<button onclick={onclose}
		        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
		        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
			{t.nutrition_cancel}
		</button>
		<button onclick={save} disabled={saving || !name.trim() || components.length === 0}
		        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40"
		        style="background: #FB923C; color: #fff">
			{saving ? '…' : (meal.id ? t.nutrition_save : t.nutrition_log_meal)}
		</button>
	</div>
</div>

{#if addSheetOpen}
	<AddComponentSheet
		initial={editingComponentIndex !== null ? components[editingComponentIndex] : null}
		onclose={() => { addSheetOpen = false; editingComponentIndex = null; }}
		onadd={addComponent}
		onpickmeal={applyFavorite}
	/>
{/if}

{#if saveFavOpen}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-[65]" style="background: rgba(0,0,0,0.5)" onclick={() => (saveFavOpen = false)}></div>
	<div class="fixed bottom-0 left-0 right-0 z-[70] rounded-t-3xl flex flex-col max-w-[430px] mx-auto"
	     style="background-color: var(--modal-bg); max-height: 92dvh">
		<div class="flex justify-center pt-3 pb-1 shrink-0">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-outline-variant)"></div>
		</div>
		<div class="px-5 pb-2 shrink-0">
			<p class="font-bold text-lg" style="color: #FB923C">{t.nutrition_save_as_template}</p>
		</div>
		<div class="overflow-y-auto px-5 py-2" style="min-height: 0">
			<input bind:this={favImageInput} type="file" accept="image/*" style="display:none" onchange={handleFavImageSelect} />
			<div class="mb-3">
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
			<label class="block">
				<span class="block text-[11px] uppercase tracking-wide mb-0.5" style="color: var(--color-on-surface-variant)">{t.nutrition_name}</span>
				<input type="text" bind:value={favName} placeholder={t.nutrition_meal_favorite_name_placeholder}
				       class="w-full px-3 rounded-xl bg-transparent outline-none"
				       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 42px" />
			</label>
		</div>
		<div class="px-5 pt-3 shrink-0 flex gap-2" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
			<button onclick={() => (saveFavOpen = false)}
			        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
			        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
				{t.nutrition_cancel}
			</button>
			<button onclick={saveAsFavorite} disabled={savingFav || !favName.trim()}
			        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40"
			        style="background: #FB923C; color: #fff">
				{savingFav ? '…' : t.nutrition_save}
			</button>
		</div>
	</div>
{/if}
