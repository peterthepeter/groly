<script lang="ts">
import { onMount } from 'svelte';
import AddComponentSheet from './AddComponentSheet.svelte';
import { t } from '$lib/i18n.svelte';

type CaffeineDrink = { id: string; name: string; defaultMl: number; caffeineMg: number };

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

type ExistingMeal = {
	id: string;
	displayName: string;
	imageUrl?: string | null;
	caffeineDrinkId?: string | null;
	components: Component[];
};

let { existing = null, onclose, onsaved }: {
	existing?: ExistingMeal | null;
	onclose: () => void;
	onsaved: () => void;
} = $props();

// svelte-ignore state_referenced_locally
let name = $state(existing?.displayName ?? '');
// svelte-ignore state_referenced_locally
let components = $state<Component[]>((existing?.components ?? []).map((c) => ({ ...c })));
// svelte-ignore state_referenced_locally
let imageUrl = $state<string | null>(existing?.imageUrl ?? null);
let imageUploading = $state(false);
let imageFileInput = $state<HTMLInputElement | null>(null);
let saving = $state(false);
let saved = $state(false);
let addSheetOpen = $state(false);
let editingComponentIndex = $state<number | null>(null);

// Koffein-Verknüpfung: nur sichtbar, wenn ein gleichnamiges Koffein-Getränk existiert
// (oder bereits verknüpft ist). Beim Loggen wird dann zusätzlich Koffein erfasst.
let caffeineDrinks = $state<CaffeineDrink[]>([]);
// svelte-ignore state_referenced_locally
let caffeineLinked = $state<boolean>(!!existing?.caffeineDrinkId);

const linkedDrink = $derived.by(() => {
	const byName = caffeineDrinks.find((d) => d.name.trim().toLowerCase() === name.trim().toLowerCase());
	if (byName) return byName;
	if (existing?.caffeineDrinkId) return caffeineDrinks.find((d) => d.id === existing.caffeineDrinkId) ?? null;
	return null;
});

onMount(async () => {
	try {
		const res = await fetch('/api/caffeine-drinks');
		if (res.ok) caffeineDrinks = (await res.json()).drinks ?? [];
	} catch { /* noop */ }
});

async function handleImageSelect(e: Event) {
	const file = (e.target as HTMLInputElement).files?.[0];
	if (!file) return;
	imageUploading = true;
	let uploadBlob: Blob = file;
	try {
		uploadBlob = await compressImage(file, 800, 0.78);
	} catch { /* fall back to original */ }
	try {
		const fd = new FormData();
		fd.append('image', uploadBlob, 'photo.jpg');
		const res = await fetch('/api/uploads/image', { method: 'POST', body: fd });
		if (res.ok) imageUrl = (await res.json()).url;
	} catch { /* ignore */ }
	imageUploading = false;
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

function effectiveGrams(c: Component): number {
	if (c.unit === 'piece') return c.amount * (c.gramsPerPiece ?? 0);
	return c.amount;
}

function compKcal(c: Component): number {
	return ((c.kcalPer100 ?? 0) * effectiveGrams(c)) / 100;
}

const totalKcal = $derived(Math.round(components.reduce((s, c) => s + compKcal(c), 0)));

function removeComponent(i: number) {
	components = components.filter((_, idx) => idx !== i);
}

function addComponent(c: Component) {
	if (editingComponentIndex !== null) {
		components = components.map((existingC, idx) => idx === editingComponentIndex ? c : existingC);
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

async function save() {
	if (saving) return;
	if (!name.trim() || components.length === 0) return;
	saving = true;
	const payload = {
		displayName: name.trim(),
		imageUrl,
		// Verknüpfung setzen/lösen, sobald der Schalter sichtbar ist (gleichnamiges Getränk vorhanden)
		...(linkedDrink ? { caffeineDrinkId: caffeineLinked ? linkedDrink.id : null } : {}),
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
	};
	let ok = false;
	try {
		const url = existing ? `/api/nutrition/meal-favorites/${existing.id}` : '/api/nutrition/meal-favorites';
		const method = existing ? 'PATCH' : 'POST';
		const res = await fetch(url, {
			method,
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(existing ? payload : { ...payload, defaultMealName: null })
		});
		ok = res.ok;
	} finally {
		saving = false;
	}
	if (ok) {
		saved = true;
		setTimeout(onsaved, 500);
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
	<div class="px-5 pb-2 shrink-0">
		<p class="font-bold text-lg" style="color: #FB923C">{existing ? t.nutrition_edit : t.nutrition_new_meal_favorite}</p>
	</div>

	<!-- Scrollable content -->
	<div class="overflow-y-auto px-5 py-2" style="min-height: 0">
		<!-- Bild -->
		<input bind:this={imageFileInput} type="file" accept="image/*" style="display:none" onchange={handleImageSelect} />
		<div class="mb-3">
			{#if imageUrl}
				<div class="relative rounded-xl overflow-hidden" style="border: 1px solid var(--bubble-interactive-border)">
					<img src={imageUrl} alt="" class="w-full object-cover" style="max-height: 160px" />
					<button onclick={() => (imageUrl = null)}
					        class="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center active:opacity-70"
					        style="background: rgba(0,0,0,0.55); color: #fff" aria-label={t.nutrition_remove}>✕</button>
				</div>
			{:else}
				<button onclick={() => imageFileInput?.click()} disabled={imageUploading}
				        class="w-full py-3 rounded-xl text-sm font-medium active:opacity-70 flex items-center justify-center gap-2"
				        style="border: 1px dashed var(--bubble-interactive-border); color: #FB923C">
					{#if imageUploading}
						<div class="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style="border-color: #FB923C; border-top-color: transparent"></div>
					{:else}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
					{/if}
					{t.nutrition_add_image}
				</button>
			{/if}
		</div>

		<label class="block mb-3">
			<span class="block text-[11px] uppercase tracking-wide mb-0.5" style="color: var(--color-on-surface-variant)">{t.nutrition_name}</span>
			<input type="text" bind:value={name} placeholder={t.nutrition_meal_favorite_name_placeholder}
			       class="w-full px-3 rounded-xl bg-transparent outline-none"
			       style="border: 1px solid var(--bubble-interactive-border); font-size: 16px; height: 42px" />
		</label>

		<!-- Koffein-Verknüpfung – nur wenn ein gleichnamiges Koffein-Getränk existiert -->
		{#if linkedDrink}
			<button type="button" onclick={() => (caffeineLinked = !caffeineLinked)}
			        class="w-full mb-3 px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-left active:opacity-80"
			        style="border: 1px solid var(--bubble-interactive-border)">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
					<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
				</svg>
				<div class="flex-1 min-w-0">
					<div class="text-sm font-medium" style="color: var(--color-on-surface)">{t.nutrition_caffeine_link}</div>
					<div class="text-xs" style="color: var(--color-on-surface-variant)">{linkedDrink.name} · {linkedDrink.caffeineMg} mg</div>
				</div>
				<div class="shrink-0 w-11 h-6 rounded-full transition-colors relative"
				     style="background-color: {caffeineLinked ? '#FB923C' : 'var(--bubble-interactive-border)'}">
					<div class="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
					     style="left: {caffeineLinked ? '1.5rem' : '0.125rem'}"></div>
				</div>
			</button>
		{/if}

		<div class="flex items-center justify-between mb-1.5">
			<span class="text-[11px] uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.nutrition_ingredients}</span>
			<span class="text-sm font-semibold" style="color: #FB923C">{totalKcal} kcal</span>
		</div>

		<div class="flex flex-col gap-1.5 mb-2">
			{#each components as c, i (i)}
				{@const kcal = Math.round(compKcal(c))}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="px-2.5 py-2 rounded-xl flex items-center gap-2.5 cursor-pointer active:opacity-80"
				     style="border: 1px solid var(--bubble-interactive-border)"
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
			{/each}
		</div>

		<button onclick={() => { editingComponentIndex = null; addSheetOpen = true; }}
		        class="w-full py-2 rounded-xl text-sm font-medium active:opacity-70"
		        style="border: 1px dashed var(--bubble-interactive-border); color: #FB923C">
			{t.nutrition_add_ingredient}
		</button>
	</div>

	<!-- Bottom buttons -->
	<div class="px-5 pt-2 shrink-0 flex gap-2" style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem)">
		<button onclick={onclose}
		        class="flex-1 py-3 rounded-full text-sm font-semibold active:opacity-70"
		        style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)">
			{t.nutrition_cancel}
		</button>
		<button onclick={save} disabled={saving || saved || !name.trim() || components.length === 0}
		        class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-100 flex items-center justify-center gap-1.5"
		        style="background: {saved ? '#22C55E' : '#FB923C'}; color: #fff; transition: background-color 0.2s; opacity: {(!name.trim() || components.length === 0) && !saved ? 0.4 : 1}">
			{#if saved}
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
			{:else}
				{saving ? '…' : t.nutrition_save}
			{/if}
		</button>
	</div>
</div>

{#if addSheetOpen}
	<AddComponentSheet
		initial={editingComponentIndex !== null ? components[editingComponentIndex] : null}
		onclose={() => { addSheetOpen = false; editingComponentIndex = null; }}
		onadd={addComponent}
	/>
{/if}
