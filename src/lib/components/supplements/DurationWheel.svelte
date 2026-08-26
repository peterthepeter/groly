<script lang="ts">
	import { onMount, tick } from 'svelte';

	let {
		value = $bindable(10),
		min = 5,
		max = 120,
		step = 5,
		label
	}: {
		value?: number;
		min?: number;
		max?: number;
		step?: number;
		label: string;
	} = $props();

	const rowHeight = 40;
	const instanceId = $props.id();
	let wheel: HTMLDivElement;
	let scrollFrame: number | null = null;
	let values = $derived(
		Array.from({ length: Math.floor((max - min) / step) + 1 }, (_, index) => min + index * step)
	);

	function valueIndex(nextValue: number) {
		return Math.max(0, Math.min(values.length - 1, Math.round((nextValue - min) / step)));
	}

	async function scrollToValue(nextValue: number, behavior: ScrollBehavior = 'smooth') {
		value = values[valueIndex(nextValue)];
		await tick();
		wheel?.scrollTo({ top: valueIndex(value) * rowHeight, behavior });
	}

	function handleScroll() {
		if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
		scrollFrame = requestAnimationFrame(() => {
			const nextValue = values[Math.max(0, Math.min(values.length - 1, Math.round(wheel.scrollTop / rowHeight)))];
			if (nextValue !== undefined && nextValue !== value) value = nextValue;
			scrollFrame = null;
		});
	}

	function handleKeydown(event: KeyboardEvent) {
		let nextValue = value;
		if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') nextValue -= step;
		else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') nextValue += step;
		else if (event.key === 'PageUp') nextValue -= step * 4;
		else if (event.key === 'PageDown') nextValue += step * 4;
		else if (event.key === 'Home') nextValue = min;
		else if (event.key === 'End') nextValue = max;
		else return;

		event.preventDefault();
		scrollToValue(nextValue);
	}

	onMount(() => {
		scrollToValue(value, 'instant');
		return () => {
			if (scrollFrame !== null) cancelAnimationFrame(scrollFrame);
		};
	});
</script>

<div class="duration-wheel-frame">
	<div class="duration-wheel-highlight" aria-hidden="true"></div>
	<div
		bind:this={wheel}
		class="duration-wheel"
		role="listbox"
		tabindex="0"
		aria-label={label}
		aria-activedescendant={`${instanceId}-duration-${value}`}
		onscroll={handleScroll}
		onkeydown={handleKeydown}
	>
		<div class="duration-wheel-options">
			{#each values as minutes}
				<button
					id={`${instanceId}-duration-${minutes}`}
					type="button"
					role="option"
					aria-selected={minutes === value}
					tabindex="-1"
					class:active={minutes === value}
					onclick={() => scrollToValue(minutes)}
				>
					<span>{minutes}</span><small>min</small>
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.duration-wheel-frame {
		position: relative;
		height: 112px;
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: 16px;
		background: var(--color-surface-container);
	}

	.duration-wheel-frame::before,
	.duration-wheel-frame::after {
		position: absolute;
		z-index: 3;
		left: 0;
		right: 0;
		height: 34px;
		content: '';
		pointer-events: none;
	}

	.duration-wheel-frame::before {
		top: 0;
		background: linear-gradient(to bottom, var(--color-surface-container) 10%, transparent);
	}

	.duration-wheel-frame::after {
		bottom: 0;
		background: linear-gradient(to top, var(--color-surface-container) 10%, transparent);
	}

	.duration-wheel-highlight {
		position: absolute;
		z-index: 0;
		top: 35px;
		left: 8px;
		right: 8px;
		height: 42px;
		border-radius: 13px;
		background: rgba(159, 122, 234, 0.1);
		border: 1px solid rgba(183, 148, 244, 0.2);
		pointer-events: none;
	}

	.duration-wheel {
		position: relative;
		z-index: 1;
		height: 100%;
		overflow-y: auto;
		overscroll-behavior: contain;
		scroll-snap-type: y mandatory;
		scrollbar-width: none;
		touch-action: pan-y;
		outline: none;
	}

	.duration-wheel::-webkit-scrollbar {
		display: none;
	}

	.duration-wheel-frame:focus-within .duration-wheel-highlight {
		outline: 2px solid #b794f4;
		outline-offset: -2px;
	}

	.duration-wheel-options {
		padding-block: 36px;
	}

	.duration-wheel button {
		display: flex;
		height: 40px;
		width: 100%;
		scroll-snap-align: center;
		scroll-snap-stop: always;
		align-items: center;
		justify-content: center;
		gap: 6px;
		color: var(--color-on-surface-variant);
		opacity: 0.38;
		transition: color 160ms cubic-bezier(0.2, 0, 0, 1), opacity 160ms cubic-bezier(0.2, 0, 0, 1), transform 160ms cubic-bezier(0.2, 0, 0, 1);
		outline: none;
	}

	.duration-wheel button.active {
		color: #b794f4;
		opacity: 1;
		transform: scale(1.04);
	}

	.duration-wheel span {
		font-size: 21px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}

	.duration-wheel small {
		font-size: 11px;
		font-weight: 600;
		line-height: 1;
	}

	@media (prefers-reduced-motion: reduce) {
		.duration-wheel button {
			transition: none;
		}
	}
</style>
