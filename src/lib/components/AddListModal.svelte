<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import { LIST_ICONS, getListIcon, getListIconLabel } from '$lib/listIcons';

	let { list = null, onSave, onDelete = null, onShare = null, onClose }: {
		list?: { id: string; name: string; description: string | null; iconId?: string | null } | null;
		onSave: (name: string, description: string, iconId: string | null) => void;
		onDelete?: (() => void) | null;
		onShare?: (() => void) | null;
		onClose: () => void;
	} = $props();

	let name = $state(list?.name ?? '');
	let description = $state(list?.description ?? '');
	let selectedIconId = $state<string | null>(list?.iconId ?? 'supermarkt');
	let iconPickerOpen = $state(false);
	let bottomOffset = $state(0);

	const selectedIcon = $derived(getListIcon(selectedIconId));

	$effect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		function update() {
			bottomOffset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
		}
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

	function selectIcon(id: string | null) {
		selectedIconId = id;
		iconPickerOpen = false;
	}
</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)"
     onclick={() => { if (iconPickerOpen) { iconPickerOpen = false; } else { onClose(); } }}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low); bottom: {bottomOffset}px">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<div class="flex items-center justify-between mb-5">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{list ? t.list_edit_title : t.list_create_title}</h2>
		{#if list && onShare}
			<button
				onclick={onShare}
				class="p-2 rounded-xl active:opacity-60"
				style="color: var(--color-primary)"
				aria-label="Liste teilen"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<line x1="19" y1="8" x2="19" y2="14"/>
					<line x1="22" y1="11" x2="16" y2="11"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="space-y-3 mb-4">
		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				placeholder={t.list_name_label}
				bind:value={name}
				autofocus
				onfocus={(e) => { const el = e.target as HTMLInputElement; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); }}
				class="w-full bg-transparent outline-none text-base font-medium"
				style="color: var(--color-on-surface)"
			/>
		</div>

		<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
			<input
				type="text"
				placeholder={t.list_description_placeholder}
				bind:value={description}
				class="w-full bg-transparent outline-none text-base"
				style="color: var(--color-on-surface)"
			/>
		</div>
	</div>

	<!-- Icon Trigger + Popup -->
	<div class="relative mb-5">
		<!-- Trigger -->
		<button
			type="button"
			onclick={() => iconPickerOpen = !iconPickerOpen}
			class="w-full flex items-center gap-3 px-4 py-3 rounded-xl active:opacity-70 transition-opacity"
			style="background-color: var(--color-surface-container)"
		>
			<!-- Aktuelles Icon -->
			<div class="w-8 h-8 flex items-center justify-center font-bold text-sm flex-shrink-0"
			     style="color: {selectedIcon ? selectedIcon.color : 'var(--color-on-surface-variant)'}">
				{#if selectedIcon}
					<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
					     stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
						{@html selectedIcon.svgContent}
					</svg>
				{:else}
					{name[0]?.toUpperCase() || '?'}
				{/if}
			</div>

			<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
				{selectedIcon ? getListIconLabel(selectedIcon, currentLang()) : 'Standard'}
			</span>

			<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
			     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
			     class="transition-transform {iconPickerOpen ? 'rotate-180' : ''}">
				<polyline points="6 9 12 15 18 9"/>
			</svg>
		</button>

		<!-- Popup Grid -->
		{#if iconPickerOpen}
			<div class="absolute bottom-full left-0 right-0 mb-2 rounded-2xl p-3 z-10"
			     style="background-color: var(--color-surface-high); box-shadow: 0 -4px 24px rgba(0,0,0,0.4)">
				<div class="grid grid-cols-3 gap-2">
					<!-- Standard -->
					<button
						type="button"
						onclick={() => selectIcon(null)}
						class="flex flex-col items-center gap-1.5 py-2.5 px-1 rounded-xl transition-all active:opacity-70"
						style="background-color: {selectedIconId === null ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'transparent'}; outline: 1.5px solid {selectedIconId === null ? 'var(--color-primary)' : 'transparent'}; outline-offset: -1.5px"
					>
						<span class="w-10 h-10 flex items-center justify-center font-bold text-xl"
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

	<div class="flex gap-3">
		{#if list && onDelete}
			<button
				onclick={() => { if (confirm(t.confirm_delete_list)) { onDelete!(); onClose(); } }}
				class="px-4 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
			>
				{t.list_delete}
			</button>
		{/if}
		<button
			onclick={onClose}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{t.list_cancel}
		</button>
		<button
			onclick={() => name.trim() && onSave(name.trim(), description.trim(), selectedIconId)}
			disabled={!name.trim()}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{list ? t.list_save : t.create}
		</button>
	</div>
</div>
