<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import ManageSheetShell from './ManageSheetShell.svelte';

	type EditLogSheetType = {
		id: string;
		supplementName: string;
		unit: string;
		amount: number;
		time: string;
		note: string | null;
	};
	type CreateLogSheetType = { date: string };
	type SupplementOption = { id: string; name: string; unit: string; defaultAmount: number };

	let {
		sheet = $bindable<EditLogSheetType | null>(null),
		createSheet = $bindable<CreateLogSheetType | null>(null),
		supplements = [],
		onreload
	}: {
		sheet: EditLogSheetType | null;
		createSheet?: CreateLogSheetType | null;
		supplements?: SupplementOption[];
		onreload: () => void;
	} = $props();

	let saving = $state(false);

	function adjustAmount(delta: number) {
		if (!sheet) return;
		sheet.amount = Math.round(Math.max(0.5, sheet.amount + delta) * 10) / 10;
	}

	async function save() {
		if (!sheet) return;
		saving = true;
		try {
			const [hours, minutes] = sheet.time.split(':').map(Number);
			const date = new Date();
			date.setHours(hours, minutes, 0, 0);
			await fetch(`/api/supplement-logs/${sheet.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: sheet.amount, loggedAt: date.getTime(), note: sheet.note || null })
			});
			sheet = null;
			onreload();
		} finally {
			saving = false;
		}
	}

	async function del() {
		if (!sheet) return;
		const response = await fetch(`/api/supplement-logs/${sheet.id}`, { method: 'DELETE' });
		if (!response.ok) return;
		sheet = null;
		onreload();
	}

	let createSupplementId = $state('');
	let createAmount = $state(1);
	let createTime = $state('');
	let createNote = $state('');
	let createDate = $state('');
	const today = new Date().toISOString().split('T')[0];

	$effect(() => {
		if (createSheet) {
			createDate = createSheet.date;
			createSupplementId = '';
			createAmount = 1;
			createNote = '';
			const now = new Date();
			createTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
		}
	});

	const createSupplement = $derived(supplements.find((supplement) => supplement.id === createSupplementId));

	function onSupplementChange() {
		const supplement = supplements.find((entry) => entry.id === createSupplementId);
		if (supplement) createAmount = supplement.defaultAmount;
	}

	function adjustCreateAmount(delta: number) {
		createAmount = Math.round(Math.max(0.5, createAmount + delta) * 10) / 10;
	}

	async function saveCreate() {
		if (!createSupplement || !createSheet) return;
		saving = true;
		try {
			const [hours, minutes] = createTime.split(':').map(Number);
			const date = new Date(createDate + 'T00:00:00');
			date.setHours(hours, minutes, 0, 0);
			await fetch('/api/supplement-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					supplementId: createSupplement.id,
					amount: createAmount,
					loggedAt: date.getTime(),
					note: createNote.trim() || null
				})
			});
			createSheet = null;
			onreload();
		} finally {
			saving = false;
		}
	}
</script>

{#if sheet}
	{@const activeSheet = sheet}
	<ManageSheetShell
		accent="var(--color-primary)"
		title={activeSheet.supplementName}
		subtitle={t.supplement_log_edit_title}
		onclose={() => (sheet = null)}
		maxHeight="78dvh"
	>
		{#snippet body()}
			<section class="manage-section">
				<div class="grid grid-cols-2 gap-2">
					<div class="min-w-0">
						<span class="manage-label">{t.supplement_log_amount}</span>
						<div class="manage-control grid grid-cols-[38px_minmax(0,1fr)_38px] overflow-hidden">
							<button type="button" onclick={() => adjustAmount(-0.5)} class="flex items-center justify-center border-r text-lg font-semibold active:opacity-60" style="border-color: var(--bubble-container-border); color: var(--color-on-surface-variant)" aria-label={t.supplement_amount_decrease}>−</button>
							<span class="flex min-w-0 items-center justify-center truncate px-1 text-center text-base font-semibold tabular-nums" style="color: var(--color-primary)">{activeSheet.amount} {displayUnit(activeSheet.unit, currentLang())}</span>
							<button type="button" onclick={() => adjustAmount(0.5)} class="flex items-center justify-center border-l text-lg font-semibold active:opacity-60" style="border-color: var(--bubble-container-border); color: var(--color-on-surface-variant)" aria-label={t.supplement_amount_increase}>+</button>
						</div>
					</div>
					<label class="min-w-0">
						<span class="manage-label">{t.supplement_log_time}</span>
						<span class="manage-native-field">
							<span class="manage-native-value">{activeSheet.time}</span>
							<input id="edit-log-time" type="time" bind:value={activeSheet.time} class="manage-native-input manage-native-picker" />
						</span>
					</label>
				</div>

				<label class="mt-3 block">
					<span class="manage-label">{t.supplement_notes_label}</span>
					<input id="edit-log-note" type="text" bind:value={activeSheet.note} placeholder={t.supplement_log_note_placeholder} class="manage-input" />
				</label>
			</section>
		{/snippet}
		{#snippet footer()}
			<button type="button" onclick={del} class="manage-danger gap-1.5 active:opacity-70">
				<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
				{t.supplement_log_delete}
			</button>
			<button type="button" onclick={save} disabled={saving} class="manage-primary active:opacity-80 disabled:opacity-50">{saving ? '…' : t.supplement_reminders_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}

{#if createSheet}
	<ManageSheetShell accent="var(--color-primary)" title={t.supplement_log_add_title} onclose={() => (createSheet = null)} maxHeight="82dvh">
		{#snippet body()}
			<section class="manage-section">
				<label class="block">
					<span class="manage-label">{t.supplement_name_label}</span>
					<select id="create-log-supplement" bind:value={createSupplementId} onchange={onSupplementChange} class="manage-select">
						<option value="" disabled>{t.supplement_log_select_supplement}</option>
						{#each supplements as supplement}<option value={supplement.id}>{supplement.name}</option>{/each}
					</select>
				</label>

				<div class="mt-3 grid grid-cols-2 gap-2">
					<label>
						<span class="manage-label">{t.supplement_log_date}</span>
						<span class="manage-native-field">
							<input id="create-log-date" type="date" bind:value={createDate} max={today} class="manage-native-input font-semibold" />
						</span>
					</label>
					<label>
						<span class="manage-label">{t.supplement_log_time}</span>
						<span class="manage-native-field">
							<span class="manage-native-value">{createTime}</span>
							<input id="create-log-time" type="time" bind:value={createTime} class="manage-native-input manage-native-picker" />
						</span>
					</label>
				</div>

				{#if createSupplement}
					<div class="mt-3">
						<span class="manage-label">{t.supplement_log_amount}</span>
						<div class="manage-control grid grid-cols-[38px_minmax(0,1fr)_38px] overflow-hidden">
							<button type="button" onclick={() => adjustCreateAmount(-0.5)} class="flex items-center justify-center border-r text-lg font-semibold" style="border-color: var(--bubble-container-border)">−</button>
							<span class="flex min-w-0 items-center justify-center truncate px-1 text-base font-semibold">{createAmount} {displayUnit(createSupplement.unit, currentLang())}</span>
							<button type="button" onclick={() => adjustCreateAmount(0.5)} class="flex items-center justify-center border-l text-lg font-semibold" style="border-color: var(--bubble-container-border)">+</button>
						</div>
					</div>
				{/if}

				<label class="mt-3 block">
					<span class="manage-label">{t.supplement_notes_label}</span>
					<input type="text" bind:value={createNote} placeholder={t.supplement_log_note_placeholder} class="manage-input" />
				</label>
			</section>
		{/snippet}
		{#snippet footer()}
			<button type="button" onclick={() => (createSheet = null)} class="manage-secondary">{t.close}</button>
			<button type="button" onclick={saveCreate} disabled={saving || !createSupplement} class="manage-primary active:opacity-80 disabled:opacity-40">{saving ? '…' : t.supplement_reminders_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}
