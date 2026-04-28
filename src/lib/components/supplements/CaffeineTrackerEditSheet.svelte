<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';

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
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.5)" onclick={() => open = false}></div>

	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl"
	     style="background-color: var(--color-surface-low)">
		<div class="p-6 space-y-4" style="max-height: 85dvh; overflow-y: auto">

			<div class="flex justify-center">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>

			<div class="flex items-center gap-2">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8956C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
					<path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
					<line x1="6" y1="1" x2="6" y2="4"/>
					<line x1="10" y1="1" x2="10" y2="4"/>
					<line x1="14" y1="1" x2="14" y2="4"/>
				</svg>
				<p class="font-semibold text-base" style="color: var(--color-on-surface)">{t.caffeine_edit_title}</p>
			</div>

			<!-- Daily limit -->
			<div class="rounded-2xl p-4 space-y-2" style="background-color: var(--color-surface-card)">
				<p class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{t.caffeine_limit_label}</p>
				<div class="flex items-center gap-2">
					<input
						type="number"
						inputmode="numeric"
						min="1"
						bind:value={limitInput}
						onblur={saveLimit}
						onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && saveLimit()}
						class="flex-1 h-10 px-3 rounded-xl border-0 outline-none font-semibold"
						style="background-color: var(--color-surface-container); color: #C8956C; font-size: 16px"
					/>
					<span class="text-sm shrink-0" style="color: var(--color-on-surface-variant)">mg</span>
				</div>
			</div>

			<!-- Drink list: visibility toggle + custom default ml -->
			<div class="rounded-2xl p-4" style="background-color: var(--color-surface-card)">
				<p class="text-xs font-medium mb-3" style="color: var(--color-on-surface-variant)">{t.caffeine_visible_drinks}</p>

				{#if loading}
					<div class="flex justify-center py-4">
						<div class="w-5 h-5 rounded-full border-2 animate-spin"
						     style="border-color: #C8956C; border-top-color: transparent"></div>
					</div>
				{:else}
					<div class="space-y-1">
						{#each drinks as drink (drink.id)}
							{@const visible = isDrinkVisible(drink.id)}
							<div class="flex items-center gap-2 py-2">
								<!-- Visibility toggle -->
								<button
									onclick={() => toggleDrink(drink.id)}
									class="shrink-0 w-9 h-5 rounded-full relative overflow-hidden transition-colors duration-150"
									style="background-color: {visible ? '#C8956C' : 'var(--color-surface-container)'}"
									aria-label="{drink.name} ein-/ausblenden"
								>
									<span class="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150"
									      style="transform: translateX({visible ? '1.1rem' : '0.125rem'})"></span>
								</button>

								<!-- Name + density -->
								<div class="flex-1 min-w-0">
									<p class="text-sm font-medium leading-tight truncate"
									   style="color: {visible ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}">
										{drink.name}
									</p>
									<p class="text-[11px]" style="color: var(--color-on-surface-variant)">
										{Math.round(drink.caffeineMg / drink.defaultMl * 100)} mg / 100 ml
									</p>
								</div>

								<!-- Custom ml input -->
								<div class="flex items-center gap-1 shrink-0">
									<input
										type="number"
										inputmode="numeric"
										min="10"
										value={getCustomMl(drink)}
										onblur={(e) => setCustomMl(drink, (e.target as HTMLInputElement).value)}
										onkeydown={(e: KeyboardEvent) => e.key === 'Enter' && setCustomMl(drink, (e.target as HTMLInputElement).value)}
										class="w-16 h-8 text-center rounded-lg border-0 outline-none font-semibold"
										style="background-color: var(--color-surface-container); color: #C8956C; font-size: 14px"
										aria-label="Standard-Menge {drink.name}"
									/>
									<span class="text-xs" style="color: var(--color-on-surface-variant)">ml</span>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<div class="flex gap-2">
				<button
					onclick={() => open = false}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.close}</button>
				<button
					onclick={() => { saveLimit(); open = false; }}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80"
					style="background: linear-gradient(135deg, #C8956C, #A0714F); color: white"
				>{t.supplement_reminders_save}</button>
			</div>
		</div>
	</div>
{/if}
