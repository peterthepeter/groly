<script lang="ts">
	import { onDestroy, tick } from 'svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import { CATEGORY_LABELS } from '#lib/categories';
	import { currentLang, t } from '#lib/i18n.svelte';

	let { order, onchange }: { order: string[]; onchange: (order: string[]) => void } = $props();
	let root: HTMLDivElement;
	let draft = $state<string[] | null>(null);
	let activeKey = $state<string | null>(null);
	let positionKey = $state<string | null>(null);
	let announcement = $state('');
	const displayedOrder = $derived(draft ?? order);
	let pointerId: number | null = null;
	let pointerY = 0;
	let startY = 0;
	let moved = $state(false);
	let frame = 0;
	let scrollContainer: HTMLElement | null = null;

	function label(key: string) { return CATEGORY_LABELS[key]?.[currentLang()] ?? key; }
	function announce(key: string, index: number) {
		announcement = `${label(key)}: ${t.settings_position} ${index + 1} / ${order.length}`;
	}
	function moveTo(key: string, index: number) {
		const next = [...order];
		const from = next.indexOf(key);
		if (from < 0 || from === index) return;
		next.splice(from, 1);
		next.splice(Math.max(0, Math.min(index, next.length)), 0, key);
		onchange(next);
		announce(key, next.indexOf(key));
	}
	function animateDrag() {
		if (pointerId === null || !activeKey || !draft) return;
		if (moved) {
			if (scrollContainer) {
				const bounds = scrollContainer.getBoundingClientRect();
				const style = getComputedStyle(scrollContainer);
				const top = bounds.top + (parseFloat(style.scrollPaddingTop) || 0);
				const bottom = bounds.bottom - (parseFloat(style.paddingBottom) || 0);
				const speed = pointerY < top + 44 ? -Math.min(12, (top + 44 - pointerY) / 4)
					: pointerY > bottom - 44 ? Math.min(12, (pointerY - bottom + 44) / 4) : 0;
				if (speed) scrollContainer.scrollTop += speed;
			}
			const rows = [...root.querySelectorAll<HTMLElement>('[data-category-key]')];
			const index = rows.filter(row => row.dataset.categoryKey !== activeKey && row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2 < pointerY).length;
			if (draft.indexOf(activeKey) !== index) {
				const next = draft.filter(key => key !== activeKey);
				next.splice(index, 0, activeKey);
				draft = next;
			}
		}
		frame = requestAnimationFrame(animateDrag);
	}
	function startDrag(event: PointerEvent, key: string) {
		if (!event.isPrimary || event.button !== 0 || pointerId !== null) return;
		event.preventDefault();
		pointerId = event.pointerId;
		pointerY = startY = event.clientY;
		moved = false;
		activeKey = key;
		draft = [...order];
		positionKey = null;
		let parent = root.parentElement;
		while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		scrollContainer = parent;
		// Capture on the stable container; the keyed handle can move while dragging.
		root.setPointerCapture(event.pointerId);
		frame = requestAnimationFrame(animateDrag);
	}
	function onPointerMove(event: PointerEvent) {
		if (event.pointerId !== pointerId) return;
		pointerY = event.clientY;
		if (Math.abs(pointerY - startY) > 5) moved = true;
	}
	function finishDrag(event?: PointerEvent, cancel = false) {
		if (pointerId === null || (event && event.pointerId !== pointerId)) return;
		cancelAnimationFrame(frame);
		if (!cancel && moved) {
			if (event) pointerY = event.clientY;
			animateDrag();
		}
		cancelAnimationFrame(frame);
		const key = activeKey;
		const next = draft;
		if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
		pointerId = null;
		activeKey = null;
		draft = null;
		if (!cancel && !moved && key) handleClick(key);
		if (!cancel && moved && key && next && next.some((value, index) => value !== order[index])) {
			onchange(next);
			announce(key, next.indexOf(key));
		}
	}
	function handleClick(key: string) {
		positionKey = positionKey === key ? null : key;
		if (positionKey) void tick().then(() => root.querySelector<HTMLButtonElement>('.category-position-picker > button')?.focus({ preventScroll: true }));
	}
	function onKeyDown(event: KeyboardEvent, key: string) {
		if (event.key === 'Escape') { finishDrag(undefined, true); positionKey = null; return; }
		const index = order.indexOf(key);
		const target = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1
			: event.key === 'Home' ? 0 : event.key === 'End' ? order.length - 1 : null;
		if (target === null) return;
		event.preventDefault();
		moveTo(key, Math.max(0, Math.min(target, order.length - 1)));
	}
	onDestroy(() => { finishDrag(undefined, true); });
</script>

<svelte:window onpointermove={onPointerMove} onpointerup={(event) => finishDrag(event)} onpointercancel={(event) => finishDrag(event, true)} onblur={() => finishDrag(undefined, true)} onkeydown={(event) => { if (event.key === 'Escape') finishDrag(undefined, true); }} />
<div class="category-order-editor" bind:this={root}>
	<p class="category-order-hint">{t.settings_category_order_hint}</p>
	<ol>
		{#each displayedOrder as key, index (key)}
			<li data-category-key={key} class:dragging={activeKey === key && moved}>
				<span class="category-order-number" aria-hidden="true">{index + 1}.</span>
				<span class="category-order-name">{label(key)}</span>
				{#if positionKey === key}
					<div class="category-position-picker">
						<SettingsSelectRow compact label={`${t.settings_position}: ${label(key)}`} value={String(index)} options={order.map((_, target) => ({ value: String(target), label: String(target + 1) }))} onchange={(value) => { moveTo(key, Number(value)); positionKey = null; }} />
					</div>
				{/if}
				<button type="button" class="category-order-grip" aria-label={`${t.a11y_reorder}: ${label(key)}`} aria-describedby="category-order-instructions" onpointerdown={(event) => startDrag(event, key)} onclick={(event) => { if (event.detail === 0) handleClick(key); }} onkeydown={(event) => onKeyDown(event, key)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
				</button>
			</li>
		{/each}
	</ol>
	<p id="category-order-instructions" class="category-order-hint">{t.settings_category_drag_hint}</p>
	<span class="sr-only" role="status">{announcement}</span>
</div>

<style>
	.category-order-editor { padding: 0 20px 10px; }
	.category-order-hint { margin: 0; padding: 4px 0 8px; color: var(--color-on-surface-variant); font-size: 12px; line-height: 1.5; }
	ol { margin: 0 0 6px; padding: 0; list-style: none; }
	li { display: flex; align-items: center; gap: 8px; min-height: 44px; color: var(--color-on-surface); font-size: 14px; }
	li + li { border-top: 1px solid var(--bubble-container-border); }
	li.dragging { background: var(--bubble-interactive-bg); color: var(--color-primary); }
	.category-order-number { width: 24px; flex: none; color: var(--color-on-surface-variant); font-size: 12px; font-variant-numeric: tabular-nums; }
	.category-order-name { flex: 1; min-width: 0; }
	.category-order-grip { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; flex: none; color: var(--color-on-surface-variant); touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
	.category-order-grip:active { cursor: grabbing; }
	.category-order-grip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
	.category-position-picker { flex: none; }
</style>
