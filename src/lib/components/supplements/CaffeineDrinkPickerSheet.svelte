<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';

	let {
		open = $bindable<boolean>(false),
		drinks,
		onlogged,
		preselectedDrink = null
	}: {
		open: boolean;
		drinks: CaffeineDrink[];
		onlogged: () => void;
		preselectedDrink?: CaffeineDrink | null;
	} = $props();

	let selected = $state<CaffeineDrink | null>(null);
	let amountMl = $state(0);
	let logTime = $state('');
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);

	function currentTimeString() {
		const now = new Date();
		return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
	}

	$effect(() => {
		if (open) {
			logTime = currentTimeString();
			if (preselectedDrink) selectDrink(preselectedDrink);
		}
	});

	const scaledCaffeine = $derived(
		selected && amountMl > 0
			? Math.round(selected.caffeineMg * amountMl / selected.defaultMl)
			: 0
	);

	function selectDrink(drink: CaffeineDrink) {
		selected = drink;
		amountMl = userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl;
	}

	function adjustAmount(delta: number) {
		amountMl = Math.max(10, amountMl + delta);
	}

	function close() {
		open = false;
		selected = null;
		amountMl = 0;
		logTime = '';
		errorMsg = null;
	}

	async function log() {
		if (!selected || amountMl <= 0) return;
		saving = true;
		errorMsg = null;
		try {
			const res = await fetch('/api/caffeine-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					drinkName: selected.name,
					amountMl,
					caffeineMg: scaledCaffeine,
					loggedAt: (() => {
						const [hh, mm] = logTime.split(':').map(Number);
						const d = new Date();
						d.setHours(hh, mm, 0, 0);
						return d.getTime();
					})()
				})
			});
			if (!res.ok) throw new Error();
			close();
			onlogged();
		} catch {
			errorMsg = t.caffeine_error_offline;
			setTimeout(() => { errorMsg = null; }, 3000);
		}
		saving = false;
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={close}></div>

	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="px-6 pt-5 pb-5 flex flex-col gap-4">

			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.caffeine_drink_picker_title}</p>

			<!-- Amount + Time bar — always visible -->
			<div class="flex items-center gap-2 px-3 rounded-2xl" style="background-color: var(--color-surface-card); height: 3rem">
				<!-- − input + -->
				<button
					onclick={() => adjustAmount(-10)}
					disabled={!selected}
					class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:opacity-70 disabled:opacity-30"
					style="background-color: var(--color-surface-container)"
					aria-label="Weniger"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
						<line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</button>

				<input
					type="number"
					inputmode="numeric"
					min="10"
					bind:value={amountMl}
					disabled={!selected}
					class="w-12 h-8 text-center rounded-xl border-0 outline-none font-bold shrink-0 disabled:opacity-30"
					style="background-color: var(--color-surface-container); color: #C8956C; font-size: 16px"
					aria-label="Menge in ml"
				/>
				<span class="text-sm shrink-0" style="color: var(--color-on-surface-variant); opacity: {selected ? 1 : 0.3}">ml</span>

				<button
					onclick={() => adjustAmount(10)}
					disabled={!selected}
					class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 active:opacity-70 disabled:opacity-30"
					style="background-color: var(--color-surface-container)"
					aria-label="Mehr"
				>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface)" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</button>

				<!-- Divider -->
				<div class="w-px self-stretch my-2.5 shrink-0" style="background-color: var(--color-surface-high)"></div>

				<!-- Time -->
				<input
					type="time"
					bind:value={logTime}
					class="shrink-0 h-8 px-1 rounded-lg border-0 outline-none text-center font-semibold"
					style="width: 5.5rem; background-color: var(--color-surface-high); color: #C8956C; font-size: 16px; font-family: inherit"
				/>

				<!-- mg — only when drink selected -->
				{#if selected}
					<div class="shrink-0 text-right ml-auto">
						<p class="text-xs font-bold leading-tight" style="color: #C8956C">{scaledCaffeine} mg</p>
						<p class="text-[10px]" style="color: var(--color-on-surface-variant)">{t.caffeine_mg_preview}</p>
					</div>
				{/if}
			</div>

			<!-- Drink grid — scrollable -->
			<div class="grid grid-cols-2 gap-2 overflow-y-auto pr-0.5" style="max-height: 46dvh">
				{#each drinks as drink (drink.id)}
					<button
						onclick={() => selectDrink(drink)}
						class="rounded-2xl px-3 py-2.5 text-left transition-all active:opacity-70"
						style="background-color: {selected?.id === drink.id ? 'color-mix(in srgb, #C8956C 15%, transparent)' : 'var(--color-surface-container)'};
						       box-shadow: {selected?.id === drink.id ? 'inset 0 0 0 1.5px #C8956C' : 'none'}"
					>
						<p class="text-sm font-semibold leading-tight" style="color: {selected?.id === drink.id ? '#C8956C' : 'var(--color-on-surface)'}">{drink.name}</p>
						<p class="text-xs mt-0.5" style="color: var(--color-on-surface-variant)">
							{userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl} ml · {drink.caffeineMg} mg
						</p>
					</button>
				{/each}
			</div>

			{#if errorMsg}
				<p class="text-xs text-center" style="color: var(--color-error)">{errorMsg}</p>
			{/if}

			<div class="flex gap-2">
				<button
					onclick={close}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.close}</button>
				<button
					onclick={log}
					disabled={saving || !selected || amountMl <= 0}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40"
					style="background: linear-gradient(135deg, #C8956C, #A0714F); color: white"
				>{saving ? '…' : t.caffeine_add}</button>
			</div>
		</div>
	</div>
{/if}
