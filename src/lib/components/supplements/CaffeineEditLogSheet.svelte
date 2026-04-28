<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	type CaffeineEditLogSheetType = {
		id: string;
		drinkName: string;
		amountMl: number;
		caffeineMg: number;
		defaultMl: number;
		defaultCaffeineMg: number;
		time: string; // "HH:MM"
	};

	let {
		sheet = $bindable<CaffeineEditLogSheetType | null>(null),
		onreload
	}: {
		sheet: CaffeineEditLogSheetType | null;
		onreload: () => void;
	} = $props();

	let saving = $state(false);

	const scaledCaffeine = $derived(
		sheet
			? Math.round(sheet.defaultCaffeineMg * sheet.amountMl / sheet.defaultMl)
			: 0
	);

	function adjustAmount(delta: number) {
		if (!sheet) return;
		sheet.amountMl = Math.max(1, sheet.amountMl + delta);
		sheet.caffeineMg = Math.round(sheet.defaultCaffeineMg * sheet.amountMl / sheet.defaultMl);
	}

	async function save() {
		if (!sheet) return;
		saving = true;
		try {
			const [h, min] = sheet.time.split(':').map(Number);
			const d = new Date();
			d.setHours(h, min, 0, 0);
			await fetch(`/api/caffeine-logs/${sheet.id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amountMl: sheet.amountMl, caffeineMg: scaledCaffeine, loggedAt: d.getTime() })
			});
			sheet = null;
			onreload();
		} finally {
			saving = false;
		}
	}

	async function del() {
		if (!sheet) return;
		const res = await fetch(`/api/caffeine-logs/${sheet.id}`, { method: 'DELETE' });
		if (!res.ok) return;
		sheet = null;
		onreload();
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
				{t.supplement_log_edit_title} · {sheet.drinkName}
			</p>

			<div class="flex gap-2">
				<!-- Amount -->
				<div class="flex-1">
					<!-- svelte-ignore a11y_label_has_associated_control -->
					<label class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_amount}</label>
					<div class="flex items-center gap-0 rounded-xl overflow-hidden h-10" style="background-color: var(--color-surface-container)">
						<button
							onclick={() => adjustAmount(-10)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 shrink-0"
							style="color: var(--color-on-surface)"
						>−</button>
						<span class="flex-1 text-center text-sm font-semibold" style="color: var(--color-on-surface)">
							{sheet.amountMl} ml
						</span>
						<button
							onclick={() => adjustAmount(10)}
							class="w-9 h-10 flex items-center justify-center text-base font-bold active:opacity-60 shrink-0"
							style="color: var(--color-on-surface)"
						>+</button>
					</div>
					<p class="text-xs mt-1 text-center" style="color: #C8956C">{scaledCaffeine} mg {t.caffeine_mg_preview}</p>
				</div>
				<!-- Time -->
				<div class="shrink-0">
					<label for="caffeine-edit-time" class="text-xs font-medium mb-1.5 block" style="color: var(--color-on-surface-variant)">{t.supplement_log_time}</label>
					<input
						id="caffeine-edit-time"
						type="time"
						bind:value={sheet.time}
						class="w-28 px-3 rounded-xl border-0 outline-none"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; height: 40px"
					/>
				</div>
			</div>

			<div class="flex gap-2 pt-1">
				<button
					onclick={del}
					class="px-4 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-error)"
				>{t.caffeine_log_delete}</button>
				<button
					onclick={save}
					disabled={saving}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
					style="background: linear-gradient(135deg, #C8956C, #A0714F); color: white"
				>{saving ? '…' : t.supplement_reminders_save}</button>
			</div>
		</div>
	</div>
{/if}
