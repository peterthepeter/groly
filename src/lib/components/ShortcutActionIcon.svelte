<script lang="ts">
	import type { ShortcutAction } from '#lib/userSettingsTypes';
	let { action, size = 20, color = 'var(--color-on-surface-variant)' }: { action: ShortcutAction; size?: number; color?: string } = $props();
</script>
<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
	{#if action === 'scanner'}<path d="M3 9V6a2 2 0 0 1 2-2h2M3 15v3a2 2 0 0 0 2 2h2M21 9V6a2 2 0 0 0-2-2h-2M21 15v3a2 2 0 0 1-2 2h-2M10 9v6m3-6v6m3-6v6" />
	{:else if action === 'add'}<path d="M12 5v14M5 12h14" />
	{:else if action === 'log-tracker'}<path d="M3 12h4l3-8 4 16 3-8h4" />
	{:else if action === 'log-supplement'}<rect x="3" y="8" width="18" height="8" rx="4" /><path d="M12 8v8" />
	{:else}<path d="m6 3-3 4v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7l-3-4zM3 7h18M8 11a4 4 0 0 0 8 0" />{/if}
</svg>
