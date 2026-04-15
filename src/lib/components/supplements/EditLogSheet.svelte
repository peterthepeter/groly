<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	type EditLogSheetType = {
		id: string;
		supplementName: string;
		unit: string;
		amount: number;
		time: string;
	};

	let {
		sheet = $bindable<EditLogSheetType | null>(null),
		onreload
	}: {
		sheet: EditLogSheetType | null;
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
			const [h, min] = sheet.time.split(':').map(Number);
			const d = new Date();
			d.setHours(h, min, 0, 0);
			await fetch(`/api/supplement-logs/${sheet.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amount: sheet.amount, loggedAt: d.getTime() })
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
</script>

{#if sheet}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
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
					<label class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_time}</label>
					<input
						type="time"
						bind:value={sheet.time}
						class="w-28 px-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 40px"
					/>
				</div>
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
