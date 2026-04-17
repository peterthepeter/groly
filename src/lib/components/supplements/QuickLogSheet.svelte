<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import { goto } from '$app/navigation';

	type Supplement = {
		id: string; name: string; unit: string;
		active: boolean; defaultAmount: number;
		nutrients: unknown[];
	};

	let {
		open = $bindable(false),
		supplements,
		onlogged
	}: {
		open: boolean;
		supplements: Supplement[];
		onlogged: () => void;
	} = $props();

	let amounts = $state<Record<string, number>>({});
	let times = $state<Record<string, string>>({});
	let saving = $state<Record<string, boolean>>({});
	let done = $state<Record<string, boolean>>({});

	$effect(() => {
		if (open) {
			const now = new Date().toTimeString().slice(0, 5);
			const a: Record<string, number> = {};
			const ti: Record<string, string> = {};
			for (const s of supplements) { a[s.id] = s.defaultAmount ?? 1; ti[s.id] = now; }
			amounts = a;
			times = ti;
			saving = {};
			done = {};
		}
	});

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
		try {
			const res = await fetch('/api/supplement-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ supplementId, amount, loggedAt: d.getTime() })
			});
			if (res.ok) {
				done = { ...done, [supplementId]: true };
				setTimeout(() => { done = { ...done, [supplementId]: false }; }, 1500);
				onlogged();
			}
		} finally {
			saving = { ...saving, [supplementId]: false };
		}
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
			<p class="font-semibold text-base mb-4" style="color: var(--color-on-surface)">{t.supplement_log_save}</p>

			<div class="space-y-2">
				{#each supplements as s (s.id)}
					{@const isSaving = saving[s.id] ?? false}
					{@const isDone = done[s.id] ?? false}
					<div class="flex items-center gap-1.5 rounded-2xl px-2 py-2.5" style="background-color: var(--color-surface-container)">
						<!-- Name -->
						<span class="flex-1 min-w-0 truncate text-sm font-semibold" style="color: var(--color-primary)">{s.name}</span>
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
							class="w-8 h-8 rounded-lg flex items-center justify-center active:scale-95 transition-all shrink-0 disabled:opacity-80"
							style="background: {isDone ? 'var(--color-surface-high)' : 'linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))'}; color: {isDone ? 'var(--color-primary)' : 'var(--color-on-primary)'}"
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
