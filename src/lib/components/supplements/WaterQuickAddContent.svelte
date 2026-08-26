<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	let {
		presets,
		onadd,
		saving = false
	}: {
		presets: number[];
		onadd: (amountMl: number) => void | Promise<void>;
		saving?: boolean;
	} = $props();

	let customOpen = $state(false);
	let customAmount = $state('');

	function toggleCustom() {
		customOpen = !customOpen;
		customAmount = '';
	}

	function submitCustom() {
		const amountMl = Math.round(Number(customAmount));
		if (!amountMl || amountMl <= 0) return;
		void onadd(amountMl);
		customOpen = false;
		customAmount = '';
	}
</script>

<div class="flex flex-col gap-3">
	<div
		class="grid overflow-hidden rounded-2xl"
		style="grid-template-columns: repeat({presets.slice(0, 2).length + 1}, minmax(0, 1fr)); background-color: var(--color-surface-container); border: 1px solid var(--bubble-container-border)"
	>
		{#each presets.slice(0, 2) as amountMl, index}
			<button
				type="button"
				onclick={() => onadd(amountMl)}
				disabled={saving}
				class="h-12 min-w-0 flex flex-col items-center justify-center font-semibold active:opacity-60 disabled:opacity-40 touch-manipulation"
				style="color: #60A5FA; border-left: {index > 0 ? '1px solid var(--bubble-container-border)' : '0'}"
			>
				<span class="text-base leading-none">+{amountMl}</span>
				<span class="mt-1 text-[10px] font-medium" style="color: var(--color-on-surface-variant)">ml</span>
			</button>
		{/each}
		<button
			type="button"
			onclick={toggleCustom}
			disabled={saving}
			class="h-12 min-w-0 flex flex-col items-center justify-center text-xs font-semibold active:opacity-60 disabled:opacity-40 touch-manipulation"
			style="background-color: {customOpen ? 'rgba(96,165,250,0.08)' : 'transparent'}; color: {customOpen ? '#60A5FA' : 'var(--color-on-surface-variant)'}; border-left: 1px solid var(--bubble-container-border)"
		>
			<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			<span class="mt-1 truncate max-w-full px-1">{t.water_custom}</span>
		</button>
	</div>

	{#if customOpen}
		<div class="grid grid-cols-[1fr_auto] gap-2">
			<input
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={customAmount}
				placeholder={t.water_custom_placeholder}
				class="w-full min-w-0 h-12 px-4 rounded-2xl border-0 outline-none"
				style="background-color: var(--color-surface-high); color: var(--color-on-surface); font-size: 16px"
				onkeydown={(event) => event.key === 'Enter' && submitCustom()}
			/>
			<button
				type="button"
				onclick={submitCustom}
				disabled={saving || !customAmount || Number(customAmount) <= 0}
				class="h-12 px-5 rounded-2xl text-sm font-semibold disabled:opacity-40 active:opacity-70 touch-manipulation"
				style="background-color: #60A5FA; color: #07111F"
			>{t.water_add}</button>
		</div>
	{/if}
</div>
