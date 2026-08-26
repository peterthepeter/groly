<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';
	import ManageSheetShell from './ManageSheetShell.svelte';

	let { open = $bindable<boolean>(false) }: { open: boolean } = $props();

	let limitInput = $state('400');
	let drinks = $state<CaffeineDrink[]>([]);
	let loading = $state(false);

	$effect(() => {
		if (open) {
			limitInput = String(userSettings.caffeineLimitMg ?? 400);
			loadDrinks();
		}
	});

	async function loadDrinks() {
		loading = true;
		try {
			const res = await fetch('/api/caffeine-drinks');
			if (res.ok) {
				const data = await res.json();
				drinks = Array.isArray(data) ? data : (data.drinks ?? []);
			}
		} catch { /* silently fail */ }
		loading = false;
	}

	function saveLimit() {
		const val = Math.max(1, Math.round(Number(limitInput)) || 400);
		userSettings.caffeineLimitMg = val;
		limitInput = String(val);
	}

	function isDrinkVisible(id: string): boolean {
		return !(userSettings.caffeineHiddenDrinks ?? []).includes(id);
	}

	function toggleDrink(id: string) {
		const hidden = userSettings.caffeineHiddenDrinks ?? [];
		userSettings.caffeineHiddenDrinks = hidden.includes(id)
			? hidden.filter(h => h !== id)
			: [...hidden, id];
	}

	function getCustomMl(drink: CaffeineDrink): number {
		return userSettings.caffeineCustomAmounts[drink.id] ?? drink.defaultMl;
	}

	function setCustomMl(drink: CaffeineDrink, raw: string) {
		const val = Math.max(10, Math.round(Number(raw)) || drink.defaultMl);
		userSettings.caffeineCustomAmounts = {
			...userSettings.caffeineCustomAmounts,
			[drink.id]: val
		};
	}
</script>

{#if open}
	<ManageSheetShell accent="#C8956C" title={t.caffeine_edit_title} onclose={() => open = false} maxHeight="85dvh">
		{#snippet body()}
			<div class="manage-stack">
				<div class="manage-section grid grid-cols-[minmax(0,1fr)_118px] items-center gap-3">
					<p class="m-0 text-sm font-semibold" style="color: var(--color-on-surface-variant)">{t.caffeine_limit_label}</p>
					<div class="grid grid-cols-[minmax(0,1fr)_22px] items-center gap-1">
						<input type="number" inputmode="numeric" min="1" bind:value={limitInput} onblur={saveLimit} onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveLimit()} class="manage-input text-center font-semibold" style="height: 36px; color: #C8956C" />
						<span class="text-xs" style="color: var(--color-on-surface-variant)">mg</span>
					</div>
				</div>

				<div class="manage-section">
					<p class="manage-section-title">{t.caffeine_visible_drinks}</p>

				{#if loading}
					<div class="flex justify-center py-4">
						<div class="w-5 h-5 rounded-full border-2 animate-spin"
						     style="border-color: #C8956C; border-top-color: transparent"></div>
					</div>
				{:else}
					<div>
						{#each drinks as drink (drink.id)}
							{@const visible = isDrinkVisible(drink.id)}
							<div class="grid min-h-11 grid-cols-[36px_minmax(0,1fr)_92px] items-center gap-2 border-b py-1 last:border-b-0" style="border-color: var(--bubble-container-border)">
								<button
									onclick={() => toggleDrink(drink.id)}
									class="manage-toggle manage-toggle-small"
									data-active={visible}
									aria-label="{drink.name} ein-/ausblenden"
								>
									<span></span>
								</button>

								<div class="min-w-0">
									<p class="truncate text-sm font-semibold leading-tight"
									   style="color: {visible ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}">
										{drink.name}
									</p>
									<p class="truncate text-[10px] leading-tight" style="color: var(--color-on-surface-variant)">
										{Math.round(drink.caffeineMg / drink.defaultMl * 100)} mg/100 ml
									</p>
								</div>

								<div class="grid grid-cols-[68px_20px] items-center gap-1">
									<input
										type="number"
										inputmode="numeric"
										min="10"
										value={getCustomMl(drink)}
										onblur={(e) => setCustomMl(drink, (e.target as HTMLInputElement).value)}
										onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && setCustomMl(drink, (e.target as HTMLInputElement).value)}
										class="manage-input text-center font-semibold"
										style="height: 34px; color: #C8956C"
										aria-label="Standard-Menge {drink.name}"
									/>
									<span class="text-[10px]" style="color: var(--color-on-surface-variant)">ml</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			</div>
		{/snippet}
		{#snippet footer()}
				<button
					onclick={() => open = false}
					class="manage-secondary active:opacity-70"
				>{t.close}</button>
				<button
					onclick={() => { saveLimit(); open = false; }}
					class="manage-primary active:opacity-80"
				>{t.supplement_reminders_save}</button>
		{/snippet}
	</ManageSheetShell>
{/if}
