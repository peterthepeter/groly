<script lang="ts">
	import { goto } from '$app/navigation';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import CategoryOrderEditor from '#lib/components/CategoryOrderEditor.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import { t } from '#lib/i18n.svelte';
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.settings_categories_title} eyebrow={t.settings_title} onMenuOpen={() => {}} onBack={() => goto('/einstellungen#kategorien-sortieren')} />
	<div class="categories-content flex-1 overflow-y-auto px-4">
		<h1 class="sr-only">{t.settings_category_sorting}</h1>
		<div class="categories-surface">
			<CategoryOrderEditor order={userSettings.categoryOrder} onchange={(order) => userSettings.setCategoryOrder(order)} />
		</div>
	</div>
</div>
<AppBottomNav activeTab="none" />

<style>
	.categories-content { padding-top: calc(env(safe-area-inset-top) + 6rem); padding-bottom: calc(env(safe-area-inset-bottom) + 6rem); scroll-padding-top: calc(env(safe-area-inset-top) + 6rem); }
	.categories-surface { padding-top: 8px; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
</style>
