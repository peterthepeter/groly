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
		showCancel = false,
		integrated = false
	}: {
		drinks: CaffeineDrink[];
		onlogged: () => void;
		oncancel?: (() => void) | null;
		preselectedDrink?: CaffeineDrink | null;
		logDate?: string | null;
		showCancel?: boolean;
		integrated?: boolean;
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
	const amountOptions = $derived.by(() => {
		if (!selected) return [];
		if (isEspressoDrink(selected)) {
			return Array.from({ length: 11 }, (_, index) => 10 + index * 5);
		}

		const defaultAmount = Math.round(userSettings.caffeineCustomAmounts[selected.id] ?? selected.defaultMl);
		const remainder = ((defaultAmount % 10) + 10) % 10;
		let firstAmount = remainder === 0 ? 20 : remainder;
		while (firstAmount < 15) firstAmount += 10;

		const options: number[] = [];
		for (let amount = firstAmount; amount <= 500; amount += 10) options.push(amount);
		for (const amount of [defaultAmount, amountMl, 500]) {
			if (amount > 0 && !options.includes(amount)) options.push(amount);
		}

		return options.sort((a, b) => a - b);
	});

	function isEspressoDrink(drink: CaffeineDrink) {
		return drink.id === 'cd-espresso' || drink.id === 'cd-doppelter-espresso';
	}

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
		const defaultAmount = userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl;
		amountMl = isEspressoDrink(drink)
			? Math.min(60, Math.max(10, Math.round(defaultAmount / 5) * 5))
			: defaultAmount;
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

<div class="caffeine-picker">
	<div class:integrated class="caffeine-fields">
		<div class="caffeine-drinks">
			{#each drinks as drink (drink.id)}
				<button
					type="button"
					onclick={() => selectDrink(drink)}
					class="caffeine-drink"
					class:selected={selected?.id === drink.id}
				>
					<p class="text-[13px] font-semibold leading-tight" style="color: {selected?.id === drink.id ? '#C8956C' : 'var(--color-on-surface)'}">{drink.name}</p>
					<p class="text-[11px] mt-0.5" style="color: var(--color-on-surface-variant)">{userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl} ml · {drink.caffeineMg} mg</p>
				</button>
			{/each}
		</div>
	</div>

	<div class="caffeine-actions">
			<label class:disabled={!selected} class="caffeine-native-control caffeine-amount-picker">
				<span class="caffeine-native-value">
					{#if selected}<strong>{amountMl}</strong><small>ml</small>{:else}<strong>—</strong>{/if}
				</span>
				<select bind:value={amountMl} disabled={!selected} aria-label={t.caffeine_amount_ml}>
					{#each amountOptions as amount}
						<option value={amount}>{amount} ml</option>
					{/each}
				</select>
			</label>

			<label class="caffeine-native-control caffeine-time-picker">
				<span class="caffeine-native-value"><strong>{logTime}</strong></span>
				<input type="time" bind:value={logTime} aria-label={t.supplement_log_time} />
			</label>

			<button
				type="button"
				onclick={log}
				disabled={saving || !selected || amountMl <= 0}
				class="caffeine-log-button"
				class:ready={!!selected && amountMl > 0}
			>{saving ? '…' : `${t.caffeine_add}${selected ? ` · ${scaledCaffeine} mg` : ''}`}</button>
	</div>

	{#if errorMsg}
		<p class="text-xs text-center" style="color: var(--color-error)" role="status">{errorMsg}</p>
	{/if}

	{#if showCancel}
		<button type="button" onclick={cancel} class="h-11 w-full rounded-2xl border text-sm font-semibold active:opacity-70 touch-manipulation" style="border-color: var(--bubble-container-border); background-color: transparent; color: var(--color-on-surface-variant)">{t.close}</button>
	{/if}
</div>

<style>
	.caffeine-picker {
		display: flex;
		min-height: 0;
		flex-direction: column;
		gap: 10px;
	}

	.caffeine-fields {
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: 16px;
		background: var(--bubble-container-bg);
	}

	.caffeine-fields.integrated {
		border: 0;
		border-radius: 0;
		background: transparent;
	}

	.caffeine-drinks {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		max-height: 34dvh;
		overflow-y: auto;
	}

	.caffeine-drink {
		min-height: 47px;
		padding: 7px 12px;
		text-align: left;
		touch-action: manipulation;
		transition: background-color 140ms cubic-bezier(0.2, 0, 0, 1), opacity 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	.caffeine-drink:nth-child(even) {
		border-left: 1px solid var(--bubble-container-border);
	}

	.caffeine-drink:nth-child(n + 3) {
		border-top: 1px solid var(--bubble-container-border);
	}

	.caffeine-drink.selected {
		background: color-mix(in srgb, #C8956C 11%, transparent);
	}

	.caffeine-drink:active {
		opacity: 0.7;
	}

	.caffeine-actions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: 16px;
		background: var(--color-surface-container);
	}

	.caffeine-native-control {
		position: relative;
		display: block;
		height: 48px;
		min-width: 0;
		overflow: hidden;
		cursor: pointer;
	}

	.caffeine-native-control.disabled {
		cursor: default;
		opacity: 0.42;
	}

	.caffeine-native-value {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		min-width: 0;
		pointer-events: none;
		color: #C8956C;
		font-variant-numeric: tabular-nums;
	}

	.caffeine-native-value strong {
		font-size: 16px;
		font-weight: 650;
		line-height: 1;
	}

	.caffeine-native-value small {
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 500;
		line-height: 1;
	}

	.caffeine-native-control select,
	.caffeine-native-control input {
		position: absolute;
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
		outline: 0;
		background: transparent;
		opacity: 0;
		cursor: pointer;
		font-size: 16px;
	}

	.caffeine-time-picker,
	.caffeine-log-button {
		border-left: 1px solid var(--bubble-container-border);
	}

	.caffeine-log-button {
		display: flex;
		height: 48px;
		min-width: 0;
		align-items: center;
		justify-content: center;
		background: transparent;
		color: var(--color-on-surface-variant);
		font-size: 12px;
		font-weight: 650;
		white-space: nowrap;
		touch-action: manipulation;
		transition: background-color 140ms cubic-bezier(0.2, 0, 0, 1), opacity 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	.caffeine-log-button.ready {
		background: #C8956C;
		color: white;
	}

	.caffeine-log-button:disabled {
		opacity: 0.42;
	}

	.caffeine-log-button:active:not(:disabled) {
		opacity: 0.8;
	}
</style>
