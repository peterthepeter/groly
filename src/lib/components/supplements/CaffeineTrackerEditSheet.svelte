<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';
	import ManageSheetShell from './ManageSheetShell.svelte';
	import SupplementActiveToggle from './SupplementActiveToggle.svelte';

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

	function selectValue(event: FocusEvent) {
		(event.currentTarget as HTMLInputElement).select();
	}
</script>

{#if open}
	<ManageSheetShell accent="#C8956C" title={t.caffeine_edit_title} onclose={() => open = false} maxHeight="85dvh">
		{#snippet body()}
			<section class="manage-settings-surface">
				<label class="manage-settings-row caffeine-limit-row">
					<span class="manage-settings-label">{t.caffeine_limit_label}</span>
					<span class="caffeine-amount-control caffeine-limit-control">
						<input
							type="text"
							inputmode="numeric"
							bind:value={limitInput}
							onfocus={selectValue}
							onblur={saveLimit}
							onkeydown={(event: KeyboardEvent) => event.key === 'Enter' && saveLimit()}
							class="caffeine-number-input"
						/>
						<span class="caffeine-unit">mg</span>
					</span>
				</label>

				<div class="caffeine-list-heading">{t.caffeine_visible_drinks}</div>

				{#if loading}
					<div class="caffeine-loading">
						<div class="w-5 h-5 rounded-full border-2 animate-spin"
						     style="border-color: #C8956C; border-top-color: transparent"></div>
					</div>
				{:else}
					{#each drinks as drink (drink.id)}
						{@const visible = isDrinkVisible(drink.id)}
						<div class="caffeine-drink-row" data-visible={visible}>
							<SupplementActiveToggle
								active={visible}
								label={`${drink.name}: ${t.caffeine_toggle_drink}`}
								accent="#C8956C"
								onclick={() => toggleDrink(drink.id)}
							/>

							<div class="caffeine-drink-copy">
								<p>{drink.name}</p>
								<small>{Math.round(drink.caffeineMg / drink.defaultMl * 100)} mg/100 ml</small>
							</div>

							<label class="caffeine-amount-control">
								<input
									type="text"
									inputmode="numeric"
									value={getCustomMl(drink)}
									onfocus={selectValue}
									onblur={(event) => setCustomMl(drink, event.currentTarget.value)}
									onkeydown={(event) => event.key === 'Enter' && setCustomMl(drink, event.currentTarget.value)}
									class="caffeine-number-input"
									aria-label={`${t.caffeine_default_amount}: ${drink.name}`}
								/>
								<span class="caffeine-unit">ml</span>
							</label>
						</div>
					{/each}
				{/if}
			</section>
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

<style>
	.caffeine-limit-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 12px;
	}

	.caffeine-list-heading {
		padding: 8px 12px 6px;
		border-top: 1px solid var(--bubble-container-border);
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 650;
		line-height: 1.2;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}

	.caffeine-loading {
		display: flex;
		min-height: 54px;
		align-items: center;
		justify-content: center;
		border-top: 1px solid var(--bubble-container-border);
	}

	.caffeine-drink-row {
		display: grid;
		grid-template-columns: 40px minmax(0, 1fr) auto;
		min-height: 52px;
		align-items: center;
		gap: 10px;
		padding: 4px 11px;
		border-top: 1px solid var(--bubble-container-border);
	}

	.caffeine-drink-row[data-visible='false'] .caffeine-drink-copy,
	.caffeine-drink-row[data-visible='false'] .caffeine-amount-control {
		opacity: 0.55;
	}

	.caffeine-drink-copy {
		min-width: 0;
		transition: opacity 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	.caffeine-drink-copy p,
	.caffeine-drink-copy small {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.caffeine-drink-copy p {
		color: var(--color-on-surface);
		font-size: 14px;
		font-weight: 650;
		line-height: 1.2;
	}

	.caffeine-drink-copy small {
		display: block;
		margin-top: 1px;
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 500;
		line-height: 1.15;
	}

	.caffeine-amount-control {
		display: grid;
		grid-template-columns: minmax(34px, 52px) 20px;
		align-items: center;
		gap: 3px;
		transition: opacity 140ms cubic-bezier(0.2, 0, 0, 1);
	}

	.caffeine-limit-control {
		grid-template-columns: minmax(42px, 62px) 22px;
	}

	.caffeine-number-input {
		width: 100%;
		min-width: 0;
		height: 40px;
		padding: 0;
		border: 0;
		outline: 0;
		background: transparent;
		color: #C8956C;
		font-size: 16px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.caffeine-unit {
		color: var(--color-on-surface-variant);
		font-size: 11px;
		font-weight: 550;
	}
</style>
