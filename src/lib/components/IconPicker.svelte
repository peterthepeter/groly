<script lang="ts">
	import { currentLang } from '$lib/i18n.svelte';
	import { LIST_ICONS, getListIcon, getListIconLabel } from '$lib/listIcons';

	let { selectedIconId, name = '', onSelect, flat = false }: {
		selectedIconId: string | null;
		name?: string;
		onSelect: (id: string | null) => void;
		flat?: boolean;
	} = $props();

	let iconPickerOpen = $state(false);

	const selectedIcon = $derived(getListIcon(selectedIconId));

	function selectIcon(id: string | null) {
		onSelect(id);
		iconPickerOpen = false;
	}
</script>

<div class="relative">
	<button
		type="button"
		onclick={() => iconPickerOpen = !iconPickerOpen}
		class="w-full flex items-center gap-3 px-4 active:opacity-70 transition-opacity {flat ? '' : 'rounded-xl'}"
		style="{flat ? '' : 'background-color: var(--color-surface-container);'} height: {flat ? '44px' : '52px'}"
	>
		{#if selectedIcon}
			<svg class="flex-shrink-0" width="20" height="20" viewBox="0 0 24 24" fill="none"
			     stroke={selectedIcon.color} stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
				{@html selectedIcon.svgContent}
			</svg>
		{:else}
			<span class="flex-shrink-0 w-5 h-5 flex items-center justify-center font-bold text-sm"
			      style="color: var(--color-on-surface-variant)">{name[0]?.toUpperCase() || '?'}</span>
		{/if}

		<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
			{selectedIcon ? getListIconLabel(selectedIcon, currentLang()) : 'Standard'}
		</span>

		<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
		     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
		     class="transition-transform {iconPickerOpen ? 'rotate-180' : ''}">
			<polyline points="6 9 12 15 18 9"/>
		</svg>
	</button>

	{#if iconPickerOpen}
		<div class="absolute bottom-full left-0 right-0 mb-2 rounded-2xl p-3 z-10"
		     style="background-color: var(--color-surface-high); box-shadow: 0 -4px 24px rgba(0,0,0,0.4)">
			<div class="grid grid-cols-3 gap-2">
				<button
					type="button"
					onclick={() => selectIcon(null)}
					class="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all active:opacity-70"
					style="background-color: {selectedIconId === null ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'transparent'}; outline: 1.5px solid {selectedIconId === null ? 'var(--color-primary)' : 'transparent'}; outline-offset: -1.5px"
				>
					<span class="w-7 h-7 flex items-center justify-center font-bold text-base"
					      style="color: var(--color-on-surface-variant)">
						{name[0]?.toUpperCase() || '?'}
					</span>
					<span class="text-[10px] font-medium leading-none" style="color: var(--color-on-surface-variant)">Standard</span>
				</button>

				{#each LIST_ICONS as icon (icon.id)}
					<button
						type="button"
						onclick={() => selectIcon(icon.id)}
						class="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all active:opacity-70"
						style="background-color: {selectedIconId === icon.id ? `color-mix(in srgb, ${icon.color} 18%, transparent)` : 'transparent'}; outline: 1.5px solid {selectedIconId === icon.id ? icon.color : 'transparent'}; outline-offset: -1.5px"
					>
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none"
						     stroke={icon.color} stroke-width="1.4"
						     stroke-linecap="round" stroke-linejoin="round">
							{@html icon.svgContent}
						</svg>
						<span class="text-[10px] font-medium leading-none" style="color: {selectedIconId === icon.id ? icon.color : 'var(--color-on-surface-variant)'}">
							{getListIconLabel(icon, currentLang())}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}
</div>
