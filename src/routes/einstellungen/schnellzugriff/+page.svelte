<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import ShortcutActionIcon from '#lib/components/ShortcutActionIcon.svelte';
	import ManageSheetShell from '#lib/components/supplements/ManageSheetShell.svelte';
	import { shortcuts, shortcutActionLabel, type Shortcut, type ShortcutAction } from '#lib/shortcuts.svelte';
	import { SHORTCUT_ACTIONS, MAX_SHORTCUTS, shortcutNeedsList } from '#lib/shortcutActions';
	import { flushUserSettings } from '#lib/userSettings.svelte';
	import { getOfflineLists } from '#lib/sync/manager';
	import { t } from '#lib/i18n.svelte';

	type List = { id: string; name: string };
	let lists = $state<List[]>([]);
	let listsLoading = $state(true);
	let listsError = $state(false);
	let formOpen = $state(false);
	let editingId = $state<string | null>(null);
	let draft = $state({ name: '', action: 'go' as ShortcutAction, listId: '' });
	let automaticName = $state(false);
	let dialog = $state<HTMLDivElement | null>(null);
	let returnFocus: HTMLElement | null = null;
	const formId = $props.id();
	const needsList = $derived(shortcutNeedsList(draft.action));
	const selectedList = $derived(lists.find(list => list.id === draft.listId));
	const canSave = $derived(!!draft.name.trim() && (!needsList || !!selectedList) && (!!editingId || shortcuts.list.length < MAX_SHORTCUTS));
	const listOptions = $derived([
		{ value: '', label: t.shortcut_choose_list },
		...(draft.listId && !selectedList ? [{ value: draft.listId, label: t.shortcut_list_unavailable }] : []),
		...lists.map(list => ({ value: list.id, label: list.name }))
	]);

	async function loadLists() {
		listsLoading = true;
		listsError = false;
		try {
			if (!lists.length) {
				try { lists = (await getOfflineLists()).map(list => ({ id: list.id, name: list.name })); }
				catch { /* An unavailable local cache must not prevent loading online lists. */ }
			}
			const response = await fetch('/api/lists');
			if (!response.ok) throw new Error('Lists unavailable');
			const data = await response.json();
			const available = data?.lists ?? data;
			if (!Array.isArray(available)) throw new Error('Invalid lists response');
			lists = available.map((list: List) => ({ id: list.id, name: list.name }));
		} catch { listsError = true; }
		finally { listsLoading = false; }
	}
	onMount(() => { void loadLists(); });

	$effect(() => {
		if (formOpen && !draft.listId && lists.length) draft.listId = lists[0].id;
	});
	$effect(() => {
		if (formOpen && automaticName) {
			const action = shortcutActionLabel(draft.action);
			draft.name = needsList && selectedList ? `${selectedList.name} · ${action}` : action;
		}
	});
	function openForm(shortcut: Shortcut | null = null) {
		returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		editingId = shortcut?.id ?? null;
		automaticName = !shortcut;
		draft = { name: shortcut?.name ?? '', action: shortcut?.action ?? 'go', listId: shortcut?.listId ?? lists[0]?.id ?? '' };
		formOpen = true;
		void tick().then(() => dialog?.focus({ preventScroll: true }));
	}
	function closeForm() {
		formOpen = false;
		void tick().then(() => returnFocus?.focus({ preventScroll: true }));
	}
	function save(event: SubmitEvent) {
		event.preventDefault();
		if (!canSave) return;
		const values = { name: draft.name.trim(), action: draft.action, listId: needsList ? draft.listId : undefined, listName: needsList ? selectedList?.name : undefined };
		if (editingId) shortcuts.update(editingId, values);
		else shortcuts.add({ id: typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`, ...values });
		closeForm();
		void flushUserSettings();
	}
	function remove(id: string) { shortcuts.remove(id); void flushUserSettings(); }
	function onDialogKeyDown(event: KeyboardEvent) {
		if (event.key === 'Escape') { event.preventDefault(); closeForm(); return; }
		if (event.key !== 'Tab' || !dialog) return;
		const controls = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input, a[href], [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
		if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === dialog)) { event.preventDefault(); controls.at(-1)?.focus(); }
		else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
	}
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.settings_quick_access} eyebrow={t.settings_title} onMenuOpen={() => {}} onBack={() => goto('/einstellungen#schnellzugriff')} />
	<div class="shortcuts-content flex-1 overflow-y-auto px-4">
		<h1 class="sr-only">{t.settings_quick_access}</h1>
		<div class="shortcuts-intro"><p>{t.shortcut_help}</p><span class="tabular-nums">{shortcuts.list.length} / {MAX_SHORTCUTS}</span></div>
		<div class="shortcuts-surface">
			{#if shortcuts.list.length === 0}<p class="shortcuts-empty">{t.shortcut_empty}</p>
			{:else}
				<ul>
					{#each shortcuts.list as shortcut (shortcut.id)}
						<li>
							<button type="button" class="shortcut-edit" aria-label={`${t.shortcut_edit}: ${shortcut.name}`} onclick={() => openForm(shortcut)}>
								<ShortcutActionIcon action={shortcut.action} />
								<span class="shortcut-copy"><span class="shortcut-name">{shortcut.name}</span><span class="shortcut-target">{shortcutNeedsList(shortcut.action) ? `${lists.find(list => list.id === shortcut.listId)?.name ?? shortcut.listName ?? t.shortcut_list_unavailable} · ` : ''}{shortcutActionLabel(shortcut.action)}</span></span>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m15 4 5 5M4 20l4-1L21 6a2 2 0 0 0-3-3L5 16z" /></svg>
							</button>
							<button type="button" class="shortcut-delete" aria-label={`${t.shortcut_delete}: ${shortcut.name}`} onclick={() => remove(shortcut.id)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7m4-7v7" /></svg></button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	</div>
	<div class="shortcuts-footer">
		{#if shortcuts.list.length < MAX_SHORTCUTS}<button type="button" onclick={() => openForm()}>{t.shortcut_add}</button>{:else}<p>{t.shortcut_limit}</p>{/if}
	</div>
</div>
<AppBottomNav activeTab="none" />

{#if formOpen}
	<div role="dialog" aria-modal="true" aria-label={editingId ? t.shortcut_edit : t.shortcut_add} tabindex="-1" bind:this={dialog} onkeydown={onDialogKeyDown}>
		<ManageSheetShell accent="var(--color-primary)" title={editingId ? t.shortcut_edit : t.shortcut_add} onclose={closeForm} density="comfortable" maxHeight="85dvh">
			{#snippet body()}
				<form id={formId} onsubmit={save}>
					<div class="manage-settings-surface">
						<SettingsSelectRow label={t.shortcut_action} value={draft.action} options={SHORTCUT_ACTIONS.map(action => ({ value: action, label: shortcutActionLabel(action) }))} onchange={(value) => draft.action = value as ShortcutAction} />
						{#if needsList}<SettingsSelectRow label={t.shortcut_list} value={draft.listId} options={listOptions} onchange={(value) => draft.listId = value} />{/if}
						<div class="manage-settings-row shortcut-name-row"><label for={`${formId}-name`} class="manage-settings-label">{t.shortcut_name}</label><input id={`${formId}-name`} class="manage-settings-input" bind:value={draft.name} oninput={() => automaticName = false} required autocomplete="off" /></div>
					</div>
					{#if needsList && listsLoading}<p class="shortcut-sheet-note" role="status">{t.shortcut_lists_loading}</p>
					{:else if needsList && listsError}<div class="shortcut-sheet-note"><p role="status">{t.shortcut_lists_error}</p><button class="shortcut-retry" type="button" onclick={() => void loadLists()}>{t.offline_retry}</button></div>
					{:else if needsList && !lists.length}<p class="shortcut-sheet-note">{t.shortcut_no_lists}</p>
					{:else if needsList && !selectedList}<p class="shortcut-sheet-note">{t.shortcut_list_unavailable}</p>{/if}
				</form>
			{/snippet}
			{#snippet footer()}<button type="button" class="manage-secondary" onclick={closeForm}>{t.list_cancel}</button><button type="submit" form={formId} class="manage-primary" disabled={!canSave}>{t.list_save}</button>{/snippet}
		</ManageSheetShell>
	</div>
{/if}

<style>
	.shortcuts-content { padding-top: calc(env(safe-area-inset-top) + 6rem); padding-bottom: calc(env(safe-area-inset-bottom) + 10rem); scroll-padding-top: calc(env(safe-area-inset-top) + 6rem); }
	.shortcuts-intro { display: flex; align-items: start; gap: 16px; margin: 0 6px 12px; font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); }
	.shortcuts-intro p { flex: 1; margin: 0; }
	.shortcuts-intro span { flex: none; }
	.shortcuts-surface { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.shortcuts-empty { margin: 0; padding: 16px; font-size: 14px; color: var(--color-on-surface-variant); }
	ul { margin: 0; padding: 0; list-style: none; }
	li { display: flex; align-items: center; padding-right: 8px; }
	li + li { border-top: 1px solid var(--bubble-container-border); }
	.shortcut-edit { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 0; min-height: 64px; padding: 10px 14px; text-align: left; color: var(--color-on-surface-variant); }
	.shortcut-edit :global(svg) { flex: none; }
	.shortcut-copy { flex: 1; min-width: 0; }
	.shortcut-name, .shortcut-target { display: block; overflow-wrap: anywhere; }
	.shortcut-name { font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
	.shortcut-target { margin-top: 3px; font-size: 12px; line-height: 1.4; }
	.shortcut-delete { display: flex; align-items: center; justify-content: center; width: 44px; min-height: 44px; flex: none; color: var(--color-error); }
	.shortcuts-footer { position: fixed; bottom: calc(env(safe-area-inset-bottom) + 5rem); left: 0; right: 0; max-width: 430px; margin: auto; padding: 12px 16px; background: linear-gradient(to top, var(--color-bg) 65%, transparent); }
	.shortcuts-footer button { width: 100%; min-height: 44px; border-radius: 16px; background: var(--color-primary); color: var(--color-on-primary); font-size: 14px; font-weight: 650; }
	.shortcuts-footer p { margin: 0; font-size: 12px; text-align: center; color: var(--color-on-surface-variant); }
	.manage-settings-surface :global(.settings-select-row) { min-height: 48px; border-top: 1px solid var(--bubble-container-border); }
	.manage-settings-surface :global(.settings-select-row:first-child) { border-top: 0; }
	.shortcut-name-row { display: grid; grid-template-columns: auto minmax(0, 1fr); align-items: center; gap: 12px; padding-inline: 20px; }
	.shortcut-sheet-note { margin: 10px 2px 0; font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); }
	.shortcut-sheet-note p { margin: 0; }
	.shortcut-retry { min-height: 40px; font-weight: 600; color: var(--color-primary); }
	.shortcut-edit:focus-visible, .shortcut-delete:focus-visible, .shortcuts-footer button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
</style>
