<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { generateClientId, logCaffeineOffline } from '$lib/sync/manager';
	import type { CaffeineDrink } from '$lib/db/schema';

	let {
		drinks,
		onlogged,
		oncancel = null,
		preselectedDrink = null,
		logDate = null as string | null,
		showCancel = false
	}: {
		drinks: CaffeineDrink[];
		onlogged: () => void;
		oncancel?: (() => void) | null;
		preselectedDrink?: CaffeineDrink | null;
		logDate?: string | null;
		showCancel?: boolean;
	} = $props();

	let selected = $state<CaffeineDrink | null>(null);
	let amountMl = $state(0);
	let logTime = $state('');
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	const scaledCaffeine = $derived(
		selected && amountMl > 0
			? Math.round(selected.caffeineMg * amountMl / selected.defaultMl)
			: 0
	);

	function currentTimeString() {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	}

	function reset() {
		selected = null;
		amountMl = 0;
		logTime = currentTimeString();
		errorMsg = null;
		if (preselectedDrink) selectDrink(preselectedDrink);
	}

	onMount(reset);

	function selectDrink(drink: CaffeineDrink) {
		selected = drink;
		amountMl = userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl;
	}

	function adjustAmount(delta: number) {
		amountMl = Math.max(10, amountMl + delta);
	}

	function cancel() {
		reset();
		oncancel?.();
	}

	async function log() {
		if (!selected || amountMl <= 0 || saving) return;
		saving = true;
		errorMsg = null;
		const [hh, mm] = logTime.split(':').map(Number);
		const d = new Date((logDate ?? new Date().toISOString().slice(0, 10)) + 'T00:00:00');
		d.setHours(hh, mm, 0, 0);
		try {
			await logCaffeineOffline({
				drinkName: selected.name,
				amountMl,
				caffeineMg: scaledCaffeine,
				loggedAt: d.getTime(),
				clientLogId: generateClientId()
			});
			reset();
			onlogged();
		} catch {
			errorMsg = t.caffeine_error_offline;
			setTimeout(() => { errorMsg = null; }, 3000);
		} finally {
			saving = false;
		}
	}
</script>

<div class="flex min-h-0 flex-col gap-2.5">
	<div class="grid grid-cols-2 overflow-hidden rounded-2xl" style="background-color: var(--color-surface-container); border: 1px solid var(--bubble-container-border)">
		<div class="h-12 min-w-0 flex items-center gap-0.5 px-1">
			<button
				type="button"
				onclick={() => adjustAmount(-10)}
				disabled={!selected}
				class="h-10 w-9 shrink-0 flex items-center justify-center active:opacity-70 disabled:opacity-30 touch-manipulation"
				aria-label={t.supplement_amount_decrease}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
			</button>
			<label class="min-w-0 flex-1 flex items-center justify-center gap-1">
				<input
					type="number"
					inputmode="numeric"
					min="10"
					bind:value={amountMl}
					disabled={!selected}
					class="w-full min-w-0 h-10 text-right border-0 bg-transparent outline-none font-semibold tabular-nums disabled:opacity-30"
					style="color: #C8956C; font-size: 16px"
					aria-label={t.caffeine_amount_ml}
				/>
				<span class="text-xs shrink-0" style="color: var(--color-on-surface-variant)">ml</span>
			</label>
			<button
				type="button"
				onclick={() => adjustAmount(10)}
				disabled={!selected}
				class="h-10 w-9 shrink-0 flex items-center justify-center active:opacity-70 disabled:opacity-30 touch-manipulation"
				aria-label={t.supplement_amount_increase}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			</button>
		</div>

		<div class="h-12 min-w-0 flex items-center justify-center px-2" style="border-left: 1px solid var(--bubble-container-border)">
			<input
				type="time"
				bind:value={logTime}
				class="w-full h-10 border-0 bg-transparent outline-none text-center font-semibold"
				style="color: #C8956C; font-size: 16px; font-family: inherit"
			/>
		</div>
	</div>

	<div class="grid grid-cols-2 overflow-y-auto rounded-2xl" style="max-height: 34dvh; background-color: var(--color-surface-container); border: 1px solid var(--bubble-container-border)">
		{#each drinks as drink, index (drink.id)}
			<button
				type="button"
				onclick={() => selectDrink(drink)}
				class="min-h-[50px] px-3 py-2 text-left transition-colors active:opacity-70 touch-manipulation"
				style="background-color: {selected?.id === drink.id ? 'color-mix(in srgb, #C8956C 12%, transparent)' : 'transparent'}; box-shadow: {selected?.id === drink.id ? 'inset 0 0 0 1px #C8956C' : 'none'}; border-left: {index % 2 === 1 ? '1px solid var(--bubble-container-border)' : '0'}; border-top: {index >= 2 ? '1px solid var(--bubble-container-border)' : '0'}"
			>
				<p class="text-[13px] font-semibold leading-tight" style="color: {selected?.id === drink.id ? '#C8956C' : 'var(--color-on-surface)'}">{drink.name}</p>
				<p class="text-[11px] mt-0.5" style="color: var(--color-on-surface-variant)">{userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl} ml · {drink.caffeineMg} mg</p>
			</button>
		{/each}
	</div>

	{#if errorMsg}
		<p class="text-xs text-center" style="color: var(--color-error)" role="status">{errorMsg}</p>
	{/if}

	<div class="flex gap-2">
		{#if showCancel}
			<button type="button" onclick={cancel} class="flex-1 h-11 rounded-xl text-sm font-semibold active:opacity-70 touch-manipulation" style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">{t.close}</button>
		{/if}
		<button
			type="button"
			onclick={log}
			disabled={saving || !selected || amountMl <= 0}
			class="flex-1 h-11 rounded-xl text-sm font-semibold active:opacity-80 disabled:opacity-40 touch-manipulation"
			style="background-color: color-mix(in srgb, #C8956C 12%, transparent); border: 1px solid color-mix(in srgb, #C8956C 38%, transparent); color: #C8956C"
		>{saving ? '…' : `${t.caffeine_add}${selected ? ` · ${scaledCaffeine} mg` : ''}`}</button>
	</div>
</div>
