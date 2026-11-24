<script lang="ts">
	import { tick, onMount, onDestroy } from 'svelte';
	import { Check, Plus, X } from '@lucide/svelte';
	import { t } from '#lib/i18n.svelte';
	import SettingsToggleRow from './SettingsToggleRow.svelte';
	import { generateClientId } from '#lib/sync/manager';
	import { CHECKLIST_NOTE_LIMIT, CHECKLIST_SECTION_LIMIT, CHECKLIST_SECTION_NAME_LIMIT, type ChecklistSectionChoice, type ChecklistSection } from '#lib/checklists';
	import { watchVisualViewportBottomOffset } from '#lib/visualViewport';
	import { getCategoryForItem, getCategoryKey, CATEGORIES } from '#lib/categories';
	import BarcodeScanner from './BarcodeScanner.svelte';
	import ItemRow from './ItemRow.svelte';
	import AddItemModal from './AddItemModal.svelte';
	import SettingsSelectRow from './SettingsSelectRow.svelte';
	import { userSettings } from '#lib/userSettings.svelte';

	let { onAdd, onClose, checklist, suggestions = [], onSearchSuggestions = null, autoOpenScanner = false, autoOpenFavorites = false, favorites = [], activeItemNames = new Set<string>(), onRemoveFavorite = null, onAddFavorite = null, onEditFavorite = null }: {
		onAdd: (name: string, quantityInfo: string, favoriteCategoryOverride?: string | null, sectionId?: string | null, choice?: ChecklistSectionChoice, checklistNote?: string | null) => Promise<void>;
		onClose: () => void;
		checklist?: { onSetDefault: (section: string | null) => Promise<void>; canManageSections: boolean; sections: ChecklistSection[]; defaultSectionId: string | null };
		suggestions?: string[];
		onSearchSuggestions?: ((query: string, signal: AbortSignal) => Promise<string[]>) | null;
		autoOpenScanner?: boolean;
		autoOpenFavorites?: boolean;
		favorites?: Array<{ name: string; quantityInfo: string | null; categoryOverride: string | null }>;
		activeItemNames?: Set<string>;
		onEditFavorite?: ((previousName: string, name: string, quantityInfo: string, categoryOverride: string | null) => Promise<void>) | null;
		onRemoveFavorite?: ((name: string) => Promise<void>) | null;
		onAddFavorite?: ((name: string, quantityInfo: string) => Promise<void>) | null;
	} = $props();

	let name = $state('');
	let quantityInfo = $state('');
	let note = $state('');
	let noteInput = $state<HTMLTextAreaElement>();
	let sectionNameInput = $state<HTMLInputElement>();
	let sectionChoice = $state<string>();
	const newSectionOption = ':new';
	let sectionName = $state('');
	let setDefault = $state(false);
	let draftSectionId = '';
	const creatingSection = $derived(sectionChoice === newSectionOption);
	const invalidSection = $derived(creatingSection && (!sectionName.trim() || checklist?.sections.some(row =>
		row.name.toLowerCase() === sectionName.trim().toLowerCase())));
	let defaultError = $state(false);
	async function chooseSection(value: string) {
		defaultError = false;
		if (value === ':default') {
			try { await checklist?.onSetDefault(sectionId || null); }
			catch { defaultError = true; }
			return;
		}
		if (creatingSection && value !== newSectionOption && document.activeElement === sectionNameInput) {
			nameInput?.focus({ preventScroll: true });
		}
		sectionName = '';
		sectionChoice = value;
		setDefault = false;
		if (value === newSectionOption) draftSectionId = generateClientId();
	}
	const sectionOptions = $derived([
		{ value: '', label: t.checklist_no_section },
		...(checklist?.sections ?? []).map(section => ({ value: section.id, label: section.name })),
		...(checklist?.canManageSections && checklist.sections.length < CHECKLIST_SECTION_LIMIT ? [{ value: newSectionOption, label: t.checklist_new_section }] : []),
		...(checklist?.canManageSections && !creatingSection && sectionChoice !== undefined && sectionChoice !== (checklist.defaultSectionId ?? '')
			? [{ value: ':default', label: t.checklist_set_default }] : [])
	]);
	const sectionId = $derived(sectionOptions.find(option => option.value === (sectionChoice ?? checklist?.defaultSectionId))?.value ?? '');
	let nameInput = $state<HTMLInputElement | undefined>(undefined);
	function isChecklistInputFocused() {
		const focused = document.activeElement;
		return focused === nameInput || focused === noteInput || focused === sectionNameInput;
	}
	let feedbackSuggestions = $state<string[] | null>(null);
	let pendingSuggestions = $state(new Set<string>());
	let confirmedSuggestions = $state(new Set<string>());
	let addError = $state(false);
	let announcement = $state('');
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	let destroyed = false;
	let remoteSuggestions = $state<string[]>([]);
	let bottomOffset = $state(0);
	let checklistViewport = $state<{ top: number; height: number; keyboardOpen: boolean } | null>(null);
	let checklistFocusTimer: ReturnType<typeof setTimeout> | undefined;
	let scannerOpen = $state(false);
	let favoritesOpen = $state(false);
	const sheetViewport = $derived(checklist && !favoritesOpen ? checklistViewport : null);
	let favoritesOpenedFromEntry = $state(false);
	let addedName = $state<string | null>(null);
	let checklistFavoriteFeedbackTimer: ReturnType<typeof setTimeout> | undefined;
	let removeTarget = $state<string | null>(null);
	let editFavorite = $state<(typeof favorites)[number] | null>(null);
	let favoriteSaving = $state(false);
	let favoriteSaveError = $state<string | null>(null);
	let favLongPressFired = false;
	const removeDialogId = $props.id();
	let addFavOpen = $state(false);
	let newFavName = $state('');
	let newFavQty = $state('');
	let favAddedFeedback = $state(false);
	let favoritesError = $state(false);
	let newFavoriteError = $state(false);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let favScrollEl: HTMLElement | null = $state(null);
	let submissionChain: Promise<void> = Promise.resolve();

	// Sort favorites by category order
	const CATEGORY_ORDER = new Map<string, number>(CATEGORIES.map((c, i) => [c.key, i]));
	const sortedFavorites = $derived(
		checklist ? favorites : [...favorites].sort((a, b) => {
			const aIdx = CATEGORY_ORDER.get(getCategoryKey(a.name, a.categoryOverride)) ?? CATEGORIES.length;
			const bIdx = CATEGORY_ORDER.get(getCategoryKey(b.name, b.categoryOverride)) ?? CATEGORIES.length;
			return aIdx - bIdx;
		})
	);

	// The shopping layout fills from the bottom. Checklist favorites start at the section selector.
	$effect(() => {
		if (favoritesOpen && !checklist) {
			tick().then(() => {
				if (favScrollEl) favScrollEl.scrollTop = favScrollEl.scrollHeight;
			});
		}
	});

	function openNewFavorite() {
		newFavName = checklist ? name.trim() : '';
		newFavQty = '';
		newFavoriteError = false;
		addFavOpen = true;
	}

	async function submitNewFavorite() {
		if (!newFavName.trim() || !onAddFavorite || favoriteSaving) return;
		const submittedName = newFavName;
		const submittedQuantity = newFavQty;
		favoriteSaving = true;
		newFavoriteError = false;
		try {
			await onAddFavorite(submittedName.trim(), submittedQuantity.trim());
			if (newFavName === submittedName && newFavQty === submittedQuantity) {
				newFavName = '';
				newFavQty = '';
			}
			favAddedFeedback = true;
			setTimeout(() => { favAddedFeedback = false; }, 1200);
		} catch {
			newFavoriteError = true;
		} finally {
			favoriteSaving = false;
		}
	}

	async function removeFavorite() {
		if (!removeTarget || !onRemoveFavorite || favoriteSaving) return;
		favoriteSaving = true;
		favoritesError = false;
		try {
			await onRemoveFavorite(removeTarget);
			editFavorite = null;
		} catch {
			favoritesError = true;
		} finally {
			removeTarget = null;
			favoriteSaving = false;
		}
	}

	function openFavoriteEditor(favoriteName: string) {
		editFavorite = favorites.find(favorite => favorite.name === favoriteName) ?? null;
		favoriteSaveError = null;
	}

	async function saveFavorite(name: string, quantityInfo: string, categoryOverride: string | null) {
		if (!editFavorite || !onEditFavorite || favoriteSaving) return;
		if (favorites.some(favorite => favorite.name !== editFavorite!.name && favorite.name.toLowerCase() === name.toLowerCase())) {
			favoriteSaveError = t.favorites_name_exists;
			return;
		}
		favoriteSaving = true;
		favoriteSaveError = null;
		try {
			await onEditFavorite(editFavorite.name, name, quantityInfo, categoryOverride);
			editFavorite = null;
		} catch {
			favoriteSaveError = t.list_save_error;
		} finally {
			favoriteSaving = false;
		}
	}

	function startLongPress(name: string) {
		endLongPress();
		favLongPressFired = false;
		pressTimer = setTimeout(() => { pressTimer = null; favLongPressFired = true; openFavoriteEditor(name); }, 500);
	}
	function endLongPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}

	async function handleFavAdd(fav: { name: string; quantityInfo: string | null; categoryOverride: string | null }) {
		if (favLongPressFired) { favLongPressFired = false; return; }
		if (editFavorite) return;
		if (checklist) {
			if (favoriteSaving) return;
			favoriteSaving = true;
			favoritesError = false;
			announcement = '';
			try {
				await enqueueItems([{ name: fav.name, quantityInfo: '' }]);
				if (destroyed) return;
				if (name.trim() === fav.name && !note) name = '';
				addedName = fav.name;
				clearTimeout(checklistFavoriteFeedbackTimer);
				checklistFavoriteFeedbackTimer = setTimeout(() => { addedName = null; }, 1000);
				announcement = `${fav.name}: ${t.item_suggestion_added}`;
			} catch {
				favoritesError = true;
			} finally {
				favoriteSaving = false;
			}
			return;
		}
		addedName = fav.name;
		await onAdd(fav.name, fav.quantityInfo ?? '', fav.categoryOverride);
		setTimeout(() => { if (addedName === fav.name) addedName = null; }, 1000);
	}

	async function returnToEntry() {
		favoritesOpen = false;
		await tick();
		nameInput?.focus({ preventScroll: true });
	}

	function updateChecklistViewport(viewport: VisualViewport) {
		const top = viewport.pageTop;
		if (checklistFocusTimer !== undefined && checklistViewport) {
			checklistViewport = { ...checklistViewport, top };
			return;
		}
		checklistViewport = {
			top,
			height: viewport.height,
			keyboardOpen: Math.round(viewport.height) < document.documentElement.clientHeight
		};
	}

	function focusChecklistField(event: MouseEvent) {
		if (event.button !== 0 || !sheetViewport?.keyboardOpen || !isChecklistInputFocused()) return;
		const field = event.currentTarget as HTMLInputElement | HTMLTextAreaElement;
		if (document.activeElement !== field) field.focus({ preventScroll: true });
	}

	function settleChecklistFocus() {
		if (!sheetViewport?.keyboardOpen) return;
		// Keep the keyboard edge stable while WebKit switches text fields, but keep compensating for page panning.
		clearTimeout(checklistFocusTimer);
		checklistFocusTimer = setTimeout(() => {
			checklistFocusTimer = undefined;
			if (window.visualViewport) updateChecklistViewport(window.visualViewport);
		}, 150);
	}

	onMount(() => {
		if (autoOpenScanner && !checklist) {
			scannerOpen = true;
		} else if (autoOpenFavorites) {
			favoritesOpen = true;
		} else {
			nameInput?.focus();
		}

		return watchVisualViewportBottomOffset((offset, viewport) => {
			bottomOffset = offset;
			if (checklist && viewport) updateChecklistViewport(viewport);
		});
	});

	const isNumeric = $derived(/^\d+$/.test(quantityInfo.trim()) || quantityInfo.trim() === '');

	function increment() {
		const n = quantityInfo.trim() === '' ? 0 : parseInt(quantityInfo.trim());
		quantityInfo = String(n + 1);
	}

	function decrement() {
		const n = parseInt(quantityInfo.trim());
		if (isNaN(n) || n <= 1) quantityInfo = '';
		else quantityInfo = String(n - 1);
	}

	// Quick capture: comma-separated multi-item input
	const UNIT_RE = /^(\d+(?:[.,]\d+)?\s*(?:x|g|kg|mg|ml|l|el|tl|stk\.?|stück|pck\.?|pkg\.?|dose|flasche|becher|tüte|bund|zehe|scheibe)?)(?:\s+)(.+)$/i;

	function parseQuickItem(token: string): { name: string; quantityInfo: string } {
		const trimmed = token.trim();
		const match = trimmed.match(UNIT_RE);
		if (match?.[2]) return { quantityInfo: match[1].trim(), name: match[2].trim() };
		return { name: trimmed, quantityInfo: '' };
	}

	const isMultiItem = $derived(!checklist && name.includes(','));
	const parsedItems = $derived(
		isMultiItem
			? name.split(',').map(t => t.trim()).filter(t => t.length > 0).map(parseQuickItem)
			: []
	);

	$effect(() => {
		const query = name.trim();
		if (!query || isMultiItem || !onSearchSuggestions) return;

		const controller = new AbortController();
		const timer = setTimeout(async () => {
			const results = await onSearchSuggestions(query, controller.signal);
			if (!controller.signal.aborted && name.trim() === query) remoteSuggestions = results;
		}, 180);

		return () => {
			clearTimeout(timer);
			controller.abort();
		};
	});

	const filtered = $derived.by(() => {
		if (isMultiItem) return [];
		const query = name.trim().toLowerCase();
		const seen = new Set<string>();
		return (query ? [...remoteSuggestions, ...suggestions] : suggestions)
			.filter((suggestion) => {
				const normalized = suggestion.trim().toLowerCase();
				if (!normalized || seen.has(normalized)) return false;
				seen.add(normalized);
				return query ? normalized.includes(query) : !activeItemNames.has(normalized) && !pendingSuggestions.has(normalized);
			})
			.sort((a, b) => {
				if (!query) return 0;
				const rank = (value: string) => value.toLowerCase() === query ? 0 : value.toLowerCase().startsWith(query) ? 1 : 2;
				return rank(a) - rank(b);
			})
			.slice(0, 5);
	});
	const displayedSuggestions = $derived(feedbackSuggestions ?? filtered);

	function clearFeedback() {
		clearTimeout(feedbackTimer);
		feedbackSuggestions = null;
		confirmedSuggestions = new Set();
	}

	function handleInput() {
		clearFeedback();
		addError = false;
	}

	onDestroy(() => {
		destroyed = true;
		endLongPress();
		clearTimeout(feedbackTimer);
		clearTimeout(checklistFavoriteFeedbackTimer);
		clearTimeout(checklistFocusTimer);
	});

	function enqueueItems(entries: Array<{ name: string; quantityInfo: string; checklistNote?: string | null }>, onCreated?: () => void) {
		if (invalidSection) return Promise.reject(new Error('Invalid section name'));
		const newSection = creatingSection ? { id: draftSectionId, name: sectionName.trim() } : undefined;
		const targetSection = checklist ? newSection?.id ?? (sectionId || null) : undefined;
		const choice = newSection || setDefault ? { newSection, setDefault } : undefined;
		const submission = submissionChain.then(async () => {
			for (const item of entries) {
				await onAdd(item.name, item.quantityInfo, undefined, targetSection, choice, item.checklistNote);
				if (newSection && creatingSection && draftSectionId === newSection.id) {
					sectionChoice = newSection.id;
					sectionName = '';
				}
				if (choice && sectionChoice === (targetSection ?? '')) setDefault = false;
				onCreated?.();
			}
		});
		// Keep the queue usable after a failure; callers handle their own feedback.
		submissionChain = submission.catch(() => {});
		return submission;
	}

	async function handleAdd() {
		if (invalidSection || !name.trim()) return;
		clearFeedback();
		addError = false;
		let completed = 0;
		const entries: Array<{ name: string; quantityInfo: string; checklistNote?: string | null }> = isMultiItem
			? parsedItems.filter((item) => item.name).map((item) => ({ ...item }))
			: [{ name: name.trim(), quantityInfo: quantityInfo.trim(), ...(checklist ? { checklistNote: note.trim() || null } : {}) }];
		name = '';
		quantityInfo = '';
		note = '';
		nameInput?.focus({ preventScroll: true });
		try {
			await enqueueItems(entries, () => completed++);
			if (!destroyed) announcement = t.item_suggestion_added;
		} catch (error) {
			console.error('Could not queue item creation:', error);
			if (destroyed) return;
			if (!name.trim()) {
				const remaining = entries.slice(completed);
				name = remaining.length === 1 ? remaining[0].name : remaining.map(item => `${item.quantityInfo} ${item.name}`.trim()).join(', ');
				quantityInfo = remaining.length === 1 ? remaining[0].quantityInfo : '';
				if (!note && remaining.length === 1) note = remaining[0].checklistNote ?? '';
			}
			addError = true;
		}
	}

	async function pickSuggestion(s: string) {
		const normalized = s.trim().toLowerCase();
		if (activeItemNames.has(normalized) || pendingSuggestions.has(normalized)) return;
		clearTimeout(feedbackTimer);
		if (!feedbackSuggestions) {
			feedbackSuggestions = [...filtered];
		}
		pendingSuggestions = new Set([...pendingSuggestions, normalized]);
		addError = false;
		announcement = '';
		const pickedQuantity = quantityInfo.trim();
		name = '';
		quantityInfo = '';
		nameInput?.focus({ preventScroll: true });
		try {
			await enqueueItems([{ name: s, quantityInfo: pickedQuantity }]);
			if (destroyed) return;
			if (feedbackSuggestions?.includes(s)) confirmedSuggestions = new Set([...confirmedSuggestions, normalized]);
			announcement = `${s}: ${t.item_suggestion_added}`;
		} catch (error) {
			console.error('Could not queue suggested item:', error);
			if (destroyed) return;
			if (!name.trim()) { name = s; quantityInfo = pickedQuantity; }
			clearFeedback();
			addError = true;
		} finally {
			pendingSuggestions = new Set([...pendingSuggestions].filter((item) => item !== normalized));
			if (!destroyed && pendingSuggestions.size === 0 && feedbackSuggestions) {
				feedbackTimer = setTimeout(clearFeedback, 650);
			}
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') { e.preventDefault(); handleAdd(); }
		if (e.key === 'Escape') onClose();
	}

	function handleBarcodeFound(productName: string) {
		void onAdd(productName, '');
		// Scanner bleibt offen für weitere Scans
	}
</script>

{#snippet sectionSelect()}
	<div class="add-item-section">
		<div class:inset-row-divider={creatingSection}><SettingsSelectRow label={t.checklist_section} value={sectionId} options={sectionOptions}
			onchange={chooseSection} keepInputFocus={isChecklistInputFocused} /></div>
		{#if defaultError}<p role="alert" class="px-4 text-sm" style="color: var(--color-error)">{t.checklist_edit_error}</p>{/if}
		{#if creatingSection}
			<div class="section-field inset-row-divider">
				<input class="w-full min-h-11 px-4 text-base font-medium bg-transparent outline-none" aria-label={t.checklist_section_name} placeholder={t.checklist_section_name}
				maxlength={CHECKLIST_SECTION_NAME_LIMIT} bind:this={sectionNameInput} bind:value={sectionName}
				onkeydown={event => { if (event.key === 'Enter') nameInput?.focus(); }} />
			</div>
			<SettingsToggleRow label={t.checklist_set_default} checked={setDefault} onchange={() => setDefault = !setDefault} />
		{/if}
	</div>
{/snippet}

<!-- Backdrop -->
<div class="fixed inset-0" style="z-index: 50; background-color: rgba(0,0,0,0.5)"></div>

<!-- Bottom sheet -->
<div class="fixed left-0 right-0 z-[60] max-w-[430px] mx-auto"
	class:checklist-viewport-sheet={sheetViewport !== null}
	style:bottom={sheetViewport ? undefined : `${bottomOffset}px`}
	style:--checklist-viewport-top={sheetViewport ? `${sheetViewport.top}px` : undefined}
	style:--checklist-viewport-height={sheetViewport ? `${sheetViewport.height}px` : undefined}>
	<div class="add-item-surface rounded-t-3xl px-4 pt-3 shadow-2xl"
	     class:checklist-entry-form={checklist && !favoritesOpen}
	     style="background-color: var(--modal-bg); --add-item-safe-area: {(sheetViewport?.keyboardOpen ?? (bottomOffset > 0)) ? '0px' : 'env(safe-area-inset-bottom, 0px)'}"
	     style:--add-keyboard-offset={`${bottomOffset}px`}>

		<!-- Handle -->
		<div class="flex justify-center mb-3">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		{#if favoritesOpen}
			<!-- Favorites follow the shopping list layout preference. -->
			<div class="fav-scroll overflow-y-auto mb-3" style="max-height: calc(80vh - 140px)" bind:this={favScrollEl}>
				{#if checklist}
					<div class="shopping-items-surface">
						<div class="inset-row-divider">{@render sectionSelect()}</div>
						{#if sortedFavorites.length === 0}
							<p class="text-sm text-center px-4 py-3" style="color: var(--color-on-surface-variant)">{t.checklist_saved_empty}</p>
						{:else}
							{#each sortedFavorites as fav, index (fav.name)}
								<div class="flex items-stretch" class:inset-row-divider={index < sortedFavorites.length - 1}>
									<button type="button" class="checklist-favorite-action flex min-w-0 flex-1 items-center justify-between gap-2 py-2 pl-4 pr-1 text-left text-sm font-semibold" aria-disabled={favoriteSaving} onclick={() => handleFavAdd(fav)}>
										<span class="break-words min-w-0">{fav.name}</span>
										{#if addedName === fav.name}
											<Check size={18} class="shrink-0" color="var(--color-primary)" aria-hidden="true" />
										{:else}
											<Plus size={18} class="shrink-0" color="var(--color-primary)" aria-hidden="true" />
										{/if}
									</button>
									<button type="button" class="checklist-favorite-action grid min-h-11 w-11 shrink-0 place-items-center" style="color: var(--color-on-surface-variant)"
										disabled={favoriteSaving} aria-label={`${t.checklist_saved_remove} · ${fav.name}`} onclick={() => removeTarget = fav.name}>
										<X size={16} aria-hidden="true" />
									</button>
								</div>
							{/each}
						{/if}
					</div>
				{:else if sortedFavorites.length === 0}
					<p class="text-sm text-center py-8" style="color: var(--color-on-surface-variant)">{t.favorites_empty}</p>
				{:else if userSettings.itemLayout === 'list'}
					<div class="shopping-items-surface">
						{#each sortedFavorites as fav, index (fav.name)}
							<div class:inset-row-divider={index < sortedFavorites.length - 1}>
								<ItemRow
									item={{ ...fav, id: fav.name }}
									onTap={() => handleFavAdd(fav)}
									onLongPress={() => openFavoriteEditor(fav.name)}
									alreadyOnList={activeItemNames.has(fav.name.toLowerCase())}
									added={addedName === fav.name}
									/>
							</div>
						{/each}
					</div>
				{:else}
					{@const gridPrefix = sortedFavorites.length % 3 === 0 ? 0 : 3 - (sortedFavorites.length % 3)}
					<div class="grid grid-cols-3 gap-2" style="direction: rtl">
						{#each { length: gridPrefix } as _}
							<div class="aspect-square"></div>
						{/each}
						{#each sortedFavorites as fav}
							{@const cat = getCategoryForItem(fav.name, fav.categoryOverride)}
							<div class="relative aspect-square" style="direction: ltr">
								<button
									type="button"
									onpointerdown={(e) => { e.preventDefault(); startLongPress(fav.name); }}
									onpointerup={endLongPress}
									onpointerleave={endLongPress}
									onpointercancel={endLongPress}
									oncontextmenu={(e) => { e.preventDefault(); openFavoriteEditor(fav.name); }}
									onclick={() => handleFavAdd(fav)}
									class="w-full h-full rounded-3xl relative overflow-hidden active:scale-95 transition-transform select-none"
									style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); touch-action: pan-y;"
								>
									{#if activeItemNames.has(fav.name.toLowerCase())}
										<span class="absolute top-3 left-3 w-2 h-2 rounded-full z-10"
										      style="background-color: var(--color-primary)" aria-hidden="true"></span>
									{/if}
									<div class="absolute inset-0 flex items-start justify-center pt-[30px] max-[374px]:pt-[22px]">
									<svg class="w-11 h-11 max-[374px]:w-9 max-[374px]:h-9" viewBox="0 0 24 24" fill="none"
									     stroke={cat.color} stroke-width="1.3"
									     stroke-linecap="round" stroke-linejoin="round" style="color: {cat.color}">
											{@html cat.svgContent}
										</svg>
									</div>
									<div class="absolute bottom-0 left-0 right-0 px-2.5 pb-2 flex flex-col items-center justify-end h-[3.6rem] max-[374px]:h-[2.6rem]">
										<span class="text-xs font-bold leading-snug line-clamp-2 max-[374px]:line-clamp-1 text-center w-full"
										      style="color: var(--color-on-surface)">{fav.name}</span>
										<span class="text-[10px] leading-tight text-center mt-0.5 truncate w-full"
										      style="color: {cat.color}; visibility: {fav.quantityInfo ? 'visible' : 'hidden'}">
											{fav.quantityInfo || '\u00a0'}
										</span>
									</div>
									{#if addedName === fav.name}
										<div class="absolute inset-0 flex items-center justify-center rounded-3xl"
										     style="background-color: color-mix(in srgb, var(--color-primary) 88%, transparent)">
											<svg width="36" height="36" viewBox="0 0 24 24" fill="none"
											     stroke="white" stroke-width="2.5"
											     stroke-linecap="round" stroke-linejoin="round">
												<polyline points="20 6 9 17 4 12"/>
											</svg>
										</div>
									{/if}
								</button>
							</div>
						{/each}
					</div>
				{/if}
			</div>
			{#if favoritesError}
				<p class="suggestion-message suggestion-error mb-2" role="alert">{t.list_save_error}</p>
			{/if}
			{#if checklist}
				<span class="sr-only" role="status" aria-live="polite">{announcement}</span>
			{/if}

			<div class="flex gap-2">
				<!-- Add Item (= neuen Favoriten hinzufügen) -->
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={openNewFavorite}
					disabled={favoriteSaving}
					class="flex-1 h-12 rounded-full flex items-center justify-center gap-1.5 text-sm font-semibold"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{t.favorites_new}
				</button>
				<!-- Close -->
				<button
					onclick={checklist && favoritesOpenedFromEntry ? returnToEntry : onClose}
					disabled={favoriteSaving}
					class="flex-1 h-12 rounded-full text-sm font-semibold"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>
					{t.close}
				</button>
			</div>

			{#if editFavorite}
				<div class="fixed inset-0 z-[65]" role="dialog" aria-modal="true" aria-label={t.favorites_edit}>
					<AddItemModal
						item={editFavorite}
						title={t.favorites_edit}
						deleteLabel={t.favorites_remove_action}
						saving={favoriteSaving}
						error={favoriteSaveError}
						onSave={saveFavorite}
						onClose={() => { if (!favoriteSaving) editFavorite = null; }}
						onDelete={() => { if (!favoriteSaving) removeTarget = editFavorite!.name; }}
					/>
				</div>
			{/if}

			<!-- Favorite removal confirmation -->
			{#if removeTarget}
				<div class="favorite-remove-overlay"
				     role="dialog" aria-modal="true" aria-labelledby={`${removeDialogId}-title`} aria-describedby={`${removeDialogId}-description`}>
					<div class="favorite-remove-dialog">
						<div class="favorite-remove-heading inset-row-divider">
							<h2 id={`${removeDialogId}-title`}>{removeTarget}</h2>
							<p id={`${removeDialogId}-description`}>{t.favorites_remove_confirm}</p>
						</div>
						<div class="favorite-remove-actions">
							<button
								type="button"
								onclick={() => removeTarget = null}
								disabled={favoriteSaving}
							>
								{t.item_cancel}
							</button>
							<button
								type="button"
								onclick={removeFavorite}
								disabled={favoriteSaving}
								class="favorite-remove-confirm"
							>
								{t.favorites_remove_action}
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Neuer-Favorit-Dialog -->
			{#if addFavOpen}
				<div class="fixed inset-0 z-[70] flex items-end justify-center pb-6 px-4"
				     style="background-color: rgba(0,0,0,0.5)"
				     role="dialog" aria-modal="true" aria-label={t.favorites_new}>
					<div class="w-full max-w-[400px] rounded-3xl shadow-2xl"
					     style="background-color: var(--color-surface-low)">
						<div class="px-5 pt-5 pb-3">
							<p class="text-base font-bold mb-4" style="color: var(--color-on-surface)">{t.favorites_new}</p>
							<div class="space-y-2">
								<!-- svelte-ignore a11y_autofocus -->
								<input
									type="text"
									placeholder={checklist ? t.checklist_entry : t.item_name_label}
									aria-label={checklist ? t.checklist_entry : t.item_name_label}
									bind:value={newFavName}
									autofocus
									autocomplete="off"
									onkeydown={(e) => { if (e.key === 'Enter') submitNewFavorite(); if (e.key === 'Escape' && !favoriteSaving) addFavOpen = false; }}
									class="w-full rounded-xl px-4 py-3 text-base font-medium outline-none"
									style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
								/>
								{#if !checklist}
									<input
										type="text"
										placeholder={t.item_quantity_placeholder}
										bind:value={newFavQty}
										autocomplete="off"
										onkeydown={(e) => { if (e.key === 'Enter') submitNewFavorite(); if (e.key === 'Escape' && !favoriteSaving) addFavOpen = false; }}
										class="w-full rounded-xl px-4 py-3 text-base outline-none"
										style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
									/>
								{/if}
							</div>
							<!-- Hinzugefügt-Feedback -->
							{#if favAddedFeedback}
								<div class="flex items-center gap-2 mt-3 px-1">
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none"
									     stroke="var(--color-primary)" stroke-width="2.5"
									     stroke-linecap="round" stroke-linejoin="round">
										<polyline points="20 6 9 17 4 12"/>
									</svg>
									<span class="text-sm font-medium" style="color: var(--color-primary)">{t.favorites_add}</span>
								</div>
							{/if}
							{#if newFavoriteError}
								<p class="suggestion-message suggestion-error mt-3" role="alert">{t.list_save_error}</p>
							{/if}
						</div>
						<div class="flex gap-2 p-3 pt-0">
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={() => addFavOpen = false}
								disabled={favoriteSaving}
								class="flex-1 py-3.5 rounded-full text-sm font-semibold"
								style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
							>{t.close}</button>
							<button
								onpointerdown={(e) => e.preventDefault()}
								onclick={submitNewFavorite}
								disabled={favoriteSaving || !newFavName.trim()}
								class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40"
								style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
							>{t.add}</button>
						</div>
					</div>
				</div>
			{/if}

		{:else}
			<!-- === Normal-Modus === -->

			<!-- Fixed workspace: changing matches never resize the focused input's fixed parent. -->
			{#if !checklist}
				<section class="suggestion-workspace" aria-label={t.item_suggestions}>
					<div class="suggestion-chips">
						{#if addError}
							<p class="suggestion-message suggestion-error" role="alert">{t.item_add_error}</p>
						{:else}
							{#each displayedSuggestions as s (s)}
								{@const normalized = s.trim().toLowerCase()}
								{@const alreadyAdded = activeItemNames.has(normalized)}
								{@const confirmed = confirmedSuggestions.has(normalized)}
								<button
									type="button"
									onpointerdown={(e) => e.preventDefault()}
									onclick={() => pickSuggestion(s)}
									aria-disabled={alreadyAdded || pendingSuggestions.has(normalized)}
									aria-label={alreadyAdded ? `${s}: ${t.item_suggestion_on_list}` : s}
									title={s}
									class="suggestion-chip"
									class:on-list={alreadyAdded && !confirmed && !pendingSuggestions.has(normalized)}
									class:confirmed
								>
									<span class="suggestion-chip-label" class:invisible={confirmed}>{s}</span>
									{#if alreadyAdded && !confirmed && !pendingSuggestions.has(normalized)}
										<svg class="suggestion-existing-check" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
									{/if}
									{#if confirmed}
										<svg class="suggestion-confirmation" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
									{/if}
								</button>
							{/each}
						{/if}
					</div>
				</section>
			{:else if addError}
				<p class="suggestion-message suggestion-error mb-2" role="alert">{t.item_add_error}</p>
			{/if}
			<span class="sr-only" role="status" aria-live="polite">{announcement}</span>

			<!-- Eingabefelder -->
			<div class="mb-3 entry-inputs">
				<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					{#if !isMultiItem}
						{#if checklist}
							{@render sectionSelect()}
						{:else}
							<div class="flex items-center gap-2 px-4" style="height: 44px">
								<input
									type="text"
									placeholder={t.item_quantity_placeholder}
									aria-label={t.item_quantity_placeholder}
									bind:value={quantityInfo}
									onkeydown={handleKeydown}
									autocomplete="off"
									class="flex-1 bg-transparent outline-none text-sm min-w-0"
									style="color: var(--color-on-surface)"
								/>
								<button
									onpointerdown={(e) => e.preventDefault()}
									onclick={decrement}
									disabled={!isNumeric || quantityInfo.trim() === ''}
									tabindex="-1"
									class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
									style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
								>−</button>
								<button
									onpointerdown={(e) => e.preventDefault()}
									onclick={increment}
									disabled={!isNumeric}
									tabindex="-1"
									class="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0 disabled:opacity-30 transition-opacity"
									style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
								>+</button>
							</div>
						{/if}
						<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
					{/if}
					<!-- svelte-ignore a11y_autofocus -->
					<input
						bind:this={nameInput}
						data-add-item-name
						aria-label={checklist ? t.checklist_entry : t.item_name_label}
						type="text"
						placeholder={checklist ? t.checklist_entry : t.item_name_placeholder}
						bind:value={name}
						onmousedown={focusChecklistField}
						onfocus={settleChecklistFocus}
						oninput={handleInput}
						onkeydown={handleKeydown}
						autofocus={!autoOpenScanner && !autoOpenFavorites}
						autocomplete="off"
						class="w-full px-4 text-base font-medium outline-none bg-transparent"
						style="color: var(--color-on-surface); height: 44px"
					/>
					{#if checklist}
						<div class="h-px mx-4" style="background-color: var(--color-outline-variant)"></div>
						<textarea class="block min-h-11 w-full resize-none bg-transparent px-4 py-2.5 text-base outline-none"
							style="color: var(--color-on-surface)" rows="2" maxlength={CHECKLIST_NOTE_LIMIT}
							aria-label={t.checklist_note} placeholder={t.checklist_note} bind:this={noteInput} bind:value={note}
							onmousedown={focusChecklistField} onfocus={settleChecklistFocus}
							onkeydown={event => { if (event.key === 'Escape') onClose(); }}></textarea>
					{/if}
				</div>

				<!-- Multi-item preview chips -->
				{#if isMultiItem && parsedItems.length > 0}
					<div class="flex gap-1.5 flex-wrap px-1 mt-2">
						{#each parsedItems as item}
							{#if item.name}
								<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
								      style="background-color: color-mix(in srgb, var(--color-primary) 13%, transparent); color: var(--color-primary)">
									{#if item.quantityInfo}<span class="font-bold">{item.quantityInfo}</span><span style="opacity:0.5">·</span>{/if}{item.name}
								</span>
							{/if}
						{/each}
					</div>
				{/if}
			</div>

			<!-- Aktionen: Icon-Buttons + Schließen + Hinzufügen -->
			<div class="flex gap-2">
				<button
					type="button"
					onpointerdown={(e) => e.preventDefault()}
					onclick={() => {
						(document.activeElement as HTMLElement)?.blur();
						favoritesError = false;
						favoritesOpenedFromEntry = true;
						favoritesOpen = true;
					}}
					class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
					aria-label={checklist ? t.checklist_saved : t.favorites_panel_toggle}
				>
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
						<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
					</svg>
				</button>
				{#if !checklist}
					<button
						type="button"
						onpointerdown={(e) => e.preventDefault()}
						onclick={() => { (document.activeElement as HTMLElement)?.blur(); scannerOpen = true; }}
						class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
						style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
						aria-label={t.barcode_scan}
					>
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:block">
							<path d="M3 9V6a2 2 0 0 1 2-2h2"/>
							<path d="M3 15v3a2 2 0 0 0 2 2h2"/>
							<path d="M21 9V6a2 2 0 0 0-2-2h-2"/>
							<path d="M21 15v3a2 2 0 0 1-2 2h-2"/>
							<line x1="10" y1="9" x2="10" y2="15"/>
							<line x1="13" y1="9" x2="13" y2="15"/>
							<line x1="16" y1="9" x2="16" y2="15"/>
						</svg>
					</button>
				{/if}
				<button
					onclick={onClose}
					class="flex-1 h-12 rounded-full text-sm font-semibold"
					style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
				>
					{t.close}
				</button>
				<button
					type="button"
					onpointerdown={event => { if (!checklist) event.preventDefault(); }}
					onmousedown={event => { if (checklist) event.preventDefault(); }}
					onclick={handleAdd}
					disabled={invalidSection || !name.trim()}
					class="h-12 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
					style="flex: 2; background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{#if isMultiItem && parsedItems.filter(i => i.name).length > 1}
						{parsedItems.filter(i => i.name).length}× {t.add}
					{:else}
						{t.add}
					{/if}
				</button>
			</div>
		{/if}
	</div>
</div>

{#if scannerOpen}
	<BarcodeScanner
		onFound={handleBarcodeFound}
		onClose={() => { scannerOpen = false; onClose(); }}
	/>
{/if}

<style>
	/* Anchor the checklist form in page coordinates so iOS focus panning cannot move it behind the keyboard. */
	.checklist-viewport-sheet {
		position: absolute;
		top: var(--checklist-viewport-top);
		height: var(--checklist-viewport-height);
		display: flex;
		align-items: end;
		pointer-events: none;
	}
	.checklist-viewport-sheet > .add-item-surface { width: 100%; pointer-events: auto; }
	.checklist-entry-form {
		display: flex;
		flex-direction: column;
		max-height: var(--checklist-viewport-height, calc(100dvh - var(--add-keyboard-offset)));
	}
	.checklist-entry-form > :not(.entry-inputs) { flex-shrink: 0; }
	.checklist-entry-form .entry-inputs { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
	.checklist-favorite-action:active { background: var(--bubble-interactive-bg); }
	.checklist-favorite-action:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }

	.add-item-section :global(.settings-select-row), .add-item-section :global(.settings-toggle-header) {
		padding-inline: 16px;
	}

	.favorite-remove-overlay {
		position: fixed;
		inset: 0;
		z-index: 70;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 16px 16px max(24px, env(safe-area-inset-bottom));
		background: rgba(0, 0, 0, 0.5);
	}
	.favorite-remove-dialog {
		width: 100%;
		max-width: 400px;
		max-height: 100%;
		overflow-y: auto;
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--radius-xl);
		background: var(--modal-bg);
	}
	.favorite-remove-heading { padding: 16px 20px 12px; }
	.favorite-remove-heading h2 { margin: 0; font-size: 16px; line-height: 22px; font-weight: 650; color: var(--color-on-surface); overflow-wrap: anywhere; }
	.favorite-remove-heading p { margin: 4px 0 0; font-size: 14px; line-height: 20px; color: var(--color-on-surface-variant); }
	.favorite-remove-actions { display: flex; justify-content: space-between; gap: 8px; padding: 4px 8px; }
	.favorite-remove-actions button { min-height: 44px; padding: 8px 12px; background: transparent; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--color-on-surface-variant); }
	.favorite-remove-actions .favorite-remove-confirm { color: var(--color-error); }
	.favorite-remove-actions button:active { background: var(--bubble-interactive-bg); }
	.favorite-remove-actions button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }

	.add-item-surface {
		padding-bottom: max(12px, var(--add-item-safe-area));
	}
	.suggestion-workspace {
		--suggestion-height: 40px;
		--suggestion-gap: 6px;
		height: calc(2 * var(--suggestion-height) + var(--suggestion-gap));
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		margin-bottom: 12px;
	}
	.suggestion-chips {
		max-height: calc(2 * var(--suggestion-height) + var(--suggestion-gap));
		min-height: var(--suggestion-height);
		flex-shrink: 0;
		display: flex;
		flex-wrap: wrap;
		align-content: flex-start;
		gap: var(--suggestion-gap);
		overflow-y: auto;
		overscroll-behavior: contain;
		scrollbar-width: none;
	}
	.suggestion-chips::-webkit-scrollbar { display: none; }
	.suggestion-chip {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: var(--suggestion-height);
		max-width: 100%;
		padding: 0 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 500;
		background: color-mix(in srgb, var(--color-primary) 15%, transparent);
		color: var(--color-primary);
		transition: background-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.suggestion-chip-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.suggestion-chip:active { background: color-mix(in srgb, var(--color-primary) 25%, transparent); }
	.suggestion-chip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -2px; }
	.suggestion-chip.on-list {
		background: var(--color-surface-high);
		color: var(--color-on-surface-variant);
		cursor: default;
	}
	.suggestion-existing-check { flex-shrink: 0; }
	.suggestion-confirmation { position: absolute; left: calc(50% - 10px); }
	.suggestion-message {
		margin: 0;
		align-self: center;
		font-size: 12px;
		color: var(--color-on-surface-variant);
	}
	.suggestion-error { color: var(--color-error); }
	@media (prefers-reduced-motion: reduce) {
		.suggestion-chip { transition: none; }
	}

	.fav-scroll {
		scrollbar-width: none;
		-ms-overflow-style: none;
	}
	.fav-scroll::-webkit-scrollbar {
		display: none;
	}
</style>
