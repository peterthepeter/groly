<script lang="ts" generics="T extends { id: string; name: string }">
	import { onDestroy, tick, type Snippet } from 'svelte';
	import { t } from '#lib/i18n.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';

	let { items, enabled, onreorder, row }: {
		items: T[];
		enabled: boolean;
		onreorder: (ids: string[]) => void;
		row: Snippet<[T, Snippet | null]>;
	} = $props();
	const instructionsId = $props.id();
	let root: HTMLDivElement;
	let draft = $state<string[] | null>(null);
	let activeId = $state<string | null>(null);
	let positionId = $state<string | null>(null);
	let moved = $state(false);
	let announcement = $state('');
	let pointerId: number | null = null;
	let pointerY = 0;
	let startY = 0;
	let frame = 0;
	let scrollContainer: HTMLElement | null = null;
	const displayedItems = $derived(draft ? draft.flatMap(id => items.find(item => item.id === id) ?? []) : items);

	function announce(id: string, index: number) {
		announcement = `${items.find(item => item.id === id)?.name}: ${t.settings_position} ${index + 1} / ${items.length}`;
	}
	function moveTo(id: string, index: number) {
		const next = items.map(item => item.id);
		const from = next.indexOf(id);
		if (from < 0 || from === index) return;
		next.splice(from, 1);
		next.splice(Math.max(0, Math.min(index, next.length)), 0, id);
		onreorder(next);
		announce(id, next.indexOf(id));
	}
	// Same pointer capture, midpoint positioning and edge scrolling as CategoryOrderEditor.
	function animateDrag() {
		if (pointerId === null || !activeId || !draft) return;
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
			const rows = [...root.querySelectorAll<HTMLElement>('[data-list-id]')];
			const index = rows.filter(element => element.dataset.listId !== activeId && element.getBoundingClientRect().top + element.getBoundingClientRect().height / 2 < pointerY).length;
			if (draft.indexOf(activeId) !== index) {
				const next = draft.filter(id => id !== activeId);
				next.splice(index, 0, activeId);
				draft = next;
			}
		}
		frame = requestAnimationFrame(animateDrag);
	}
	function startDrag(event: PointerEvent, id: string) {
		if (!event.isPrimary || event.button !== 0 || pointerId !== null) return;
		event.preventDefault();
		pointerId = event.pointerId;
		pointerY = startY = event.clientY;
		moved = false;
		activeId = id;
		draft = items.map(item => item.id);
		positionId = null;
		let parent = root.parentElement;
		while (parent && !/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) parent = parent.parentElement;
		scrollContainer = parent;
		root.setPointerCapture(event.pointerId);
		frame = requestAnimationFrame(animateDrag);
	}
	function handleClick(id: string) {
		positionId = positionId === id ? null : id;
		if (positionId) void tick().then(() => root.querySelector<HTMLButtonElement>('.list-position-picker > button')?.focus({ preventScroll: true }));
	}
	function finishDrag(event?: PointerEvent, cancel = false) {
		if (pointerId === null || (event && event.pointerId !== pointerId)) return;
		cancelAnimationFrame(frame);
		if (!cancel && moved) {
			if (event) pointerY = event.clientY;
			animateDrag();
		}
		cancelAnimationFrame(frame);
		const id = activeId;
		const next = draft;
		if (root.hasPointerCapture(pointerId)) root.releasePointerCapture(pointerId);
		pointerId = null;
		activeId = null;
		draft = null;
		if (!cancel && !moved && id) handleClick(id);
		if (!cancel && moved && id && next) {
			// A live deletion must never reinsert an inaccessible list ID.
			const current = new Set(items.map(item => item.id));
			const surviving = next.filter(key => current.has(key));
			onreorder([...surviving, ...items.filter(item => !surviving.includes(item.id)).map(item => item.id)]);
			announce(id, surviving.indexOf(id));
		}
	}
	function onKeyDown(event: KeyboardEvent, id: string) {
		if (event.key === 'Escape') { finishDrag(undefined, true); positionId = null; return; }
		const index = items.findIndex(item => item.id === id);
		const target = event.key === 'ArrowUp' ? index - 1 : event.key === 'ArrowDown' ? index + 1
			: event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : null;
		if (target === null) return;
		event.preventDefault();
		moveTo(id, Math.max(0, Math.min(target, items.length - 1)));
	}
	$effect(() => { if (!enabled) { finishDrag(undefined, true); positionId = null; } });
	onDestroy(() => finishDrag(undefined, true));
</script>

<svelte:window onpointermove={(event) => { if (event.pointerId === pointerId) { pointerY = event.clientY; if (Math.abs(pointerY - startY) > 5) moved = true; } }} onpointerup={(event) => finishDrag(event)} onpointercancel={(event) => finishDrag(event, true)} onblur={() => finishDrag(undefined, true)} onkeydown={(event) => { if (event.key === 'Escape') finishDrag(undefined, true); }} />
<div bind:this={root}>
	{#each displayedItems as item, index (item.id)}
		<div data-list-id={item.id} class:inset-row-divider={index < displayedItems.length - 1} class:dragging={activeId === item.id && moved}>
			{#snippet controls()}
				{#if positionId === item.id}
					<div class="list-position-picker"><SettingsSelectRow compact label={`${t.settings_position}: ${item.name}`} value={String(index)} options={items.map((_, target) => ({ value: String(target), label: String(target + 1) }))} onchange={(value) => { moveTo(item.id, Number(value)); positionId = null; }} /></div>
				{/if}
				<button type="button" class="list-order-grip" aria-label={`${t.a11y_reorder}: ${item.name}`} aria-describedby={instructionsId} onpointerdown={(event) => startDrag(event, item.id)} onclick={(event) => { if (event.detail === 0) handleClick(item.id); }} onkeydown={(event) => onKeyDown(event, item.id)}>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
				</button>
			{/snippet}
			{@render row(item, enabled ? controls : null)}
		</div>
	{/each}
	<span id={instructionsId} class="sr-only">{t.settings_category_drag_hint}</span>
	<span class="sr-only" role="status">{announcement}</span>
</div>

<style>
	.dragging { background: var(--bubble-interactive-bg); }
	.list-order-grip { display: flex; align-items: center; justify-content: center; width: 44px; height: 44px; margin-right: -8px; flex: none; color: var(--color-on-surface-variant); touch-action: none; cursor: grab; user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
	.list-order-grip:active { cursor: grabbing; }
	.list-order-grip:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 8px; }
	.list-position-picker { flex: none; }
</style>
