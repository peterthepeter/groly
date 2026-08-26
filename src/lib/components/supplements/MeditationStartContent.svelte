<script lang="ts">
	import { t } from '$lib/i18n.svelte';
	import DurationWheel from './DurationWheel.svelte';

	let {
		onstart,
		presets = [5, 10, 15, 20]
	}: {
		onstart: (minutes: number) => void;
		presets?: number[];
	} = $props();

	let customOpen = $state(false);
	let customMinutes = $state(10);

	function toggleCustom() {
		customOpen = !customOpen;
		customMinutes = 10;
	}

	function submitCustom() {
		onstart(customMinutes);
		customOpen = false;
	}
</script>

<div class="flex flex-col gap-2">
	<div class="grid grid-cols-5 overflow-hidden rounded-2xl" style="background-color: var(--color-surface-container); border: 1px solid var(--bubble-container-border)">
		{#each presets.slice(0, 4) as minutes, index}
			<button
				type="button"
				onclick={() => onstart(minutes)}
				class="h-12 min-w-0 flex flex-col items-center justify-center font-semibold active:opacity-60 touch-manipulation"
				style="color: #B794F4; border-left: {index > 0 ? '1px solid var(--bubble-container-border)' : '0'}"
			>
				<span class="text-base leading-none tabular-nums">{minutes}</span>
				<span class="mt-1 text-[10px] font-medium" style="color: var(--color-on-surface-variant)">min</span>
			</button>
		{/each}
		<button
			type="button"
			onclick={toggleCustom}
			class="h-12 min-w-0 flex flex-col items-center justify-center font-semibold active:opacity-60 touch-manipulation"
			style="background-color: {customOpen ? 'rgba(159,122,234,0.08)' : 'transparent'}; color: {customOpen ? '#B794F4' : 'var(--color-on-surface-variant)'}; border-left: 1px solid var(--bubble-container-border)"
		>
			<span class="text-base leading-none">+</span>
			<span class="mt-1 max-w-full truncate px-1 text-[9px] font-medium">{t.water_custom}</span>
		</button>
	</div>
	{#if customOpen}
		<div class="custom-duration-panel">
			<DurationWheel bind:value={customMinutes} min={5} max={120} step={5} label={t.meditation_duration} />
			<button type="button" onclick={submitCustom} class="h-12 rounded-2xl text-base font-semibold active:opacity-70 touch-manipulation" style="background-color: #9F7AEA; color: white">{t.meditation_start}</button>
		</div>
	{/if}
</div>

<style>
	.custom-duration-panel {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 104px;
		align-items: center;
		gap: 8px;
		animation: reveal-duration 180ms cubic-bezier(0.2, 0, 0, 1);
	}

	@keyframes reveal-duration {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@media (max-width: 360px) {
		.custom-duration-panel {
			grid-template-columns: 1fr;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.custom-duration-panel {
			animation: none;
		}
	}
</style>
