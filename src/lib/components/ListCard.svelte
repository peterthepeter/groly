<script lang="ts">
	// Zufällig konsistente Farbe aus dem Listenname
	const COLORS = ['#006c54', '#2e6771', '#4d626c', '#5a4080', '#a0522d', '#1a6b3c'];

	function colorForName(name: string): string {
		let hash = 0;
		for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) & 0xffffffff;
		return COLORS[Math.abs(hash) % COLORS.length];
	}

	import { list_items_open } from '$lib/i18n.svelte';

	let { list, onClick, onLongPress }: {
		list: { id: string; name: string; description: string | null; openCount: number };
		onClick: () => void;
		onLongPress: () => void;
	} = $props();

	const color = $derived(colorForName(list.name));
	const initial = $derived(list.name[0]?.toUpperCase() ?? '?');

	let pressTimer: ReturnType<typeof setTimeout> | null = null;
	let longFired = false;

	function startPress() {
		longFired = false;
		pressTimer = setTimeout(() => { longFired = true; pressTimer = null; onLongPress(); }, 500);
	}
	function endPress() {
		if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; }
	}
	function handleClick() {
		if (longFired) { longFired = false; return; }
		onClick();
	}
</script>

<button
	onclick={handleClick}
	onpointerdown={startPress}
	onpointerup={endPress}
	onpointercancel={endPress}
	oncontextmenu={(e) => { e.preventDefault(); onLongPress(); }}
	class="w-full flex items-center gap-4 px-4 py-4 rounded-2xl transition-colors active:opacity-80 text-left"
	style="background-color: var(--color-surface-card)"
>
	<!-- Initial Icon -->
	<div class="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center font-bold text-base"
	     style="background-color: {color}20; color: {color}">
		{initial}
	</div>

	<!-- Text -->
	<div class="flex-1 min-w-0">
		<div class="font-semibold text-sm truncate" style="color: var(--color-on-surface)">{list.name}</div>
		<div class="text-xs truncate mt-0.5" style="color: var(--color-on-surface-variant)">
			{list.description ? `${list.description} · ` : ''}{list_items_open(list.openCount)}
		</div>
	</div>

	<!-- Chevron -->
	<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0">
		<polyline points="9 18 15 12 9 6"/>
	</svg>
</button>
