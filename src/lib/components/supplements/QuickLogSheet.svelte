<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import { goto } from '$app/navigation';
	import { queueOfflineLog } from '$lib/sync/manager';
	import { userSettings } from '$lib/userSettings.svelte';
	import { untrack } from 'svelte';

	type Supplement = {
		id: string; name: string; unit: string;
		brand: string | null;
		active: boolean; defaultAmount: number;
		nutrients: unknown[];
	};

	type CaffeineDrink = { id: string; name: string; defaultMl: number; caffeineMg: number; sortOrder: number };

	let {
		open = $bindable(false),
		supplements,
		onlogged,
		waterEnabled = false,
		waterGoalMl = 2500,
		waterTotalMl = 0,
		caffeineEnabled = false,
		caffeineTotalMg = 0,
		caffeineLimitMg = 400,
		caffeineDrinks = []
	}: {
		open: boolean;
		supplements: Supplement[];
		onlogged: () => void;
		waterEnabled?: boolean;
		waterGoalMl?: number;
		waterTotalMl?: number;
		caffeineEnabled?: boolean;
		caffeineTotalMg?: number;
		caffeineLimitMg?: number;
		caffeineDrinks?: CaffeineDrink[];
	} = $props();

	let amounts = $state<Record<string, number>>({});
	let times = $state<Record<string, string>>({});
	let waterSaving = $state(false);
	let waterDone = $state(false);
	let waterError = $state<string | null>(null);
	let waterShowCustom = $state(false);
	let waterCustomAmount = $state('');
	let caffeineSaving = $state<string | null>(null); // drinkId being saved
	let caffeineDone = $state<string | null>(null);   // drinkId just logged
	let saving = $state<Record<string, boolean>>({});
	let done = $state<Record<string, boolean>>({});
	let logCounts = $state<Record<string, number>>({});

	async function fetchLogCounts() {
		try {
			const res = await fetch('/api/supplement-logs/stats');
			if (res.ok) logCounts = (await res.json()).counts ?? {};
		} catch {}
	}

	$effect(() => {
		if (open && userSettings.supplementSortOrder === 'freq' && Object.keys(logCounts).length === 0) {
			fetchLogCounts();
		}
	});

	function cycleSortOrder() {
		const order: Array<'az' | 'za' | 'freq'> = ['az', 'za', 'freq'];
		const current = userSettings.supplementSortOrder ?? 'az';
		const next = order[(order.indexOf(current) + 1) % order.length];
		userSettings.supplementSortOrder = next;
		if (next === 'freq' && Object.keys(logCounts).length === 0) fetchLogCounts();
	}

	const sortedSupplements = $derived.by(() => {
		const mode = userSettings.supplementSortOrder ?? 'az';
		const arr = [...supplements];
		if (mode === 'az') return arr.sort((a, b) => a.name.localeCompare(b.name));
		if (mode === 'za') return arr.sort((a, b) => b.name.localeCompare(a.name));
		// freq: unused alphabetically at top, most-used at bottom
		return arr.sort((a, b) => {
			const ca = logCounts[a.id] ?? 0;
			const cb = logCounts[b.id] ?? 0;
			if (ca === cb) return a.name.localeCompare(b.name);
			return ca - cb;
		});
	});

	async function logCaffeine(drink: CaffeineDrink) {
		if (caffeineSaving) return;
		caffeineSaving = drink.id;
		const ml = userSettings.caffeineCustomAmounts?.[drink.id] ?? drink.defaultMl;
		const mg = Math.round(drink.caffeineMg * ml / drink.defaultMl);
		try {
			const res = await fetch('/api/caffeine-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ drinkName: drink.name, amountMl: ml, caffeineMg: mg, loggedAt: Date.now() })
			});
			if (!res.ok) throw new Error();
			caffeineDone = drink.id;
			setTimeout(() => { caffeineDone = null; }, 2500);
			onlogged();
		} catch { /* silently fail */ }
		caffeineSaving = null;
	}

	$effect(() => {
		if (open) {
			caffeineDone = null;
			caffeineSaving = null;
			// Read supplements untracked so updates to the list (e.g. after logging)
			// don't re-trigger this effect and reset done/saving mid-confirmation.
			const now = new Date().toTimeString().slice(0, 5);
			const a: Record<string, number> = {};
			const ti: Record<string, string> = {};
			untrack(() => {
				for (const s of supplements) { a[s.id] = s.defaultAmount ?? 1; ti[s.id] = now; }
			});
			amounts = a;
			times = ti;
			saving = {};
			done = {};
			waterDone = false;
			waterShowCustom = false;
			waterCustomAmount = '';
			waterError = null;
		}
	});

	async function logWater(ml: number) {
		if (waterSaving) return;
		waterSaving = true;
		waterError = null;
		try {
			const res = await fetch('/api/water-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amountMl: ml, loggedAt: Date.now() })
			});
			if (!res.ok) throw new Error();
			waterDone = true;
			setTimeout(() => { waterDone = false; }, 2500);
			onlogged();
		} catch {
			waterError = t.water_error_offline;
			setTimeout(() => { waterError = null; }, 3000);
		}
		waterSaving = false;
	}

	function submitWaterCustom() {
		const ml = Math.round(Number(waterCustomAmount));
		if (!ml || ml <= 0) return;
		logWater(ml);
		waterCustomAmount = '';
		waterShowCustom = false;
	}

	function adjustAmount(id: string, delta: number) {
		const cur = amounts[id] ?? 1;
		const next = Math.round(Math.max(0.5, cur + delta) * 10) / 10;
		amounts = { ...amounts, [id]: next };
	}

	async function logOne(supplementId: string) {
		saving = { ...saving, [supplementId]: true };
		const amount = amounts[supplementId] ?? 1;
		const time = times[supplementId] ?? new Date().toTimeString().slice(0, 5);
		const [h, min] = time.split(':').map(Number);
		const d = new Date();
		d.setHours(h, min, 0, 0);
		const loggedAt = d.getTime();

		let success = false;
		try {
			const res = await fetch('/api/supplement-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ supplementId, amount, loggedAt })
			});
			success = res.ok;
		} catch {
			// Offline — in Queue stellen und lokal cachen
			await queueOfflineLog(supplementId, amount, loggedAt);
			success = true;
		}

		if (success) {
			done = { ...done, [supplementId]: true };
			setTimeout(() => { done = { ...done, [supplementId]: false }; }, 2500);
			onlogged();
		}
		saving = { ...saving, [supplementId]: false };
	}

	function abbreviateUnit(unit: string): string {
		const translated = displayUnit(unit, currentLang());
		const map: Record<string, string> = {
			'kapsel': 'Kap', 'kapseln': 'Kap',
			'capsule': 'Cap', 'capsules': 'Cap',
			'löffel': 'Löf', 'scoop': 'Sc', 'scoops': 'Sc',
			'tablette': 'Tab', 'tabletten': 'Tab', 'tablet': 'Tab', 'tablets': 'Tab',
			'stück': 'Stk', 'piece': 'pc', 'pieces': 'pc',
			'tropfen': 'Trpf', 'drop': 'dr', 'drops': 'dr',
			'teelöffel': 'TL', 'esslöffel': 'EL',
		};
		return map[translated.toLowerCase().trim()] ?? (translated.length > 5 ? translated.slice(0, 4) : translated);
	}
</script>

<style>
@keyframes confirm-pop {
	from { opacity: 0; transform: translateX(-8px); }
	to   { opacity: 1; transform: translateX(0); }
}
.supplement-done-confirm {
	animation: confirm-pop 0.2s ease forwards;
}
</style>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => open = false}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl overflow-y-auto"
	     style="background-color: var(--color-surface-low); max-height: 85vh">
		<div class="px-5 pt-4 pb-6">
			<!-- Handle -->
			<div class="flex justify-center mb-4">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<!-- Header row: title + sort cycle button -->
			<div class="flex items-center justify-between mb-4">
				<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.supplement_log_save}</p>
				<button
					onclick={cycleSortOrder}
					aria-label={t.supplement_sort_label}
					class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl active:opacity-60 transition-opacity"
					style="background-color: var(--color-surface-container)"
				>
					<span class="text-[11px] font-medium" style="color: var(--color-on-surface-variant)">{t.supplement_sort_label}</span>
					<span class="text-[10px] font-bold" style="color: var(--color-primary)">
						{#if (userSettings.supplementSortOrder ?? 'az') === 'az'}A→Z
						{:else if userSettings.supplementSortOrder === 'za'}Z→A
						{:else}
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-primary)">
								<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
							</svg>
						{/if}
					</span>
				</button>
			</div>

			<div class="space-y-2">
				{#if caffeineEnabled && caffeineDrinks.length > 0}
					<div class="flex items-center gap-1.5 rounded-2xl px-2 py-2.5" style="background-color: var(--color-surface-container)">
						<!-- Title + subtitle (left, fixed) -->
						<div class="flex flex-col justify-center leading-none gap-[3px] shrink-0">
							<span class="text-sm font-semibold" style="color: #C8956C">{t.caffeine_title}</span>
							<span class="text-[10px]" style="color: var(--color-on-surface-variant)">{caffeineTotalMg} / {caffeineLimitMg} mg</span>
						</div>
						<!-- Scrollable drink buttons (right) -->
						<div class="flex gap-1 overflow-x-auto flex-1 min-w-0" style="-webkit-overflow-scrolling: touch; scrollbar-width: none">
							{#each caffeineDrinks as drink (drink.id)}
								{@const isThisDone = caffeineDone === drink.id}
								{@const isThisSaving = caffeineSaving === drink.id}
								<button
									onclick={() => logCaffeine(drink)}
									disabled={!!caffeineSaving}
									class="px-2 py-1 rounded-lg text-xs font-semibold active:opacity-70 disabled:opacity-50 transition-opacity shrink-0"
									style="background-color: {isThisDone ? 'color-mix(in srgb, #C8956C 20%, transparent)' : 'var(--color-surface-high)'}; color: {isThisDone ? '#C8956C' : 'var(--color-on-surface)'}; box-shadow: {isThisDone ? 'inset 0 0 0 1px #C8956C' : 'none'}"
								>
									{#if isThisSaving}…{:else if isThisDone}✓ {drink.name}{:else}{drink.name}{/if}
								</button>
							{/each}
						</div>
					</div>
				{/if}
				{#if waterEnabled}
					<div>
						<div class="flex items-center gap-1.5 rounded-2xl px-2 py-2.5" style="background-color: var(--color-surface-container)">
							<!-- Name + progress -->
							<div class="flex-1 min-w-0 flex flex-col justify-center leading-none gap-[3px]">
								{#if waterDone}
									<span class="text-sm font-semibold supplement-done-confirm" style="color: var(--color-primary)">{t.water_logged}</span>
								{:else}
									<span class="text-sm font-semibold" style="color: #60A5FA">{t.water_title}</span>
									<span class="text-[10px]" style="color: var(--color-on-surface-variant)">{waterTotalMl} / {waterGoalMl} ml</span>
								{/if}
							</div>
							<!-- Quick-add buttons -->
							{#if !waterDone}
								<div class="shrink-0 flex items-center gap-1">
									{#each (userSettings.waterPresets ?? [100, 200]).slice(0, 2) as ml}
										<button
											onclick={() => logWater(ml)}
											disabled={waterSaving}
											class="px-2 py-1 rounded-lg text-xs font-semibold active:opacity-70 disabled:opacity-50"
											style="background-color: var(--color-surface-high); color: #60A5FA"
										>+{ml}</button>
									{/each}
									<button
										onclick={() => { waterShowCustom = !waterShowCustom; waterCustomAmount = ''; }}
										disabled={waterSaving}
										class="px-2 py-1 rounded-lg text-xs font-semibold active:opacity-70 disabled:opacity-50"
										style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
									>{t.water_custom}</button>
								</div>
							{/if}
						</div>
						{#if waterShowCustom && !waterDone}
							<div class="flex gap-1.5 mt-1.5 items-center px-1">
								<input
									type="number"
									inputmode="numeric"
									min="1"
									bind:value={waterCustomAmount}
									placeholder="ml"
									class="flex-1 h-9 px-3 rounded-xl border-0 outline-none"
									style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
									onkeydown={(e) => e.key === 'Enter' && submitWaterCustom()}
								/>
								<button
									onclick={submitWaterCustom}
									disabled={waterSaving || !waterCustomAmount || Number(waterCustomAmount) <= 0}
									class="h-9 px-3 rounded-xl text-xs font-semibold disabled:opacity-40 active:opacity-70 shrink-0"
									style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
								>{t.water_add}</button>
							</div>
						{/if}
						{#if waterError}
							<p class="text-[11px] mt-1 px-1" style="color: var(--color-error)">{waterError}</p>
						{/if}
					</div>
				{/if}
				{#each sortedSupplements as s (s.id)}
					{@const isSaving = saving[s.id] ?? false}
					{@const isDone = done[s.id] ?? false}
					<div class="flex items-center gap-1.5 rounded-2xl px-2 py-2.5" style="background-color: var(--color-surface-container)">
						<!-- Name + Brand -->
						<div class="flex-1 min-w-0 flex flex-col justify-center leading-none gap-[3px]">
							{#if isDone}
								<span class="text-sm font-semibold supplement-done-confirm" style="color: var(--color-primary)">{t.supplement_taken}</span>
							{:else}
								<span class="truncate text-sm font-semibold" style="color: var(--color-primary)">{s.name}</span>
								{#if s.brand}
									<span class="truncate text-[10px]" style="color: var(--color-on-surface-variant); opacity: 0.7">{s.brand}</span>
								{/if}
							{/if}
						</div>
						<!-- Tight −/amount/+ group -->
						<div class="shrink-0 flex items-center gap-0 rounded-lg overflow-hidden" style="background-color: var(--color-surface-high)">
							<button
								onclick={() => adjustAmount(s.id, -0.5)}
								class="w-6 h-8 flex items-center justify-center text-base font-bold active:scale-95 transition-transform"
								style="color: var(--color-on-surface)"
								aria-label="Weniger"
							>−</button>
							<span class="text-xs font-semibold text-center" style="color: var(--color-on-surface); min-width: 2.8rem">
								{amounts[s.id] ?? 1} {abbreviateUnit(s.unit)}
							</span>
							<button
								onclick={() => adjustAmount(s.id, 0.5)}
								class="w-6 h-8 flex items-center justify-center text-base font-bold active:scale-95 transition-transform"
								style="color: var(--color-on-surface)"
								aria-label="Mehr"
							>+</button>
						</div>
						<!-- Time -->
						<input
							type="time"
							value={times[s.id] ?? ''}
							oninput={(e) => times = { ...times, [s.id]: (e.target as HTMLInputElement).value }}
							class="w-16 h-8 shrink-0 px-1 rounded-lg border-0 outline-none text-center"
							style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 13px; font-family: inherit"
						/>
						<!-- Log ✓ -->
						<button
							onclick={() => logOne(s.id)}
							disabled={isSaving || isDone}
							class="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all shrink-0"
							style="background: {isDone ? 'var(--color-surface-high)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))'}; color: {isDone ? 'var(--color-on-surface-variant)' : 'var(--color-on-primary)'}; opacity: {isDone ? '0.4' : '1'}"
							aria-label={t.supplement_log_save}
						>
							{#if isSaving}
								<div class="w-3.5 h-3.5 rounded-full border-2 animate-spin" style="border-color: white; border-top-color: transparent"></div>
							{:else}
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
							{/if}
						</button>
					</div>
				{/each}
			</div>

			<!-- Bottom actions -->
			<div class="flex gap-2 mt-4">
				<button
					onclick={() => open = false}
					class="flex-1 py-3.5 rounded-full text-sm font-semibold active:opacity-80 transition-opacity"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.close}</button>
				<button
					onclick={() => { open = false; goto('/supplements/verwalten'); }}
					class="flex-1 py-3.5 rounded-full text-sm font-semibold active:opacity-80 transition-opacity"
					style="background-color: var(--color-surface-container); color: var(--color-primary)"
				>{t.supplement_manage}</button>
			</div>
		</div>
	</div>
{/if}
