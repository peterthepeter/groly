<script lang="ts">
	import { onMount, untrack } from 'svelte';
	import { ArrowLeft, ChevronRight, ListOrdered, MapPin, Users, Bell, LocateFixed, Map, Search, X, Trash2, Copy, RotateCcw } from '@lucide/svelte';
	import { t, currentLang } from '#lib/i18n.svelte';
	import ManageSheetShell from '#lib/components/supplements/ManageSheetShell.svelte';
	import ChecklistSectionsEditor from './ChecklistSectionsEditor.svelte';
	import CategoryOrderEditor from '#lib/components/CategoryOrderEditor.svelte';
	import ShoppingItemSortSelect from '#lib/components/ShoppingItemSortSelect.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import SettingsToggleRow from '#lib/components/SettingsToggleRow.svelte';
	import MapPickerSheet from '#lib/components/MapPickerSheet.svelte';
	import { LIST_ICONS, getListIcon, getListIconLabel } from '#lib/listIcons';
	import { userSettings } from '#lib/userSettings.svelte';
	import { resolveShoppingItemSortMode, type ListCategorySettings, type ShoppingItemSortMode } from '#lib/userSettingsTypes';
	import { validChecklistSections, type ChecklistSettings, type ListKind } from '#lib/checklists';
	import { generateClientId } from '#lib/sync/manager';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';

	let { list = null, onSave, onDelete = null, onShare = null, onClose, memberCount = 0, suspended = false, onReset = null, onDuplicate = null }: {
		list?: { id: string; name: string; description: string | null; iconId?: string | null; locationLat?: number | null; locationLng?: number | null; locationName?: string | null; kind?: ListKind; checklistSections?: ChecklistSettings['checklistSections'] | null; defaultSectionId?: string | null } | null;
		onSave: (name: string, description: string, iconId: string | null, shareAfterCreate?: boolean, locationLat?: number | null, locationLng?: number | null, locationName?: string | null, kind?: ListKind, checklist?: ChecklistSettings) => void | Promise<void>;
		onDelete?: (() => void) | null;
		onShare?: (() => void) | null;
		onReset?: (() => Promise<void>) | null;
		onDuplicate?: ((name: string, id: string) => Promise<void>) | null;
		onClose: () => void;
		memberCount?: number;
		suspended?: boolean;
	} = $props();

	const id = $props.id();
	// The component stays mounted while sharing; all list edits remain a local draft.
	// svelte-ignore state_referenced_locally
	let name = $state(list?.name ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(list?.description ?? '');
	// svelte-ignore state_referenced_locally
	let selectedIconId = $state<string | null>(list ? list.iconId ?? null : 'supermarkt');
	// svelte-ignore state_referenced_locally
	let categorySettings = $state<ListCategorySettings | null>(initialCategorySettings(list?.id));
	const itemSortMode = $derived(categorySettings && resolveShoppingItemSortMode(categorySettings.enabled, categorySettings.itemSortDirection));
	// svelte-ignore state_referenced_locally
	let locationDisabled = $state(list?.id ? userSettings.isListLocationDisabled(list.id) : false);
	// svelte-ignore state_referenced_locally
	let locationLat = $state<number | null>(list?.locationLat ?? null);
	// svelte-ignore state_referenced_locally
	let locationLng = $state<number | null>(list?.locationLng ?? null);
	// svelte-ignore state_referenced_locally
	let locationName = $state<string | null>(list?.locationName ?? null);
	const initial = untrack(() => ({
		kind: list?.kind ?? 'shopping',
		checklistSections: list?.checklistSections?.map(section => ({ ...section })) ?? [],
		defaultSectionId: list?.defaultSectionId ?? null
	}));
	let kind = $state<ListKind>(initial.kind);
	let sections = $state(initial.checklistSections.map(section => ({ ...section })));
	let defaultSectionId = $state(initial.defaultSectionId);
	let duplicateName = $state('');
	let duplicateId = '';
	let view = $state<'list' | 'categories' | 'location' | 'sections' | 'duplicate'>('list');
	let bottomOffset = $state(0);
	let saving = $state(false);
	let saveError = $state('');
	let shareAfterCreate = $state(false);
	let notificationsEnabled = $state(true);
	let originalNotifications = $state<boolean | null>(null);
	let notificationsLoading = $state(false);
	let notificationsError = $state(false);
	let notificationRetry = $state(0);
	let locationQuery = $state('');
	type LocationResult = { display_name: string; lat: string; lon: string };
	let locationResults = $state<LocationResult[]>([]);
	let locationSearching = $state(false);
	let locationError = $state('');
	let locationGpsLoading = $state(false);
	let mapPickerOpen = $state(false);
	const selectedIcon = $derived(getListIcon(selectedIconId));
	const iconOptions = $derived([{ value: 'standard', label: t.list_icon_standard }, ...LIST_ICONS.map(icon => ({ value: icon.id, label: getListIconLabel(icon, currentLang()) }))]);
	const title = $derived(view === 'categories' ? t.settings_category_sorting : view === 'location' ? t.list_location : view === 'sections' ? t.checklist_sections : view === 'duplicate' ? t.checklist_duplicate : list ? t.list_edit_title : t.list_create_title);

	const listTypes = $derived([
		{ value: 'shopping', label: t.list_type_shopping }, { value: 'checklist', label: t.list_type_checklist }
	]);
	const validSections = $derived(validChecklistSections(sections));

	function selectKind(value: string) {
		if (value !== 'shopping' && value !== 'checklist') return;
		if (selectedIconId === 'supermarkt' || selectedIconId === 'checklist') selectedIconId = value === 'checklist' ? 'checklist' : 'supermarkt';
		kind = value;
	}

	async function runListAction(action: () => Promise<void>) {
		if (saving) return;
		saving = true;
		saveError = '';
		try { await action(); } catch { saveError = t.list_save_error; } finally { saving = false; }
	}

	function initialCategorySettings(listId?: string): ListCategorySettings | null {
		const settings = listId ? userSettings.getListCategorySettings(listId) : null;
		return settings ? { ...settings, order: [...settings.order] } : null;
	}

	function toggleGlobalCategories() {
		categorySettings = categorySettings ? null : {
			enabled: userSettings.categorySortEnabled,
			order: [...userSettings.categoryOrder],
			itemSortDirection: userSettings.itemSortDirection
		};
	}

	function setItemSortMode(mode: ShoppingItemSortMode) {
		if (!categorySettings || mode === itemSortMode) return;
		if (mode === 'az' || mode === 'za') categorySettings.itemSortDirection = mode;
		else {
			categorySettings.enabled = mode === 'category';
			categorySettings.itemSortDirection = null;
		}
	}

	function close() { if (!saving) onClose(); }

	async function save() {
		if (!name.trim() || saving) return;
		saving = true;
		saveError = '';
		try {
			if (list && originalNotifications !== null && notificationsEnabled !== originalNotifications) {
				const response = await fetch(`/api/lists/${list.id}/notifications`, {
					method: 'PUT', headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ enabled: notificationsEnabled })
				});
				if (!response.ok) throw new Error();
				originalNotifications = notificationsEnabled;
			}
			// Persist only fields changed in this draft; do not overwrite settings synced elsewhere.
			if (list) {
				const original = initialCategory;
				if (JSON.stringify(categorySettings) !== JSON.stringify(original)) {
					if (categorySettings) userSettings.setListCategorySettings(list.id, { ...categorySettings, order: [...categorySettings.order] });
					else userSettings.clearListCategorySettings(list.id);
				}
				if (locationDisabled !== initialLocationDisabled) userSettings.setListLocationDisabled(list.id, locationDisabled);
			}
			const checklist = { checklistSections: sections.map(section => ({ ...section, name: section.name.trim() })), defaultSectionId };
			const changed = JSON.stringify(initial.checklistSections) !== JSON.stringify(checklist.checklistSections) || initial.defaultSectionId !== defaultSectionId;
			await onSave(name.trim(), description.trim(), selectedIconId, shareAfterCreate, locationLat, locationLng, locationName,
				kind, kind === 'checklist' && list && changed ? checklist : undefined);
		} catch {
			saveError = t.list_save_error;
		} finally {
			saving = false;
		}
	}
	// Snapshot baselines independently of the mutable draft.
	// svelte-ignore state_referenced_locally
	const initialCategory = initialCategorySettings(list?.id);
	// svelte-ignore state_referenced_locally
	const initialLocationDisabled = list?.id ? userSettings.isListLocationDisabled(list.id) : false;

	$effect(() => {
		void notificationRetry;
		if (!list?.id || memberCount === 0 || untrack(() => originalNotifications) !== null) return;
		const controller = new AbortController();
		notificationsLoading = true;
		notificationsError = false;
		fetch(`/api/lists/${list.id}/notifications`, { signal: controller.signal })
			.then(async response => {
				if (!response.ok) throw new Error();
				const data = await response.json();
				if (typeof data.enabled !== 'boolean') throw new Error();
				if (!controller.signal.aborted) {
					notificationsEnabled = data.enabled;
					originalNotifications = data.enabled;
				}
			})
			.catch(() => { if (!controller.signal.aborted) notificationsError = true; })
			.finally(() => { if (!controller.signal.aborted) notificationsLoading = false; });
		return () => controller.abort();
	});

	function selectLocation(result: LocationResult) {
		onMapConfirm(Number(result.lat), Number(result.lon), result.display_name);
	}
	function onMapConfirm(lat: number, lng: number, displayName: string) {
		locationLat = lat; locationLng = lng; locationName = displayName;
		locationResults = []; locationQuery = ''; locationError = '';
	}
	function clearLocation() {
		locationLat = null; locationLng = null; locationName = null;
		locationResults = []; locationQuery = ''; locationError = '';
	}
	async function searchLocation() {
		if (!locationQuery.trim() || locationSearching) return;
		locationSearching = true; locationError = ''; locationResults = [];
		try {
			const response = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery.trim())}`);
			if (!response.ok) throw new Error();
			const data = await response.json();
			if (!Array.isArray(data) || data.length === 0) locationError = t.list_location_no_results;
			else locationResults = data.slice(0, 5);
		} catch { locationError = t.list_location_search_error; }
		finally { locationSearching = false; }
	}
	function useCurrentLocation() {
		if (!('geolocation' in navigator)) { locationError = t.list_location_unavailable; return; }
		locationGpsLoading = true; locationError = '';
		navigator.geolocation.getCurrentPosition(async ({ coords: { latitude, longitude } }) => {
			let displayName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
			try {
				const response = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
				if (response.ok) displayName = (await response.json()).display_name ?? displayName;
			} catch { /* Coordinates remain usable if reverse geocoding is unavailable. */ }
			onMapConfirm(latitude, longitude, displayName);
			locationGpsLoading = false;
		}, () => { locationError = t.list_location_denied; locationGpsLoading = false; }, { timeout: 8000, maximumAge: 30000 });
	}

	onMount(() => watchVisualViewportBottomOffset(offset => { bottomOffset = offset; }));
</script>

{#snippet iconPreview(iconId: string | null)}
	{@const icon = getListIcon(iconId)}
	{#if icon}
		<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={icon.color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{@html icon.svgContent}</svg>
	{:else}
		<span class="initial-preview" aria-hidden="true">{name[0]?.toUpperCase() || '?'}</span>
	{/if}
{/snippet}

{#if !suspended && !mapPickerOpen}
	<ManageSheetShell accent="var(--color-primary)" {title} onclose={close} bottom={`${bottomOffset}px`} maxHeight={`min(90dvh, calc(100dvh - ${bottomOffset}px))`}>
		{#snippet headerActions()}
			{#if view === 'list' && list && onDelete}
				<button type="button" class="list-header-delete" aria-label={t.list_delete} title={t.list_delete} disabled={saving} onclick={() => { if (confirm(t.confirm_delete_list)) { onDelete?.(); onClose(); } }}><Trash2 size={18} aria-hidden="true" /></button>
			{/if}
		{/snippet}
		{#snippet body()}
			<fieldset class="list-editor" disabled={saving} aria-busy={saving}>
				{#if view === 'list'}
					<div class="manage-settings-surface list-surface">
						{#if !list}
							<div class="list-flat-row">
								<SettingsSelectRow label={t.list_type} value={kind} options={listTypes} onchange={selectKind} />
							</div>
						{/if}
						<label class="manage-settings-row list-field" for={`${id}-name`}>
							<span class="manage-label">{t.list_name_label}</span>
							<input id={`${id}-name`} class="manage-settings-input" type="text" bind:value={name} placeholder={t.list_name_label} disabled={saving} />
						</label>
						<label class="manage-settings-row list-field" for={`${id}-description`}>
							<span class="manage-label">{t.list_description_label}</span>
							<input id={`${id}-description`} class="manage-settings-input" type="text" bind:value={description} placeholder={t.list_optional} disabled={saving} />
						</label>
						<div class="list-flat-row" class:checklist-icon={kind === 'checklist'}>
							<SettingsSelectRow label={t.list_icon} value={selectedIconId ?? 'standard'} options={iconOptions} onchange={value => { selectedIconId = value === 'standard' ? null : value; }}>
								{#snippet preview()}{@render iconPreview(selectedIcon?.id ?? null)}{/snippet}
								{#snippet optionPreview(value)}{@render iconPreview(value === 'standard' ? null : value)}{/snippet}
							</SettingsSelectRow>
						</div>
						{#if list && kind === 'checklist'}
							<button type="button" class="list-row" onclick={() => view = 'sections'}>
								<ListOrdered size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.checklist_sections}</span><ChevronRight size={16} aria-hidden="true" />
							</button>
						{:else if list}
							<button type="button" class="list-row" disabled={saving} onclick={() => view = 'categories'}>
								<ListOrdered size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.settings_category_sorting}</span>
								<span class="row-value" class:custom={categorySettings !== null}>{categorySettings ? t.list_sort_custom : t.list_sort_global}</span><ChevronRight size={16} aria-hidden="true" />
							</button>
						{/if}
						{#if kind === 'shopping' && userSettings.locationNavEnabled}
							<button type="button" class="list-row" disabled={saving} onclick={() => view = 'location'}>
								<MapPin size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.list_location}</span>
								<span class="row-value">{locationLat !== null ? locationName || `${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}` : t.list_location_setup}</span><ChevronRight size={16} aria-hidden="true" />
							</button>
						{/if}
						{#if list && onShare}
							<button type="button" class="list-row" disabled={saving} onclick={onShare}>
								<Users size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.list_share_members}</span>
								<span class="row-value">{memberCount > 0 ? memberCount : t.list_share_invite}</span><ChevronRight size={16} aria-hidden="true" />
							</button>
						{:else if !list}
							<div class="list-flat-row"><SettingsToggleRow label={t.list_share_after_create} checked={shareAfterCreate} onchange={() => shareAfterCreate = !shareAfterCreate} disabled={saving}>
								{#snippet icon()}<Users size={18} aria-hidden="true" />{/snippet}
							</SettingsToggleRow></div>
						{/if}
						{#if list && memberCount > 0}
							<div class="list-flat-row"><SettingsToggleRow label={t.list_notifications} checked={notificationsEnabled} onchange={() => notificationsEnabled = !notificationsEnabled} disabled={saving || notificationsLoading || originalNotifications === null}>
								{#snippet icon()}<Bell size={18} aria-hidden="true" />{/snippet}
							</SettingsToggleRow>
							{#if notificationsError}<button type="button" class="list-retry" onclick={() => notificationRetry += 1}>{t.list_notifications_retry}</button>{/if}
							</div>
						{/if}
					</div>
					{#if kind === 'checklist' && (onDuplicate || onReset)}
						<div class="manage-settings-surface list-surface checklist-actions">
							{#if onDuplicate}
								<button type="button" class="list-row" onclick={() => { duplicateName = name; duplicateId = generateClientId(); saveError = ''; view = 'duplicate'; }}>
									<Copy size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.checklist_duplicate}</span><ChevronRight size={16} aria-hidden="true" />
								</button>
							{/if}
							{#if onReset}
								<button type="button" class="list-row" onclick={() => { if (onReset && confirm(t.checklist_reset_confirm)) void runListAction(onReset); }}>
									<RotateCcw size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.checklist_reset}</span>
								</button>
							{/if}
						</div>
					{/if}
				{:else if view === 'sections'}
					<ChecklistSectionsEditor bind:sections bind:defaultSectionId />
				{:else if view === 'duplicate'}
					<div class="manage-settings-surface list-surface">
						<label class="manage-settings-row list-field"><span class="manage-label">{t.checklist_copy_name}</span>
							<input class="manage-settings-input" type="text" bind:value={duplicateName} />
						</label>
					</div>
				{:else if view === 'categories'}
					<div class="manage-settings-surface list-surface">
						<SettingsToggleRow label={t.list_sort_use_global} description={t.list_sort_global_hint} checked={categorySettings === null} onchange={toggleGlobalCategories} />
						{#if categorySettings && itemSortMode}
							<div class="list-flat-row"><ShoppingItemSortSelect value={itemSortMode} onchange={setItemSortMode} /></div>
							{#if itemSortMode === 'category'}
								<div class="list-flat-row category-editor"><CategoryOrderEditor order={categorySettings.order} onchange={order => { if (categorySettings) categorySettings.order = order; }} /></div>
							{/if}
						{:else}
							<p class="list-hint">{t.list_sort_global_hint}</p>
						{/if}
					</div>
				{:else}
					<div class="manage-settings-surface list-surface">
						{#if locationLat !== null}
							<div class="list-location-value"><MapPin size={18} aria-hidden="true" /><span>{locationName || `${locationLat.toFixed(4)}, ${locationLng?.toFixed(4)}`}</span><button type="button" aria-label={t.a11y_remove_location} onclick={clearLocation}><X size={18} aria-hidden="true" /></button></div>
						{/if}
						<form class="location-search list-flat-row" onsubmit={event => { event.preventDefault(); void searchLocation(); }}>
							<input type="search" aria-label={t.list_location_search} placeholder={t.list_location_search} bind:value={locationQuery} />
							<button type="submit" disabled={locationSearching || !locationQuery.trim()} aria-label={t.a11y_search}><Search size={18} aria-hidden="true" /></button>
						</form>
						<button type="button" class="list-row" disabled={locationGpsLoading} onclick={useCurrentLocation}><LocateFixed size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{locationGpsLoading ? t.list_location_loading : t.list_location_current}</span></button>
						<button type="button" class="list-row" onclick={() => mapPickerOpen = true}><Map size={18} aria-hidden="true" /><span class="manage-settings-label row-label">{t.map_pick_on_map}</span><ChevronRight size={16} aria-hidden="true" /></button>
						{#if locationSearching}<p class="list-hint" role="status">{t.list_location_loading}</p>{/if}
						{#if locationError}<p class="list-error" role="alert">{locationError}</p>{/if}
						{#each locationResults as result}<button type="button" class="list-row location-result" onclick={() => selectLocation(result)}><span>{result.display_name}</span></button>{/each}
						{#if list && locationLat !== null}<div class="list-flat-row"><SettingsToggleRow label={t.list_location_auto_open} checked={!locationDisabled} onchange={() => locationDisabled = !locationDisabled} /></div>{/if}
					</div>
				{/if}
				{#if saveError}<p class="list-error" role="alert">{saveError}</p>{/if}
			</fieldset>
		{/snippet}
		{#snippet footer()}
			{#if view === 'list'}
				<button type="button" class="manage-secondary list-footer-action" disabled={saving} onclick={close}>{t.list_cancel}</button>
				<button type="button" class="manage-primary list-footer-action" disabled={!name.trim() || saving || (kind === 'checklist' && !validSections)} onclick={save}>{saving ? t.list_saving : list ? t.list_save : t.create}</button>
			{:else if view === 'duplicate'}
				<button type="button" class="manage-secondary list-footer-action" disabled={saving} onclick={() => { view = 'list'; saveError = ''; }}>{t.list_cancel}</button>
				<button type="button" class="manage-primary list-footer-action" disabled={saving || !duplicateName.trim()}
					onclick={() => { if (onDuplicate) void runListAction(() => onDuplicate!(duplicateName.trim(), duplicateId)); }}>{t.checklist_duplicate}</button>
			{:else}
				<button type="button" class="manage-secondary list-footer-action list-detail-back" onclick={() => view = 'list'}><ArrowLeft size={18} aria-hidden="true" />{t.a11y_back}</button>
				<button type="button" class="manage-primary list-footer-action" disabled={view === 'sections' && !validSections} onclick={() => view = 'list'}>{t.sort_mode_done}</button>
			{/if}
		{/snippet}
	</ManageSheetShell>
{/if}

<MapPickerSheet bind:open={mapPickerOpen} initialLat={locationLat} initialLng={locationLng} initialName={locationName} onConfirm={onMapConfirm} />

<style>
	.checklist-actions { margin-top: 4px; }

	.list-editor { min-width: 0; margin: 0; padding: 0; border: 0; display: flex; flex-direction: column; gap: 4px; }
	.list-surface { border-radius: 16px; }
	.list-surface :global(.settings-select-label), .list-surface :global(.settings-toggle-label) { font-weight: 600; }
	.list-flat-row, .list-row { border-top: 1px solid var(--bubble-container-border); }
	.list-flat-row:first-child, .list-row:first-child { border-top: 0; }
	.list-field { display: block; padding: 5px 20px 3px; }
	.list-field > .manage-label { margin: 0; }
	.list-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 9px 20px; text-align: left; color: var(--color-on-surface-variant); }
	.row-label { flex: 1; color: var(--color-on-surface); }
	.row-value { min-width: 0; max-width: 43%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; font-weight: 400; line-height: 1.4; }
	.checklist-icon :global(.settings-select-value) { max-width: 64%; }
	.list-surface :global(.settings-select-value) { font-size: 14px; font-weight: 400; line-height: 1.4; }
	.row-value.custom { color: var(--color-primary); }
	.list-row :global(svg) { flex: none; }
	.list-row:active { background: var(--bubble-interactive-bg); }
	.list-row:focus-visible, .list-location-value button:focus-visible, .location-search button:focus-visible, .list-retry:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.list-row:disabled, .list-footer-action:disabled, .location-search button:disabled { opacity: 0.45; }
	.initial-preview { display: inline-flex; justify-content: center; align-items: center; width: 20px; height: 20px; font-size: 14px; font-weight: 650; }
	.list-hint { padding: 4px 20px 12px; margin: 0; color: var(--color-on-surface-variant); font-size: 12px; line-height: 1.5; }
	.category-editor { padding-top: 8px; }
	.list-header-delete { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; border-radius: 12px; color: var(--color-error); }
	.list-header-delete:active { background: color-mix(in srgb, var(--color-error) 10%, transparent); }
	.list-header-delete:focus-visible { outline: 2px solid var(--color-error); outline-offset: -3px; }
	.list-header-delete:disabled { opacity: 0.45; }
	.list-field input::placeholder { color: var(--color-on-surface-variant); opacity: 1; }
	.list-footer-action { min-height: 44px; }
	.list-detail-back { gap: 8px; }
	.list-location-value { display: flex; align-items: center; gap: 12px; padding-left: 20px; padding-right: 8px; color: var(--color-on-surface-variant); }
	.list-location-value > span { flex: 1; min-width: 0; padding: 10px 0; font-size: 14px; overflow-wrap: anywhere; color: var(--color-on-surface); }
	.list-location-value :global(svg) { flex: none; }
	.list-location-value button, .location-search button { display: flex; justify-content: center; align-items: center; width: 44px; height: 44px; flex: none; }
	.location-search { display: flex; align-items: center; padding: 3px 8px 3px 20px; color: var(--color-on-surface-variant); }
	.location-search input { width: 100%; min-width: 0; min-height: 40px; font-size: 16px; outline: none; background: transparent; color: var(--color-on-surface); }
	.location-result { color: var(--color-on-surface); font-size: 14px; line-height: 1.5; }
	.list-error { margin: 0; padding: 8px 20px; color: var(--color-error); font-size: 12px; line-height: 1.5; }
	.list-retry { width: 100%; min-height: 44px; padding: 4px 20px; color: var(--color-error); font-size: 12px; text-align: left; }
</style>
