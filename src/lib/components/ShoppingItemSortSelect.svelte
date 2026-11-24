<script lang="ts">
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import { t } from '#lib/i18n.svelte';
	import type { ShoppingItemSortMode } from '#lib/userSettingsTypes';

	let { value, onchange }: {
		value: ShoppingItemSortMode;
		onchange: (mode: ShoppingItemSortMode) => void;
	} = $props();
	const modes = ['category', 'az', 'za', 'off'] as const;
	const options = $derived(modes.map(mode => ({ value: mode, label: t[`item_sort_${mode}`] })));
</script>

<SettingsSelectRow label={t.item_sort_mode} {value} {options} onchange={value => onchange(value as ShoppingItemSortMode)} />
