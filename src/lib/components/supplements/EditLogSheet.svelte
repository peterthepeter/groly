<script lang="ts">
	import { t } from '$lib/i18n.svelte';

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

	// ─── Edit mode ──────────────────────────────────────────────────────────────

	function adjustAmount(delta: number) {
		if (!sheet) return;
		sheet.amount = Math.round(Math.max(0.5, sheet.amount + delta) * 10) / 10;
	}

	async function save() {
		if (!sheet) return;
		saving = true;
		try {
			const [h, min] = sheet.time.split(':').map(Number);
			const d = new Date();
			d.setHours(h, min, 0, 0);
			await fetch(`/api/supplement-logs/${sheet.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: sheet.amount, loggedAt: d.getTime(), note: sheet.note || null })
			});
			sheet = null;
			onreload();
		} finally {
			saving = false;
		}
	}

	async function del() {
		if (!sheet) return;
		const res = await fetch(`/api/supplement-logs/${sheet.id}`, { method: 'DELETE' });
		if (!res.ok) return;
		sheet = null;
		onreload();
	}

	// ─── Create mode ─────────────────────────────────────────────────────────────

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

	const createSupplement = $derived(supplements.find(s => s.id === createSupplementId));

	function onSupplementChange() {
		const supp = supplements.find(s => s.id === createSupplementId);
		if (supp) createAmount = supp.defaultAmount;
	}

	function adjustCreateAmount(delta: number) {
		createAmount = Math.round(Math.max(0.5, createAmount + delta) * 10) / 10;
	}

	async function saveCreate() {
		if (!createSupplement || !createSheet) return;
		saving = true;
		try {
			const [h, min] = createTime.split(':').map(Number);
			const d = new Date(createDate + 'T00:00:00');
			d.setHours(h, min, 0, 0);
			await fetch('/api/supplement-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					supplementId: createSupplement.id,
					amount: createAmount,
					loggedAt: d.getTime(),
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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => sheet = null}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="p-6 space-y-5">
			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{t.supplement_log_edit_title} · {sheet.supplementName}
			</p>

			<!-- Amount + Time in one row -->
			<div class="flex gap-2">
				<!-- Amount -->
				<div class="flex-1">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_amount}</label>
					<div class="flex items-center gap-0 rounded-xl overflow-hidden h-10" style="background-color: var(--color-surface-container)">
						<button
							onclick={() => adjustAmount(-0.5)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity shrink-0"
							style="color: var(--color-on-surface)"
						>−</button>
						<span class="flex-1 text-center text-sm font-semibold" style="color: var(--color-on-surface)">
							{sheet.amount} {sheet.unit}
						</span>
						<button
							onclick={() => adjustAmount(0.5)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity shrink-0"
							style="color: var(--color-on-surface)"
						>+</button>
					</div>
				</div>
				<!-- Time -->
				<div class="shrink-0">
					<label for="edit-log-time" class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_time}</label>
					<input
						id="edit-log-time"
						type="time"
						bind:value={sheet.time}
						class="w-28 px-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 40px"
					/>
				</div>
			</div>

			<!-- Note -->
			<div>
				<!-- svelte-ignore a11y_label_has_associated_control -->
				<label class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_notes_label}</label>
				<input
					type="text"
					bind:value={sheet.note}
					placeholder={t.supplement_log_note_placeholder}
					class="w-full h-10 px-3 rounded-xl border-0 outline-none text-sm"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
				/>
			</div>

			<!-- Actions -->
			<div class="flex gap-2 pt-1">
				<button
					onclick={del}
					class="px-4 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-error)"
				>{t.supplement_log_delete}</button>
				<button
					onclick={save}
					disabled={saving}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>{saving ? '…' : t.supplement_reminders_save}</button>
			</div>
		</div>
	</div>
{/if}

{#if createSheet}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => createSheet = null}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="p-6 space-y-4">
			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{t.supplement_log_add_title}
			</p>

			<!-- Single card bubble -->
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-container)">

				<!-- Supplement picker row — invisible select covers full row -->
				<div class="relative px-4 h-14 flex items-center">
					<span class="text-sm truncate" style="color: {createSupplementId ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}; font-size: 16px">
						{createSupplement?.name ?? t.supplement_log_select_supplement}
					</span>
					<select
						id="create-log-supplement"
						bind:value={createSupplementId}
						onchange={onSupplementChange}
						class="absolute inset-0 w-full h-full cursor-pointer"
						style="opacity: 0; font-size: 16px"
					>
						<option value="" disabled>—</option>
						{#each supplements as supp}
							<option value={supp.id}>{supp.name}</option>
						{/each}
					</select>
				</div>

				<!-- Date + Time row -->
				<div class="flex">
					<div class="flex-1 px-4 py-3 flex flex-col gap-0.5">
						<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_log_date}</span>
						<input
							id="create-log-date"
							type="date"
							bind:value={createDate}
							max={today}
							class="border-0 outline-none text-sm font-semibold w-full"
							style="background: transparent; color: var(--color-on-surface); font-size: 16px; padding: 0"
						/>
					</div>
					<div class="px-4 py-3 flex flex-col gap-0.5">
						<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_log_time}</span>
						<input
							id="create-log-time"
							type="time"
							bind:value={createTime}
							class="border-0 outline-none text-sm font-semibold"
							style="background: transparent; color: var(--color-on-surface); font-size: 16px; padding: 0; width: 5.5rem"
						/>
					</div>
				</div>

				<!-- Amount row (only when supplement selected) -->
				{#if createSupplement}
					<div class="px-4 py-3 flex items-center justify-between">
						<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_log_amount}</span>
						<div class="flex items-center rounded-xl overflow-hidden" style="background-color: var(--color-surface-high)">
							<button
								onclick={() => adjustCreateAmount(-0.5)}
								class="w-9 h-9 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity"
								style="color: var(--color-on-surface)"
							>−</button>
							<span class="px-2 text-sm font-semibold" style="color: var(--color-on-surface)">
								{createAmount} {createSupplement.unit}
							</span>
							<button
								onclick={() => adjustCreateAmount(0.5)}
								class="w-9 h-9 flex items-center justify-center text-base font-bold active:opacity-60 transition-opacity"
								style="color: var(--color-on-surface)"
							>+</button>
						</div>
					</div>
				{/if}

				<!-- Note row -->
				<div class="px-4 py-3">
					<input
						type="text"
						bind:value={createNote}
						placeholder={t.supplement_log_note_placeholder}
						class="w-full border-0 outline-none text-sm"
						style="background: transparent; color: var(--color-on-surface); font-size: 16px; padding: 0"
					/>
				</div>
			</div>

			<!-- Save -->
			<button
				onclick={saveCreate}
				disabled={saving || !createSupplement}
				class="w-full py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>{saving ? '…' : t.supplement_reminders_save}</button>
		</div>
	</div>
{/if}
