<script lang="ts">
	import type { Snippet } from 'svelte';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import { t } from '#lib/i18n.svelte';

	let { activeTab, count, limit, onMenuOpen, onSearch, onTabChange, actions, search }: {
		activeTab: 'recipes' | 'mealplan';
		count: number;
		limit: number;
		onMenuOpen: () => void;
		onSearch: (() => void) | null;
		onTabChange: (tab: 'recipes' | 'mealplan') => void;
		actions: Snippet;
		search?: Snippet;
	} = $props();
</script>

<div class="recipe-header">
	<div class="inset-row-divider recipe-header-brand">
		<AppHeader embedded
			title={activeTab === 'mealplan' ? t.meal_plan_tab : t.recipes_title}
			subtitle={activeTab === 'recipes' ? `${count} / ${limit}` : ''}
			{onMenuOpen} {onSearch} {actions}
		/>
	</div>
	<nav class="recipe-tabs" class:inset-row-divider={!!search} aria-label={t.recipes_title}>
		{#each ['recipes', 'mealplan'] as const as tab}
			<button class="recipe-tab" class:active={activeTab === tab}
				aria-pressed={activeTab === tab}
				onclick={() => onTabChange(tab)}
			>{tab === 'recipes' ? t.recipes_title : t.meal_plan_tab}</button>
		{/each}
	</nav>
	{#if search}
		<div class="recipe-search">{@render search()}</div>
	{/if}
</div>

<style>
	.recipe-header {
		overflow: hidden;
		border: 1px solid var(--bubble-container-border);
		border-radius: var(--radius-xl);
		background-color: var(--bubble-container-bg);
	}
	.recipe-header-brand :global(.app-header-row) { min-height: 56px; }
	.recipe-tabs { display: flex; padding-inline: 16px; }
	.recipe-tab {
		flex: 1;
		min-width: 0;
		min-height: 44px;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-on-surface-variant);
	}
	.recipe-tab.active { color: var(--color-primary); }
	.recipe-tab:active { opacity: 0.7; }
	.recipe-search { padding: 10px 16px 12px; }
</style>
