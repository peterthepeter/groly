<script lang="ts">
	// Shared Manage presentation; domain behavior remains local to this editor.
	import { untrack } from 'svelte';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit, SUPPLEMENT_UNITS } from '$lib/units';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import SupplementActiveToggle from './SupplementActiveToggle.svelte';

	type Nutrient = { id?: string; name: string; amountPerUnit: number | string; unit: string; sortOrder: number };
	type EditSheetType = {
		id: string | null;
		name: string; unit: string; brand: string; info: string; notes: string; active: boolean;
		stockQuantity: string | number; defaultAmount: string | number;
		nutrients: Nutrient[];
	};

	let {
		editSheet = $bindable<EditSheetType | null>(null), saving = $bindable(false), reminderAfterCreate = $bindable(false),
		onsave, onclose, ondeleteconfirm, onopenreminders
	}: {
		editSheet: EditSheetType | null; saving: boolean; reminderAfterCreate: boolean;
		onsave: () => void; onclose: () => void; ondeleteconfirm: (id: string) => void;
		onopenreminders: (supplementId: string) => void;
	} = $props();

	function addNutrient() {
		if (!editSheet) return;
		editSheet.nutrients = [...editSheet.nutrients, { name: '', amountPerUnit: '', unit: '', sortOrder: editSheet.nutrients.length }];
	}

	function removeNutrient(index: number) {
		if (editSheet) editSheet.nutrients = editSheet.nutrients.filter((_, i) => i !== index);
	}

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
		if (pickerTarget.type === 'supplement') editSheet.unit = value;
		else editSheet.nutrients[pickerTarget.index].unit = value;
		closePicker();
	}

	function confirmManual() {
		const value = pickerManualValue.trim();
		if (value) selectUnit(value);
	}

	function currentPickerUnits(): string[] {
		return pickerTarget?.type === 'nutrient' ? NUTRIENT_UNITS : SUPPLEMENT_UNITS;
	}

	function currentPickerValue(): string {
		if (!editSheet || !pickerTarget) return '';
		if (pickerTarget.type === 'supplement') return editSheet.unit;
		return editSheet.nutrients[pickerTarget.index]?.unit ?? '';
	}

	type CatalogEntry = {
		id: string; name: string; unit: string; brand: string | null; info: string | null; packageSize: number | null;
		nutrients: { name: string; amountPerUnit: number; unit: string; sortOrder: number }[];
	};
	let newMode = $state<'search' | 'form'>('search');
	let catalogQuery = $state('');
	let catalogResults = $state<CatalogEntry[]>([]);
	let catalogSearchTimeout: ReturnType<typeof setTimeout> | null = null;
	let catalogSearched = $state(false);

	function onCatalogQueryInput() {
		if (catalogSearchTimeout) clearTimeout(catalogSearchTimeout);
		if (!catalogQuery.trim()) { catalogResults = []; catalogSearched = false; return; }
		catalogSearchTimeout = setTimeout(async () => {
			const response = await fetch(`/api/supplement-catalog?q=${encodeURIComponent(catalogQuery.trim())}`);
			if (response.ok) catalogResults = await response.json();
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
		editSheet.nutrients = entry.nutrients.map((nutrient, index) => ({ ...nutrient, sortOrder: index }));
		catalogQuery = '';
		catalogResults = [];
		catalogSearched = false;
		newMode = 'form';
	}

	$effect(() => {
		const sheet = editSheet;
		untrack(() => {
			if (sheet !== null && sheet.id === null) {
				newMode = 'search';
				catalogQuery = '';
				catalogResults = [];
				catalogSearched = false;
			}
		});
	});
</script>

{#if editSheet}
	<ManageSheetShell accent="var(--color-primary)" title={editSheet.id ? t.supplement_edit_title : t.supplement_new_title} {onclose} showFooter={editSheet.id !== null || newMode === 'form'}>
		{#snippet headerActions()}
			{#if editSheet.id || newMode === 'form'}
				<div class="supplement-header-actions">
					<span class="supplement-header-active">
						<span>{t.supplement_active_label}</span>
						<SupplementActiveToggle active={editSheet.active} label={t.supplement_active_label} onclick={() => { if (editSheet) editSheet.active = !editSheet.active; }} />
					</span>
					{#if editSheet.id}
						<button type="button" onclick={() => { if (editSheet?.id) onopenreminders(editSheet.id); }} class="supplement-header-reminder" aria-label={t.supplement_reminders_edit}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
						</button>
					{:else}
						<button type="button" onclick={() => { reminderAfterCreate = !reminderAfterCreate; }} class="supplement-header-reminder" data-active={reminderAfterCreate} aria-label={t.supplement_reminders_after_create} aria-pressed={reminderAfterCreate}>
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
						</button>
					{/if}
				</div>
			{/if}
		{/snippet}

		{#snippet body()}
			{#if !editSheet.id && newMode === 'search'}
				<div class="manage-stack min-h-[230px]">
					{#if catalogResults.length > 0}
						<div class="manage-section !p-1">
							{#each catalogResults as entry}
								<button type="button" onclick={() => applyCatalogEntry(entry)} class="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left active:opacity-70">
									<div class="min-w-0 flex-1">
										<div class="truncate text-sm font-semibold" style="color: var(--color-on-surface)">{entry.name}</div>
										<div class="truncate text-xs" style="color: var(--color-on-surface-variant)">{entry.brand ? `${entry.brand} · ` : ''}{displayUnit(entry.unit, currentLang())}</div>
									</div>
									{#if entry.nutrients.length > 0}<span class="text-xs" style="color: var(--color-primary)">{entry.nutrients.length}</span>{/if}
								</button>
							{/each}
						</div>
					{:else if catalogSearched && catalogQuery.trim()}
						<p class="px-1 text-xs" style="color: var(--color-on-surface-variant)">{t.supplement_catalog_no_results}</p>
					{/if}
					<div class="manage-section sticky bottom-0 mt-auto">
						<input type="text" bind:value={catalogQuery} oninput={onCatalogQueryInput} placeholder={t.supplement_catalog_search_placeholder} class="manage-input" />
						<button type="button" onclick={() => (newMode = 'form')} class="mt-2 flex min-h-11 w-full items-center justify-center gap-2 text-sm font-semibold" style="color: var(--color-primary)">
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
							{t.supplement_enter_manually}
						</button>
					</div>
				</div>
			{:else}
				<div class="manage-stack">
					{#if !editSheet.id && editSheet.name}
						<div class="flex items-center gap-2 px-1 text-xs" style="color: var(--color-primary)">
							<span>✓ {t.supplement_catalog_applied}</span>
							<button type="button" onclick={() => { newMode = 'search'; catalogQuery = ''; catalogResults = []; catalogSearched = false; }} class="ml-auto min-h-9 px-3" aria-label={t.supplement_catalog_search_placeholder}>↩</button>
						</div>
					{/if}

					<section class="manage-settings-surface">
						<div class="supplement-field-row supplement-field-row-name">
							<label class="supplement-field-cell" for="supp-edit-name">
								<span class="manage-settings-label">{t.supplement_name_label}<span style="color: var(--color-error)"> *</span></span>
								<input id="supp-edit-name" type="text" bind:value={editSheet.name} placeholder={t.supplement_name_placeholder} class="manage-settings-input supplement-field-input" />
							</label>
							<button type="button" onclick={() => openPicker({ type: 'supplement' })} class="supplement-field-cell supplement-unit-cell">
								<span class="manage-settings-label">{t.supplement_unit_label}<span style="color: var(--color-error)"> *</span></span>
								<span class="manage-settings-input supplement-field-control truncate">{editSheet.unit ? displayUnit(editSheet.unit, currentLang()) : '–'}</span>
							</button>
						</div>
						<div class="supplement-field-row">
							<label class="supplement-field-cell" for="supp-edit-brand">
								<span class="manage-settings-label">{t.supplement_brand_label}</span>
								<input id="supp-edit-brand" type="text" bind:value={editSheet.brand} placeholder={t.supplement_brand_placeholder} class="manage-settings-input supplement-field-input" />
							</label>
							<label class="supplement-field-cell" for="supp-edit-info">
								<span class="manage-settings-label">{t.supplement_info_label}</span>
								<input id="supp-edit-info" type="text" bind:value={editSheet.info} placeholder={t.supplement_info_placeholder} class="manage-settings-input supplement-field-input" />
							</label>
						</div>
						<div class="supplement-field-row">
							<label class="supplement-field-cell" for="supp-edit-stock">
								<span class="manage-settings-label">{t.supplement_stock_label}</span>
								<input id="supp-edit-stock" type="number" inputmode="decimal" bind:value={editSheet.stockQuantity} placeholder={t.supplement_stock_placeholder} class="manage-settings-input supplement-field-input" />
							</label>
							<label class="supplement-field-cell" for="supp-edit-default">
								<span class="manage-settings-label">{t.supplement_default_amount_label}</span>
								<input id="supp-edit-default" type="number" inputmode="decimal" bind:value={editSheet.defaultAmount} placeholder="1" class="manage-settings-input supplement-field-input" />
							</label>
						</div>
					</section>

					<section class="manage-section !px-2">
						<p class="manage-section-title">{t.supplement_nutrients_label}</p>
						<div class="grid grid-cols-[minmax(0,1fr)_58px_52px_32px] items-end gap-1 px-1 pb-1 text-[10px]" style="color: var(--color-on-surface-variant)">
							<span>{t.supplement_nutrient_name}</span><span class="text-center">{t.supplement_nutrient_amount}</span><span class="text-center">{t.supplement_nutrient_unit}</span><span></span>
						</div>
						<div class="overflow-hidden rounded-xl border" style="border-color: var(--bubble-container-border); background: var(--bubble-container-bg)">
							{#each editSheet.nutrients as nutrient, i}
								<div class="grid min-h-10 grid-cols-[minmax(0,1fr)_58px_52px_32px] items-center gap-1 border-b px-1 last:border-b-0" style="border-color: var(--bubble-container-border)">
									<input type="text" bind:value={nutrient.name} placeholder={t.supplement_nutrient_name_placeholder} class="min-w-0 outline-none" style="height: 40px; border: 0; background: transparent; color: var(--color-on-surface); font-size: 16px" />
									<input type="number" inputmode="decimal" bind:value={nutrient.amountPerUnit} placeholder="0" class="nutrient-amount min-w-0 text-center outline-none" style="height: 40px; border: 0; background: transparent; color: var(--color-on-surface); font-size: 16px; appearance: textfield" />
									<button type="button" onclick={() => openPicker({ type: 'nutrient', index: i })} class="h-10 truncate text-center text-sm" style="color: var(--color-on-surface)">{nutrient.unit || '–'}</button>
									<button type="button" onclick={() => removeNutrient(i)} class="h-10 text-lg" style="color: var(--color-error)" aria-label={t.supplement_nutrient_remove}>×</button>
								</div>
							{/each}
						</div>
						<button type="button" onclick={addNutrient} class="mt-1 min-h-9 px-2 text-xs font-semibold" style="color: var(--color-primary)">＋ {t.supplement_nutrient_add}</button>
					</section>
				</div>
			{/if}
		{/snippet}

		{#snippet footer()}
			{#if editSheet.id}
				<button type="button" onclick={() => { if (editSheet?.id) { ondeleteconfirm(editSheet.id); onclose(); } }} class="manage-danger">{t.item_delete}</button>
			{:else}
				<button type="button" onclick={onclose} class="manage-secondary">{t.close}</button>
			{/if}
			<button type="button" onclick={onsave} disabled={saving || !editSheet.name.trim() || !editSheet.unit.trim()} class="manage-primary disabled:opacity-40">{saving ? '…' : t.supplement_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}

<style>
	.supplement-header-actions,
	.supplement-header-active {
		display: flex;
		align-items: center;
	}

	.supplement-header-actions {
		gap: 6px;
	}

	.supplement-header-active {
		gap: 6px;
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 600;
	}

	.supplement-header-reminder {
		display: flex;
		width: 32px;
		height: 32px;
		flex: none;
		align-items: center;
		justify-content: center;
		color: var(--color-primary);
		border-radius: 10px;
	}

	.supplement-header-reminder[data-active='false'] {
		color: var(--color-on-surface-variant);
	}

	.supplement-header-reminder:active {
		background: color-mix(in srgb, var(--color-primary) 8%, transparent);
	}

	.supplement-field-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		border-top: 1px solid var(--bubble-container-border);
	}

	.supplement-field-row:first-child {
		border-top: 0;
	}

	.supplement-field-row-name {
		grid-template-columns: minmax(0, 3fr) minmax(92px, 1fr);
	}

	.supplement-field-cell {
		display: block;
		min-width: 0;
		padding: 5px 12px 3px;
		transition: background-color 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	.supplement-unit-cell {
		width: 100%;
		text-align: left;
	}

	.supplement-field-cell:focus-within {
		background: color-mix(in srgb, var(--color-primary) 7%, transparent);
	}

	.supplement-field-control {
		display: flex;
		align-items: center;
		text-align: left;
	}

	.supplement-field-input[type='number'] {
		appearance: textfield;
	}

	.supplement-field-input[type='number']::-webkit-inner-spin-button,
	.supplement-field-input[type='number']::-webkit-outer-spin-button {
		margin: 0;
		appearance: none;
	}

	.nutrient-amount::-webkit-inner-spin-button,
	.nutrient-amount::-webkit-outer-spin-button {
		margin: 0;
		appearance: none;
	}
</style>

{#if pickerTarget}
	<ManageSheetShell accent="var(--color-primary)" title={t.supplement_unit_pick_title} onclose={closePicker} showFooter={false} zIndex={70} maxHeight="78dvh">
		{#snippet body()}
			<div class="manage-stack">
				<div class="manage-section !p-1">
					{#each currentPickerUnits() as unit}
						{@const selected = currentPickerValue() === unit}
						<button type="button" onclick={() => selectUnit(unit)} class="flex min-h-11 w-full items-center justify-between rounded-xl px-3 text-left text-base font-semibold" style="color: {selected ? 'var(--color-primary)' : 'var(--color-on-surface)'}; background: {selected ? 'color-mix(in srgb, var(--color-primary) 12%, transparent)' : 'transparent'}">
							{displayUnit(unit, currentLang())}<span aria-hidden="true">{selected ? '✓' : ''}</span>
						</button>
					{/each}
				</div>
				<div class="manage-section">
					{#if !pickerManual}
						<button type="button" onclick={() => { pickerManual = true; pickerManualValue = currentPickerValue(); }} class="manage-secondary w-full">{t.supplement_unit_manual}</button>
					{:else}
						<div class="grid grid-cols-[minmax(0,1fr)_72px] gap-2">
							<!-- svelte-ignore a11y_autofocus -->
							<input type="text" bind:value={pickerManualValue} placeholder={t.supplement_unit_manual} autofocus onkeydown={(event) => { if (event.key === 'Enter') confirmManual(); }} class="manage-input" />
							<button type="button" onclick={confirmManual} disabled={!pickerManualValue.trim()} class="manage-primary disabled:opacity-40">OK</button>
						</div>
					{/if}
				</div>
			</div>
		{/snippet}
	</ManageSheetShell>
{/if}
