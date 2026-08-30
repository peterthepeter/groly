<script lang="ts">
	type TileSupplement = {
		id: string;
		name: string;
		brand: string | null;
	};

	let {
		supplement,
		amount,
		unitLabel,
		time,
		hasNote,
		saving,
		done,
		takenLabel,
		decreaseAmountLabel,
		increaseAmountLabel,
		doneEditingLabel,
		onLog,
		onAmountChange,
		onTimeChange,
		onLongPress
	}: {
		supplement: TileSupplement;
		amount: number;
		unitLabel: string;
		time: string;
		hasNote: boolean;
		saving: boolean;
		done: boolean;
		takenLabel: string;
		decreaseAmountLabel: string;
		increaseAmountLabel: string;
		doneEditingLabel: string;
		onLog: () => void;
		onAmountChange: (amount: number) => void;
		onTimeChange: (time: string) => void;
		onLongPress: () => void;
	} = $props();

	let editingAmount = $state(false);
	let tileEl = $state<HTMLDivElement | null>(null);
	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let pressOrigin = { x: 0, y: 0 };
	let suppressClick = false;

	function cancelPress() {
		if (pressTimer) clearTimeout(pressTimer);
		pressTimer = null;
	}

	function startPress(event: PointerEvent) {
		if (saving || done) return;
		cancelPress();
		suppressClick = false;
		pressOrigin = { x: event.clientX, y: event.clientY };
		pressTimer = setTimeout(() => {
			pressTimer = null;
			suppressClick = true;
			onLongPress();
		}, 500);
	}

	function movePress(event: PointerEvent) {
		if (!pressTimer) return;
		if (Math.abs(event.clientX - pressOrigin.x) > 8 || Math.abs(event.clientY - pressOrigin.y) > 8) {
			cancelPress();
		}
	}

	function handleTileClick() {
		cancelPress();
		if (suppressClick) {
			suppressClick = false;
			return;
		}
		if (!saving && !done) onLog();
	}

	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();
		if (saving || done) return;
		suppressClick = true;
		onLongPress();
	}

	function stepAmount(delta: -1 | 1) {
		const next = Math.max(0.1, Math.round((amount + delta) * 10) / 10);
		onAmountChange(next);
	}

	function handleWindowPointerDown(event: PointerEvent) {
		if (editingAmount && tileEl && !tileEl.contains(event.target as Node)) {
			editingAmount = false;
		}
	}

	function handleWindowKeyDown(event: KeyboardEvent) {
		if (editingAmount && event.key === 'Escape') editingAmount = false;
	}
</script>

<svelte:window onpointerdown={handleWindowPointerDown} onkeydown={handleWindowKeyDown} />

<style>
	@keyframes status-pop {
		from { opacity: 0; transform: scale(0.94); }
		to { opacity: 1; transform: scale(1); }
	}

	.tile:has(> .tile-hit:active) {
		transform: scale(0.985);
	}

	.tile {
		border-radius: 20px;
	}

	.tile-edit-row {
		background-color: var(--bubble-interactive-bg);
		border-radius: 10px;
		overflow: hidden;
	}

	.tile-edit-control {
		background: transparent;
		color: var(--color-on-surface-variant);
		transition: background-color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1), color 0.14s cubic-bezier(0.2, 0.8, 0.2, 1);
	}

	.tile-edit-control + .tile-edit-control {
		border-left: 1px solid var(--bubble-container-border);
	}

	.tile-edit-control:active,
	.tile-edit-control:focus,
	.tile-edit-control:focus-within {
		background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
		color: var(--color-primary);
	}

	.status-overlay {
		animation: status-pop 0.18s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}

	.amount-stepper {
		animation: status-pop 0.16s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
	}
</style>

<div
	bind:this={tileEl}
	class="tile aspect-square relative overflow-hidden select-none transition-all duration-150"
	style="background-color: var(--bubble-container-bg); border: 1px solid {done ? 'var(--color-primary)' : 'var(--bubble-container-border)'}"
>
	<button
		type="button"
		disabled={saving || done}
		aria-label={`${supplement.name}, ${amount} ${unitLabel}, ${time}`}
		onclick={handleTileClick}
		onpointerdown={startPress}
		onpointermove={movePress}
		onpointerup={cancelPress}
		onpointerleave={cancelPress}
		onpointercancel={cancelPress}
		oncontextmenu={handleContextMenu}
		class="tile-hit absolute inset-0 z-0 w-full h-full rounded-[20px] outline-none focus-visible:ring-2"
		style="touch-action: pan-y; --tw-ring-color: var(--color-primary)"
	></button>

	{#if hasNote}
		<span
			class="absolute z-10 top-2.5 left-3 w-1.5 h-1.5 rounded-full pointer-events-none"
			style="background-color: var(--color-primary)"
			aria-hidden="true"
		></span>
	{/if}

	<div
		class="absolute z-10 inset-0 px-2.5 pt-3 pb-2 flex flex-col pointer-events-none transition-opacity duration-150"
		class:opacity-0={saving || done}
	>
		<div class="flex-1 min-h-0 flex flex-col items-center justify-start pt-1">
			<p
				class="text-xs font-bold leading-snug line-clamp-3 max-[374px]:line-clamp-2 text-center w-full"
				style="color: var(--color-primary)"
			>{supplement.name}</p>
			{#if supplement.brand}
				<p
					class="text-[10px] leading-tight text-center mt-1 truncate w-full"
					style="color: var(--color-on-surface-variant); opacity: 0.7"
				>{supplement.brand}</p>
			{/if}
		</div>

		<div class="tile-edit-row grid grid-cols-2 shrink-0 pointer-events-auto">
			<button
				type="button"
				onclick={() => editingAmount = true}
				class="tile-edit-control h-8 min-w-0 px-1 text-[10px] font-semibold truncate active:opacity-60"
				aria-expanded={editingAmount}
				aria-label={`${supplement.name}: ${amount} ${unitLabel}`}
			>{amount} {unitLabel}</button>

			<label
				class="tile-edit-control relative h-8 min-w-0 px-1 flex items-center justify-center text-[10px] font-semibold tabular-nums overflow-hidden"
			>
				<span>{time || '--:--'}</span>
				<input
					type="time"
					value={time}
					oninput={(event) => onTimeChange(event.currentTarget.value)}
					aria-label={`${supplement.name}: ${time}`}
					class="absolute inset-0 w-full h-full opacity-[0.001] cursor-pointer"
				/>
			</label>
		</div>
	</div>

	{#if editingAmount && !saving && !done}
		<div
			class="amount-stepper absolute z-20 inset-1.5 rounded-[20px] flex flex-col p-1.5"
			style="background-color: var(--color-surface-high); border: 1px solid var(--color-primary); box-shadow: 0 8px 24px rgba(0, 0, 0, 0.22)"
		>
			<button
				type="button"
				onclick={() => editingAmount = false}
				aria-label={`${doneEditingLabel}: ${amount} ${unitLabel}`}
				class="min-h-0 flex-1 w-full rounded-xl flex items-center justify-center gap-1.5 px-1 text-sm font-bold tabular-nums active:scale-[0.97] transition-transform duration-150"
				style="background-color: var(--bubble-container-bg); color: var(--color-primary)"
			>
				<span class="min-w-0 truncate">{amount} {unitLabel}</span>
				<svg class="shrink-0" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<polyline points="20 6 9 17 4 12" />
				</svg>
			</button>

			<div class="grid grid-cols-2 gap-1 w-full shrink-0">
				<button
					type="button"
					onclick={() => stepAmount(-1)}
					disabled={amount <= 0.1}
					aria-label={`${supplement.name}: ${decreaseAmountLabel}`}
					class="stepper-control h-9 rounded-xl text-xl font-medium flex items-center justify-center transition-transform duration-150 active:scale-90 disabled:opacity-30"
					style="background-color: var(--bubble-container-bg); color: var(--color-on-surface)"
				>−</button>

				<button
					type="button"
					onclick={() => stepAmount(1)}
					aria-label={`${supplement.name}: ${increaseAmountLabel}`}
					class="stepper-control h-9 rounded-xl text-xl font-medium flex items-center justify-center transition-transform duration-150 active:scale-90"
					style="background-color: var(--bubble-container-bg); color: var(--color-on-surface)"
				>+</button>
			</div>
		</div>
	{/if}

	{#if saving || done}
		<div
			class="status-overlay absolute inset-0 z-20 flex items-center justify-center px-2 text-center pointer-events-none"
			style="background-color: var(--bubble-container-bg)"
			role="status"
			aria-live="polite"
		>
			{#if saving}
				<div
					class="w-5 h-5 rounded-full border-2 animate-spin"
					style="border-color: var(--color-primary); border-top-color: transparent"
				></div>
			{:else}
				<span class="text-xs font-bold leading-snug" style="color: var(--color-primary)">{takenLabel}</span>
			{/if}
		</div>
	{/if}
</div>
