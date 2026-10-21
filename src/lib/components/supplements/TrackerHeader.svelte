<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import TrackerSectionNav from './TrackerSectionNav.svelte';

	let {
		title,
		onMenuOpen,
		onBack = null,
		actions = null,
		collapsed = false,
		activeSection,
		nutritionEnabled,
		todayLogs = null,
		historyControls = null
	}: {
		title: string;
		onMenuOpen: () => void;
		onBack?: (() => void) | null;
		actions?: Snippet | null;
		collapsed?: boolean;
		activeSection: 'today' | 'history' | 'nutrition';
		nutritionEnabled: boolean;
		todayLogs?: { supplementId: string; loggedAt: number }[] | null;
		historyControls?: Snippet | null;
	} = $props();
</script>

<div class="tracker-header">
	<div class="tracker-header-brand" class:collapsed class:inset-row-divider={!collapsed} inert={collapsed}>
		<div class="tracker-header-brand-content">
			<AppHeader embedded {title} {onMenuOpen} {onBack} {actions} />
		</div>
	</div>
	<TrackerSectionNav {activeSection} {nutritionEnabled} {todayLogs} {historyControls} />
</div>

<style>
	.tracker-header {
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--radius-xl);
		background: var(--bubble-container-bg);
	}
	.tracker-header-brand {
		display: grid;
		grid-template-rows: 1fr;
		transition: grid-template-rows 200ms cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	.tracker-header-brand.collapsed { grid-template-rows: 0fr; }
	.tracker-header-brand-content { min-height: 0; overflow: hidden; }
	@media (prefers-reduced-motion: reduce) {
		.tracker-header-brand { transition: none; }
	}
</style>
