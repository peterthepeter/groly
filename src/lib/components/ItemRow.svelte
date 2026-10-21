<script lang="ts">
	import { getCategoryForItem } from '#lib/categories';
	import { userSettings } from '#lib/userSettings.svelte';

	let { item, onTap, onLongPress = null, createdByUsername = null, currentUsername = null, isFavorite = false, checked = false, alreadyOnList = false, added = false }: {
		item: { id: string; name: string; quantityInfo: string | null; categoryOverride?: string | null };
		onTap: () => void;
		onLongPress?: (() => void) | null;
		createdByUsername?: string | null;
		currentUsername?: string | null;
		isFavorite?: boolean;
		checked?: boolean;
		alreadyOnList?: boolean;
		added?: boolean;
	} = $props();

	const category = $derived(getCategoryForItem(item.name, item.categoryOverride));
	const showCreator = $derived(!!createdByUsername && createdByUsername !== currentUsername);
	const displayCreator = $derived(
		createdByUsername
			? '(' + (createdByUsername.length > 10 ? createdByUsername.slice(0, 10) + '…' : createdByUsername) + ')'
			: ''
	);

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = $state(false);

	function startPress() {
		longFired = false;
		if (!onLongPress) return;
		pressTimer = setTimeout(() => { longFired = true; pressTimer = null; onLongPress?.(); }, 500);
	}
	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleClick() {
		if (longFired) { longFired = false; return; }
		onTap();
	}
</script>

<button
	type="button"
	onclick={handleClick}
	onpointerdown={startPress}
	onpointerup={endPress}
	onpointerleave={endPress}
	onpointercancel={endPress}
	oncontextmenu={(e) => { if (onLongPress) { e.preventDefault(); onLongPress(); } }}
	class="item-row"
	class:checked
>
	<!-- Category icon — no background, same as tile -->
	<div class="relative flex-shrink-0">
		<svg width="22" height="22" viewBox="0 0 24 24" fill="none"
		     stroke={checked ? 'var(--color-on-surface-variant)' : category.color} stroke-width="1.3"
		     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			{@html category.svgContent}
		</svg>
		{#if alreadyOnList || (isFavorite && userSettings.showFavoriteIndicator)}
			<span class="absolute -top-1 -left-1 w-1.5 h-1.5 rounded-full"
			      style="background-color: var(--color-primary)" aria-hidden="true"></span>
		{/if}
	</div>

	<div class="item-main">
		<span class="item-name">{item.name}</span>
		{#if showCreator}
			<span class="item-creator">{displayCreator}</span>
		{/if}
	</div>

	{#if item.quantityInfo}
		<span class="item-quantity">{item.quantityInfo}</span>
	{/if}
	{#if added}
		<svg class="item-added" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
			<polyline points="20 6 9 17 4 12" />
		</svg>
	{/if}
</button>

<style>
	.item-row {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		min-height: 44px;
		padding: 8px 16px;
		background: transparent;
		color: var(--color-on-surface);
		text-align: left;
		touch-action: pan-y;
		user-select: none;
		transition: background-color 160ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.item-row:active { background: var(--bubble-interactive-bg); }
	.item-row:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
	.item-main { flex: 1; min-width: 0; }
	.item-name { display: block; font-size: 14px; font-weight: 600; line-height: 20px; overflow-wrap: anywhere; }
	.item-creator { display: block; font-size: 11px; line-height: 16px; color: var(--color-on-surface-variant); }
	.item-quantity { flex: none; max-width: 38%; font-size: 11px; line-height: 16px; text-align: right; overflow-wrap: anywhere; color: var(--color-on-surface-variant); font-variant-numeric: tabular-nums; }
	.item-added { flex: none; }
	.checked { color: var(--color-on-surface-variant); }
	.checked .item-name, .checked .item-quantity { text-decoration: line-through; }
	@media (prefers-reduced-motion: reduce) {
		.item-row { transition: none; }
	}
</style>
