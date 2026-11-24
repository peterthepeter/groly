<script lang="ts">
	import type { HTMLInputAttributes } from 'svelte/elements';
	import { displayTime } from '#lib/dateDisplay';
	import { formatDateKey } from '#lib/dates';
	import { userSettings } from '#lib/userSettings.svelte';

	let { type, value = $bindable(''), class: className, style, ...attributes }: Omit<HTMLInputAttributes, 'type' | 'value' | 'onclick'> & {
		type: 'date' | 'time';
		value?: string;
	} = $props();

	const displayValue = $derived(type === 'date' ? formatDateKey(value, userSettings.dateFormat) : displayTime(value));

	function openPicker(event: MouseEvent & { currentTarget: HTMLInputElement }) {
		if (!event.detail || !event.currentTarget.showPicker) return;
		try {
			event.currentTarget.showPicker();
			event.preventDefault();
		} catch {
			// The platform control can still handle the click itself.
		}
	}
</script>

<span class={['preferred-date-time', className]} {style}>
	<span class="preferred-date-time-value" aria-hidden="true">{displayValue || '–'}</span>
	<input {...attributes} {type} bind:value onclick={openPicker} />
</span>

<style>
	.preferred-date-time { position: relative; display: inline-grid; align-items: center; min-width: 0; min-height: 32px; }
	.preferred-date-time-value { grid-area: 1 / 1; pointer-events: none; font-variant-numeric: tabular-nums; }
	input {
		grid-area: 1 / 1;
		z-index: 1;
		width: 100%;
		min-width: 0;
		height: 100%;
		border: 0;
		outline: none;
		background: transparent;
		color: inherit;
		font-size: 16px;
		cursor: pointer;
	}
	input:not(:focus-visible) { opacity: 0; }
	.preferred-date-time:has(input:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: -2px; }
	.preferred-date-time:has(input:focus-visible) .preferred-date-time-value { visibility: hidden; }
	input::-webkit-calendar-picker-indicator { position: absolute; inset: 0; width: auto; height: auto; margin: 0; padding: 0; opacity: 0; }
</style>
