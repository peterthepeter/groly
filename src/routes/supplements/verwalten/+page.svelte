<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, beforeNavigate } from '$app/navigation';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '$lib/components/AppBottomNav.svelte';
	import { t, currentLang, reminders_deactivated_for } from '$lib/i18n.svelte';
	import { displayUnit, shortUnit } from '$lib/units';
	import { userSettings } from '$lib/userSettings.svelte';
	import SupplementEditSheet from '$lib/components/supplements/SupplementEditSheet.svelte';
	import SupplementReminderSheet from '$lib/components/supplements/SupplementReminderSheet.svelte';
	import SupplementAddToListDialog from '$lib/components/supplements/SupplementAddToListDialog.svelte';

	let { data } = $props();

	type Nutrient = { id?: string; name: string; amountPerUnit: number | string; unit: string; sortOrder: number };
	type Supplement = {
		id: string; name: string; unit: string; brand: string | null; info: string | null;
		notes: string | null; active: boolean; sortOrder: number;
		stockQuantity: number | null; defaultAmount: number;
		nutrients: Nutrient[];
	};
	type ReminderEntry = {
		id: string | null;
		days: number[];
		time: string;
		saving: boolean;
		saved: boolean;
		deleting: boolean;
	};

	let menuOpen = $state(false);
	let supplements = $state<Supplement[]>([]);
	let loading = $state(true);
	let saving = $state(false);
	let remindersDeactivatedToastName = $state<string | null>(null);
	let remindersToastTimer: ReturnType<typeof setTimeout> | null = null;

	// Edit sheet
	let editSheet = $state<{
		id: string | null; // null = new
		name: string; unit: string; brand: string; info: string; notes: string; active: boolean;
		stockQuantity: string | number; defaultAmount: string | number;
		nutrients: Nutrient[];
	} | null>(null);

	let confirmDeleteId = $state<string | null>(null);
	let reminderAfterCreate = $state(false);

	// Reminder sheet
	let reminderSheet = $state<{ supplementId: string; supplementName: string } | null>(null);
	let reminderEntries = $state<ReminderEntry[]>([]);
	let reminderLoading = $state(false);
	let supplementsWithReminders = $state<Set<string>>(new Set());

	// Add-to-list dialog
	let addToListSupplementId = $state<string | null>(null);

	beforeNavigate(({ type, cancel }) => {
		if (type === 'popstate') {
			if (confirmDeleteId) { confirmDeleteId = null; cancel(); return; }
			if (addToListSupplementId) { addToListSupplementId = null; cancel(); return; }
			if (reminderSheet) { reminderSheet = null; cancel(); return; }
			if (editSheet) { editSheet = null; cancel(); return; }
		} else {
			confirmDeleteId = null;
			addToListSupplementId = null;
			reminderSheet = null;
			editSheet = null;
		}
	});

	function getItemName(s: Supplement): string {
		return s.brand ? `${s.brand} ${s.name}` : s.name;
	}

	async function load() {
		const [suppRes, remRes] = await Promise.all([
			fetch('/api/supplements'),
			fetch('/api/supplement-reminders')
		]);
		if (suppRes.ok) {
			const data = await suppRes.json();
			supplements = data.supplements;
		}
		if (remRes.ok) {
			const data = await remRes.json();
			supplementsWithReminders = new Set(data.supplementIdsWithReminders ?? []);
		}
		loading = false;
	}

	function openNew() {
		editSheet = { id: null, name: '', unit: '', brand: '', info: '', notes: '', active: true, stockQuantity: '', defaultAmount: '1', nutrients: [{ name: '', amountPerUnit: '', unit: '', sortOrder: 0 }] };
		reminderAfterCreate = false;
	}

	function openEdit(s: Supplement) {
		editSheet = {
			id: s.id,
			name: s.name,
			unit: s.unit,
			brand: s.brand ?? '',
			info: s.info ?? '',
			notes: s.notes ?? '',
			active: s.active,
			stockQuantity: s.stockQuantity != null ? String(s.stockQuantity) : '',
			defaultAmount: String(s.defaultAmount ?? 1),
			nutrients: s.nutrients.map(n => ({ ...n, amountPerUnit: n.amountPerUnit }))
		};
	}

	function addNutrient() {
		if (!editSheet) return;
		editSheet.nutrients = [...editSheet.nutrients, { name: '', amountPerUnit: '', unit: '', sortOrder: editSheet.nutrients.length }];
	}

	function removeNutrient(index: number) {
		if (!editSheet) return;
		editSheet.nutrients = editSheet.nutrients.filter((_, i) => i !== index);
	}

	async function saveSuplement() {
		if (!editSheet) return;
		if (!editSheet.name.trim()) return;
		if (!editSheet.unit.trim()) return;

		saving = true;
		const isNew = !editSheet.id;
		const shouldOpenReminder = isNew && reminderAfterCreate;

		try {
			const body = {
				name: editSheet.name,
				unit: editSheet.unit,
				brand: editSheet.brand,
				info: editSheet.info,
				notes: editSheet.notes,
				active: editSheet.active,
				stockQuantity: editSheet.stockQuantity !== '' && editSheet.stockQuantity != null ? Number(editSheet.stockQuantity) : null,
				defaultAmount: editSheet.defaultAmount !== '' && editSheet.defaultAmount != null ? Number(editSheet.defaultAmount) : 1,
				nutrients: editSheet.nutrients
					.filter(n => n.name.trim())
					.map((n, i) => ({
						name: n.name.trim(),
						amountPerUnit: Number(n.amountPerUnit) || 0,
						unit: n.unit.trim(),
						sortOrder: i
					}))
			};

			let newSupplementId: string | null = null;

			if (editSheet.id) {
				const res = await fetch(`/api/supplements/${editSheet.id}`, {
					method: 'PUT',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (!res.ok) {
					console.error('PUT supplement failed:', await res.text());
					return;
				}
			} else {
				const res = await fetch('/api/supplements', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(body)
				});
				if (res.ok) {
					const resData = await res.json();
					newSupplementId = resData.id;
				}
			}

			editSheet = null;
			reminderAfterCreate = false;
			await load();

			if (shouldOpenReminder && newSupplementId) {
				const newSupp = supplements.find(s => s.id === newSupplementId);
				if (newSupp) openReminders(newSupp);
			}
		} finally {
			saving = false;
		}
	}

	async function toggleActive(s: Supplement) {
		const wasActive = s.active; // capture before async ops — s is a reactive proxy and changes after load()
		const res = await fetch(`/api/supplements/${s.id}`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ active: !wasActive })
		});
		await load();
		if (res.ok && wasActive) {
			// Was active → now inactive: check if reminders were deactivated
			const data = await res.json().catch(() => ({}));
			if (data.deactivatedReminders > 0) {
				remindersDeactivatedToastName = s.name;
				if (remindersToastTimer) clearTimeout(remindersToastTimer);
				remindersToastTimer = setTimeout(() => { remindersDeactivatedToastName = null; }, 5000);
			}
		}
	}

	async function deleteSupplement() {
		if (!confirmDeleteId) return;
		await fetch(`/api/supplements/${confirmDeleteId}`, { method: 'DELETE' });
		confirmDeleteId = null;
		await load();
	}

	// ─── Reminder sheet ──────────────────────────────────────────────────────────

	async function refreshReminderIndicators() {
		const res = await fetch('/api/supplement-reminders');
		if (res.ok) {
			const data = await res.json();
			supplementsWithReminders = new Set(data.supplementIdsWithReminders ?? []);
		}
	}

	async function openReminders(s: Supplement) {
		reminderSheet = { supplementId: s.id, supplementName: s.name };
		reminderLoading = true;
		reminderEntries = [];
		try {
			const res = await fetch(`/api/supplement-reminders?supplementId=${s.id}`);
			if (res.ok) {
				const d = await res.json();
				reminderEntries = d.schedules.map((sc: { id: string; days: string; time: string }) => ({
					id: sc.id,
					days: JSON.parse(sc.days),
					time: sc.time,
					saving: false,
					saved: false,
					deleting: false
				}));
			}
		} catch { /* ignore */ }
		reminderLoading = false;
	}

	const addToListItemName = $derived(() => {
		const s = supplements.find(x => x.id === addToListSupplementId);
		return s ? (s.brand ? `${s.brand} ${s.name}` : s.name) : '';
	});

	onMount(load);
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader
		title={t.supplement_manage}
		onMenuOpen={() => menuOpen = true}
	>
		{#snippet actions()}
			<button
				onclick={() => goto('/supplements')}
				class="w-9 h-9 flex items-center justify-center rounded-xl active:opacity-60 transition-opacity"
				style="background-color: var(--color-surface-high)"
				aria-label="Zurück"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="15 18 9 12 15 6"/>
				</svg>
			</button>
		{/snippet}
	</AppHeader>
	<div class="flex-shrink-0" style="height: calc(env(safe-area-inset-top) + 5.5rem)"></div>

	<!-- Reminders deactivated toast (bottom snackbar) -->
	{#if remindersDeactivatedToastName !== null}
		<div class="fixed left-4 right-4 z-50 max-w-[398px] mx-auto flex items-center gap-3 px-4 py-3.5 rounded-2xl shadow-xl"
		     style="bottom: calc(env(safe-area-inset-bottom) + 5.5rem); background-color: var(--color-surface-elevated); border: 1px solid color-mix(in srgb, var(--color-outline-variant) 60%, transparent)">
			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
				<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				<line x1="1" y1="1" x2="23" y2="23"/>
			</svg>
			<p class="text-sm font-medium flex-1" style="color: var(--color-on-surface)">{reminders_deactivated_for(remindersDeactivatedToastName)}</p>
			<button onclick={() => remindersDeactivatedToastName = null} class="flex-shrink-0 active:opacity-60" aria-label="Schließen">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		</div>
	{/if}

	<div class="flex-1 min-h-0 flex flex-col overflow-y-auto justify-end"
	     style="padding-bottom: 5rem">
	{#if loading}
		<div class="flex justify-center py-16">
			<div class="w-8 h-8 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if supplements.length === 0}
		<div class="flex flex-col items-center text-center px-4 py-16">
			<div class="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
			     style="background-color: var(--color-surface-container)">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
					<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
				</svg>
			</div>
			<p class="text-sm font-semibold mb-1" style="color: var(--color-on-surface)">{t.supplement_empty}</p>
			<p class="text-xs mb-3" style="color: var(--color-on-surface-variant)">{t.supplement_empty_hint_add}</p>
			<button
				onclick={() => goto('/einstellungen')}
				class="text-xs active:opacity-60 transition-opacity"
				style="color: var(--color-primary)"
			>{t.disable_hint_supplements}</button>
		</div>
	{:else}
		<div class="px-4 space-y-3">
			{#each supplements as supplement (supplement.id)}
				<div class="rounded-2xl p-4 flex items-center gap-3 {supplement.active ? '' : 'opacity-50'}"
				     style="background-color: var(--color-surface-card)">
					<!-- Active toggle (settings-style) -->
					<button
						onclick={() => toggleActive(supplement)}
						class="shrink-0 w-10 h-5 rounded-full relative overflow-hidden transition-colors"
						style="background-color: {supplement.active ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
						aria-label={t.supplement_active_label}
					>
						{#if supplement.active}
							<span class="absolute top-0.5 h-4 w-4 rounded-full"
							      style="background-color: white; transform: translateX(1.25rem)"></span>
						{/if}
					</button>

					<div class="flex-1 min-w-0" onclick={() => openEdit(supplement)} role="button" tabindex="0" onkeydown={(e) => e.key === 'Enter' && openEdit(supplement)}>
						<p class="font-semibold text-sm leading-snug" style="color: var(--color-on-surface)">{supplement.name}</p>
						<p class="text-xs leading-snug flex items-center gap-1 min-w-0" style="color: var(--color-on-surface-variant)">
							{#if supplement.brand}<span class="truncate min-w-0">{supplement.brand}</span>{/if}{#if supplement.stockQuantity != null}<span class="shrink-0" style="color: {supplement.stockQuantity <= 5 ? 'var(--color-error)' : 'var(--color-primary)'}">{supplement.brand ? '· ' : ''}({supplement.stockQuantity} {shortUnit(supplement.unit, currentLang())} {t.supplement_stock_left})</span>{:else if !supplement.brand}<span class="shrink-0">{shortUnit(supplement.unit, currentLang())}</span>{/if}
						</p>
					</div>

					<!-- Bell (reminder) button -->
					<button
						onclick={() => openReminders(supplement)}
						disabled={!supplement.active}
						class="shrink-0 p-1.5 rounded-xl active:opacity-60 disabled:opacity-40"
						style="color: {supplement.active && supplementsWithReminders.has(supplement.id) ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
						aria-label={t.supplement_reminders_title}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
							<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
						</svg>
					</button>

					<!-- Add to list button -->
					<button
						onclick={() => addToListSupplementId = supplement.id}
						class="shrink-0 p-1.5 rounded-xl active:opacity-60"
						style="color: var(--color-on-surface-variant)"
						aria-label={t.supplement_add_to_list}
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
							<path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
						</svg>
					</button>

					<!-- Edit button -->
					<button
						onclick={() => openEdit(supplement)}
						aria-label="Supplement bearbeiten"
						class="shrink-0 p-1.5 rounded-xl active:opacity-60"
						style="color: var(--color-on-surface-variant)"
					>
						<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
							<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
						</svg>
					</button>
				</div>
			{/each}
		</div>
	{/if}
	</div><!-- end scrollable -->
</div>

<AppBottomNav
	activeTab="supplements"
	onFabTap={openNew}
	fabLabel={t.supplement_add}
/>

<SupplementEditSheet
	bind:editSheet
	bind:saving
	bind:reminderAfterCreate
	onsave={saveSuplement}
	onclose={() => editSheet = null}
	ondeleteconfirm={(id) => confirmDeleteId = id}
	onopenreminders={(id) => { const s = supplements.find(x => x.id === id); if (s) { editSheet = null; openReminders(s); } }}
/>

<SupplementReminderSheet
	bind:reminderSheet
	bind:reminderEntries
	bind:reminderLoading
	onrefreshindicators={refreshReminderIndicators}
/>

<!-- Delete confirmation -->
{#if confirmDeleteId}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color: rgba(0,0,0,0.5)" onclick={() => confirmDeleteId = null}>
		<div class="w-full max-w-[430px] rounded-t-3xl p-6 space-y-4" style="background-color: var(--color-surface-low)" onclick={(e) => e.stopPropagation()} role="dialog" tabindex="-1">
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.supplement_confirm_delete}</p>
			<div class="flex gap-2">
				<button onclick={() => confirmDeleteId = null}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface)"
				>{t.list_cancel}</button>
				<button onclick={deleteSupplement}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold"
					style="background-color: var(--color-error); color: white"
				>{t.supplement_delete}</button>
			</div>
		</div>
	</div>
{/if}

<SupplementAddToListDialog
	bind:supplementId={addToListSupplementId}
	itemName={addToListItemName()}
/>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
