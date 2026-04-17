<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit, SUPPLEMENT_UNITS } from '$lib/units';

	type Nutrient = { id?: string; name: string; amountPerUnit: number | string; unit: string; sortOrder: number };
	type EditSheetType = {
		id: string | null;
		name: string; unit: string; brand: string; info: string; notes: string; active: boolean;
		stockQuantity: string | number; defaultAmount: string | number;
		nutrients: Nutrient[];
	};

	let {
		editSheet = $bindable<EditSheetType | null>(null),
		saving = $bindable(false),
		reminderAfterCreate = $bindable(false),
		onsave,
		onclose,
		ondeleteconfirm,
		onopenreminders
	}: {
		editSheet: EditSheetType | null;
		saving: boolean;
		reminderAfterCreate: boolean;
		onsave: () => void;
		onclose: () => void;
		ondeleteconfirm: (id: string) => void;
		onopenreminders: (supplementId: string) => void;
	} = $props();

	function addNutrient() {
		if (!editSheet) return;
		editSheet.nutrients = [...editSheet.nutrients, { name: '', amountPerUnit: '', unit: '', sortOrder: editSheet.nutrients.length }];
	}

	function removeNutrient(index: number) {
		if (!editSheet) return;
		editSheet.nutrients = editSheet.nutrients.filter((_, i) => i !== index);
	}

	// Unit picker
	const NUTRIENT_UNITS = ['%', 'IU', 'g', 'mcg', 'mg'];

	type PickerTarget = { type: 'supplement' } | { type: 'nutrient'; index: number };

	let pickerTarget = $state<PickerTarget | null>(null);
	let pickerManual = $state(false);
	let pickerManualValue = $state('');

	function openPicker(target: PickerTarget) {
		pickerTarget = target;
		pickerManual = false;
		pickerManualValue = '';
	}

	function closePicker() {
		pickerTarget = null;
		pickerManual = false;
		pickerManualValue = '';
	}

	function selectUnit(value: string) {
		if (!editSheet || !pickerTarget) return;
		if (pickerTarget.type === 'supplement') {
			editSheet.unit = value;
		} else {
			editSheet.nutrients[pickerTarget.index].unit = value;
		}
		closePicker();
	}

	function confirmManual() {
		const val = pickerManualValue.trim();
		if (val) selectUnit(val);
	}

	function currentPickerUnits(): string[] {
		return pickerTarget?.type === 'nutrient' ? NUTRIENT_UNITS : SUPPLEMENT_UNITS;
	}

	function currentPickerValue(): string {
		if (!editSheet || !pickerTarget) return '';
		if (pickerTarget.type === 'supplement') return editSheet.unit;
		return editSheet.nutrients[pickerTarget.index]?.unit ?? '';
	}

	// Catalog search
	type CatalogEntry = { id: string; name: string; unit: string; brand: string | null; info: string | null; packageSize: number | null; nutrients: { name: string; amountPerUnit: number; unit: string; sortOrder: number }[] };

	// 'search' = initial state (only for new), 'form' = show all fields
	let newMode = $state<'search' | 'form'>('search');

	let catalogQuery = $state('');
	let catalogResults = $state<CatalogEntry[]>([]);
	let catalogSearchTimeout: ReturnType<typeof setTimeout> | null = null;
	let catalogSearched = $state(false);

	function onCatalogQueryInput() {
		if (catalogSearchTimeout) clearTimeout(catalogSearchTimeout);
		if (!catalogQuery.trim()) { catalogResults = []; catalogSearched = false; return; }
		catalogSearchTimeout = setTimeout(async () => {
			const res = await fetch(`/api/supplement-catalog?q=${encodeURIComponent(catalogQuery.trim())}`);
			if (res.ok) catalogResults = await res.json();
			catalogSearched = true;
		}, 300);
	}

	function applyCatalogEntry(entry: CatalogEntry) {
		if (!editSheet) return;
		editSheet.name = entry.name;
		editSheet.unit = entry.unit;
		editSheet.brand = entry.brand ?? '';
		editSheet.info = entry.info ?? '';
		editSheet.stockQuantity = entry.packageSize ?? '';
		editSheet.nutrients = entry.nutrients.map((n, i) => ({ name: n.name, amountPerUnit: n.amountPerUnit, unit: n.unit, sortOrder: i }));
		catalogQuery = '';
		catalogResults = [];
		catalogSearched = false;
		newMode = 'form';
	}

	function enterManual() {
		newMode = 'form';
	}

	// Reset to search step whenever the sheet opens for a new supplement
	let _wasOpen = $state(false);
	$effect(() => {
		if (editSheet && !_wasOpen) {
			_wasOpen = true;
			if (!editSheet.id) {
				newMode = 'search';
				catalogQuery = '';
				catalogResults = [];
				catalogSearched = false;
			}
		} else if (!editSheet) {
			_wasOpen = false;
		}
	});
</script>

{#if editSheet}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={onclose}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl flex flex-col"
	     style="background-color: var(--color-surface-low); max-height: 90vh">

		<!-- Handle + title (fixed) -->
		<div class="px-6 pt-5 pb-3 shrink-0">
			<div class="flex justify-center mb-3">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{editSheet.id ? t.supplement_edit_title : t.supplement_new_title}
			</p>
		</div>

		<!-- Scrollable content -->
		<div class="flex-1 overflow-y-auto px-6 pb-2" style="space-y: 0">

			<!-- Search step (only for new supplements in search mode) -->
			{#if !editSheet.id && newMode === 'search'}
				<div class="space-y-3 pt-1">
					<!-- Catalog search -->
					<input
						type="text"
						bind:value={catalogQuery}
						oninput={onCatalogQueryInput}
						placeholder={t.supplement_catalog_search_placeholder}
						class="w-full px-4 py-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>

					{#if catalogResults.length > 0}
						<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
							{#each catalogResults as entry, i}
								<button
									type="button"
									onclick={() => applyCatalogEntry(entry)}
									class="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70 {i > 0 ? 'border-t' : ''}"
									style="border-color: var(--color-outline-variant)"
								>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{entry.name}</div>
										{#if entry.brand}
											<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{entry.brand} · {displayUnit(entry.unit, currentLang())}</div>
										{:else}
											<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{displayUnit(entry.unit, currentLang())}</div>
										{/if}
									</div>
									{#if entry.nutrients.length > 0}
										<span class="text-[10px] px-2 py-0.5 rounded-full shrink-0"
										      style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)">
											{entry.nutrients.length}
										</span>
									{/if}
								</button>
							{/each}
						</div>
					{:else if catalogSearched && catalogQuery.trim()}
						<p class="text-xs px-1" style="color: var(--color-on-surface-variant)">{t.supplement_catalog_no_results}</p>
					{/if}

					<!-- Manual entry option -->
					<button
						type="button"
						onclick={enterManual}
						class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:opacity-70 text-left"
						style="background-color: var(--color-surface-container)"
					>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
						<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.supplement_enter_manually}</span>
					</button>
				</div>
			{/if}

			<!-- Form fields (edit mode OR after mode selection) -->
			{#if editSheet.id || newMode === 'form'}
			<div class="space-y-3 pt-1">

			<!-- Catalog tag (only when prefilled from catalog) -->
			{#if !editSheet.id && editSheet.name}
				<div class="flex items-center gap-2 px-1">
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					<span class="text-xs" style="color: var(--color-primary)">{t.supplement_catalog_applied}</span>
					<button type="button" onclick={() => { newMode = 'search'; catalogQuery = ''; catalogResults = []; catalogSearched = false; }}
					        class="ml-auto text-xs px-2 py-0.5 rounded-full active:opacity-60"
					        style="color: var(--color-on-surface-variant); background-color: var(--color-surface-container)">
						↩
					</button>
				</div>
			{/if}

			<!-- Name + Unit (75% / 25%) -->
			<div class="flex gap-2">
				<div style="flex: 3">
					<label for="supp-edit-name" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">{t.supplement_name_label}<span style="color: var(--color-error)"> *</span></label>
					<input
						id="supp-edit-name"
						type="text"
						bind:value={editSheet.name}
						placeholder={t.supplement_name_placeholder}
						class="w-full px-4 py-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
				<div style="flex: 1">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">
						{t.supplement_unit_label}<span style="color: var(--color-error)"> *</span>
					</label>
					<button
						onclick={() => openPicker({ type: 'supplement' })}
						class="w-full px-3 py-3 rounded-xl border-0 text-left flex items-center justify-between gap-1"
						style="background-color: var(--color-surface-container); font-size: 16px; color: {editSheet.unit ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}; min-height: 50px"
					>
						<span class="truncate">{editSheet.unit ? displayUnit(editSheet.unit, currentLang()) : '–'}</span>
						<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
							<polyline points="6 9 12 15 18 9"/>
						</svg>
					</button>
				</div>
			</div>

			<!-- Brand + Info (compact 2-col) -->
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label for="supp-edit-brand" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">{t.supplement_brand_label}</label>
					<input
						id="supp-edit-brand"
						type="text"
						bind:value={editSheet.brand}
						placeholder={t.supplement_brand_placeholder}
						class="w-full px-3 py-2.5 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
				<div>
					<label for="supp-edit-info" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">{t.supplement_info_label}</label>
					<input
						id="supp-edit-info"
						type="text"
						bind:value={editSheet.info}
						placeholder={t.supplement_info_placeholder}
						class="w-full px-3 py-2.5 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
			</div>

			<!-- Stock + Default Amount (compact 2-col) -->
			<div class="grid grid-cols-2 gap-2">
				<div>
					<label for="supp-edit-stock" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">{t.supplement_stock_label}</label>
					<input
						id="supp-edit-stock"
						type="number"
						inputmode="decimal"
						bind:value={editSheet.stockQuantity}
						placeholder={t.supplement_stock_placeholder}
						class="w-full px-3 py-2.5 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
				<div>
					<label for="supp-edit-default" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">{t.supplement_default_amount_label}</label>
					<input
						id="supp-edit-default"
						type="number"
						inputmode="decimal"
						bind:value={editSheet.defaultAmount}
						placeholder="1"
						class="w-full px-3 py-2.5 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
				</div>
			</div>

			<!-- Active + Edit alarm / Reminder (two separate cards) -->
			<div class="grid grid-cols-2 gap-2">
				<!-- Active card -->
				<div class="rounded-xl flex items-center justify-between px-3 py-3" style="background-color: var(--color-surface-container)">
					<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.supplement_active_label}</span>
					<button
						onclick={() => { if (editSheet) editSheet.active = !editSheet.active; }}
						class="w-10 h-5 rounded-full relative overflow-hidden transition-colors shrink-0"
						style="background-color: {editSheet.active ? 'var(--color-primary)' : 'var(--color-surface-high)'}"
					>
						{#if editSheet.active}
							<span class="absolute top-0.5 h-4 w-4 rounded-full"
							      style="background-color: white; transform: translateX(1.25rem)"></span>
						{/if}
					</button>
				</div>
				{#if editSheet.id}
					<!-- Edit alarm card (existing supplements) -->
					<button
						onclick={() => { if (editSheet?.id) onopenreminders(editSheet.id); }}
						class="rounded-xl flex items-center justify-center gap-2 px-3 py-3 text-sm font-medium active:opacity-60"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
					>
						<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
							<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
						</svg>
						{t.supplement_reminders_edit}
					</button>
				{:else}
					<!-- Reminder after create card (new supplements) -->
					<div class="rounded-xl flex items-center justify-between px-3 py-3" style="background-color: var(--color-surface-container)">
						<span class="text-xs font-medium leading-tight" style="color: var(--color-on-surface)">{t.supplement_reminders_after_create}</span>
						<button
							onclick={() => { reminderAfterCreate = !reminderAfterCreate; }}
							class="w-10 h-5 rounded-full relative overflow-hidden transition-colors shrink-0 ml-2"
							style="background-color: {reminderAfterCreate ? 'var(--color-primary)' : 'var(--color-surface-high)'}"
						>
							{#if reminderAfterCreate}
								<span class="absolute top-0.5 h-4 w-4 rounded-full"
								      style="background-color: white; transform: translateX(1.25rem)"></span>
							{/if}
						</button>
					</div>
				{/if}
			</div>

			<!-- Nutrients -->
			<div>
				<p class="text-xs font-semibold uppercase tracking-wider mb-2" style="color: var(--color-on-surface-variant)">{t.supplement_nutrients_label}</p>
				<!-- Column headers -->
				<div class="flex gap-2 items-center mb-1 px-1">
					<span class="flex-1 min-w-0 text-xs" style="color: var(--color-on-surface-variant)">{t.supplement_nutrient_name}</span>
					<span class="w-16 text-xs text-center" style="color: var(--color-on-surface-variant)">{t.supplement_nutrient_amount}</span>
					<span class="w-14 text-xs text-center" style="color: var(--color-on-surface-variant)">{t.supplement_nutrient_unit}</span>
					<span class="w-8"></span>
				</div>
				<div class="space-y-2">
					{#each editSheet.nutrients as nutrient, i}
						<div class="flex gap-2 items-center">
							<input
								type="text"
								bind:value={nutrient.name}
								placeholder={t.supplement_nutrient_name_placeholder}
								class="flex-1 min-w-0 px-3 py-2.5 rounded-xl border-0 outline-none text-sm"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
							/>
							<input
								type="number"
								inputmode="decimal"
								bind:value={nutrient.amountPerUnit}
								placeholder="0"
								class="w-16 px-3 py-2.5 rounded-xl border-0 outline-none text-sm"
								style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
							/>
							<button
								onclick={() => openPicker({ type: 'nutrient', index: i })}
								class="w-14 px-2 py-2.5 rounded-xl border-0 text-left flex items-center justify-between gap-0.5"
								style="background-color: var(--color-surface-container); font-size: 14px; color: {nutrient.unit ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}; min-height: 44px"
							>
								<span class="truncate">{nutrient.unit || '–'}</span>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
									<polyline points="6 9 12 15 18 9"/>
								</svg>
							</button>
							<button
								onclick={() => removeNutrient(i)}
								class="shrink-0 p-2 rounded-lg active:opacity-60"
								style="color: var(--color-error)"
								aria-label={t.supplement_nutrient_remove}
							>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
								</svg>
							</button>
						</div>
					{/each}
				</div>
				<button
					onclick={addNutrient}
					class="mt-2 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl active:opacity-60"
					style="color: var(--color-primary); background-color: var(--color-primary-container)"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
					{t.supplement_nutrient_add}
				</button>
			</div>

		</div><!-- end form fields -->
		{/if}

		</div><!-- end scrollable -->

		<!-- Anchored save + delete (only in form mode) -->
		{#if editSheet.id || newMode === 'form'}
		<div class="px-6 pt-3 pb-6 shrink-0 flex gap-2" style="border-top: 1px solid var(--color-surface-high)">
			{#if editSheet.id}
				<button
					onclick={() => { if (editSheet?.id) { ondeleteconfirm(editSheet.id); onclose(); } }}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-error)"
				>
					{t.item_delete}
				</button>
			{/if}
			<button
				onclick={onsave}
				disabled={saving || !editSheet.name.trim() || !editSheet.unit.trim()}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{saving ? '…' : t.supplement_save}
			</button>
		</div>
		{/if}

	</div>
{/if}

<!-- Unit picker bottom sheet -->
{#if pickerTarget}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-60" style="background-color: rgba(0,0,0,0.4)" onclick={closePicker}></div>
	<div class="fixed bottom-0 left-0 right-0 z-60 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">

		<div class="px-6 pt-5 pb-2 shrink-0">
			<div class="flex justify-center mb-3">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_unit_pick_title}</p>
		</div>

		<div class="px-4 pb-6">
			<!-- Predefined options -->
			{#each currentPickerUnits() as unit}
				{@const selected = currentPickerValue() === unit}
				<button
					onclick={() => selectUnit(unit)}
					class="w-full flex items-center justify-between px-4 py-3.5 rounded-xl mb-1 active:opacity-70 text-left"
					style="background-color: {selected ? 'var(--color-primary-container)' : 'var(--color-surface-container)'}; color: {selected ? 'var(--color-primary)' : 'var(--color-on-surface)'}"
				>
					<span class="text-base font-medium">{displayUnit(unit, currentLang())}</span>
					{#if selected}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
							<polyline points="20 6 9 17 4 12"/>
						</svg>
					{/if}
				</button>
			{/each}

			<!-- Divider -->
			<div class="my-2" style="border-top: 1px solid var(--color-outline-variant)"></div>

			<!-- Manual entry -->
			{#if !pickerManual}
				<button
					onclick={() => { pickerManual = true; pickerManualValue = currentPickerValue(); }}
					class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl active:opacity-70 text-left"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>
					<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
						<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
					</svg>
					<span class="text-base">{t.supplement_unit_manual}</span>
				</button>
			{:else}
				<div class="flex gap-2 items-center px-1">
					<!-- svelte-ignore a11y_autofocus -->
					<input
						type="text"
						bind:value={pickerManualValue}
						placeholder={t.supplement_unit_manual}
						autofocus
						onkeydown={(e) => { if (e.key === 'Enter') confirmManual(); }}
						class="flex-1 px-4 py-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
					/>
					<button
						onclick={confirmManual}
						disabled={!pickerManualValue.trim()}
						class="px-5 py-3 rounded-xl text-sm font-semibold active:opacity-70 disabled:opacity-40"
						style="background-color: var(--color-primary); color: var(--color-on-primary)"
					>
						OK
					</button>
				</div>
			{/if}
		</div>

	</div>
{/if}
