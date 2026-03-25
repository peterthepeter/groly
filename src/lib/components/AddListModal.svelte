<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import IconPicker from '$lib/components/IconPicker.svelte';

	let { list = null, onSave, onDelete = null, onShare = null, onClose, memberCount = 0 }: {
		list?: { id: string; name: string; description: string | null; iconId?: string | null } | null;
		onSave: (name: string, description: string, iconId: string | null, shareAfterCreate?: boolean) => void;
		onDelete?: (() => void) | null;
		onShare?: (() => void) | null;
		onClose: () => void;
		memberCount?: number;
	} = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(list?.name ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(list?.description ?? '');
	// svelte-ignore state_referenced_locally
	let selectedIconId = $state<string | null>(list?.iconId ?? 'supermarkt');
	let bottomOffset = $state(0);
	let notificationsEnabled = $state(true);
	let notifLoading = $state(false);
	let shareAfterCreate = $state(false);

	// Notification-Präferenz laden wenn Liste besteht und geteilt ist
	$effect(() => {
		if (list?.id && memberCount > 0) {
			fetch(`/api/lists/${list.id}/notifications`)
				.then(r => r.json())
				.then(d => { notificationsEnabled = d.enabled ?? true; })
				.catch(() => {});
		}
	});

	async function toggleNotifications() {
		if (!list?.id || notifLoading) return;
		notifLoading = true;
		const next = !notificationsEnabled;
		await fetch(`/api/lists/${list.id}/notifications`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: next })
		}).catch(() => {});
		notificationsEnabled = next;
		notifLoading = false;
	}

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

</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)"
     onclick={onClose}></div>

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

	<div class="space-y-3 mb-3">
		<!-- Teilen nach Erstellen Toggle (nur beim Erstellen) -->
		{#if !list}
			<button
				type="button"
				onclick={() => shareAfterCreate = !shareAfterCreate}
				class="w-full flex items-center gap-3 px-4 rounded-xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); height: 52px"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
				     stroke={shareAfterCreate ? 'var(--color-primary)' : 'var(--color-outline)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
					<polyline points="16 6 12 2 8 6"/>
					<line x1="12" y1="2" x2="12" y2="15"/>
				</svg>
				<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Share after creating' : 'Nach Erstellen teilen'}
				</span>
				<div class="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
				     style="background-color: {shareAfterCreate ? 'var(--color-primary)' : 'var(--color-surface-high)'}">
					<div class="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
					     style="background-color: white; left: {shareAfterCreate ? '1.25rem' : '0.125rem'}"></div>
				</div>
			</button>
		{/if}

		<!-- Notification Toggle (nur bei geteilten Listen) -->
		{#if list && memberCount > 0}
			<button
				type="button"
				onclick={toggleNotifications}
				disabled={notifLoading}
				class="w-full flex items-center gap-3 px-4 rounded-xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); height: 52px"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
				     stroke={notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if notificationsEnabled}
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					{:else}
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
						<line x1="1" y1="1" x2="23" y2="23"/>
					{/if}
				</svg>
				<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">Benachrichtigungen</span>
				<span class="text-xs font-medium" style="color: {notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}">
					{notificationsEnabled ? 'An' : 'Aus'}
				</span>
			</button>
		{/if}

		<!-- Icon Picker -->
		<IconPicker {selectedIconId} {name} onSelect={(id) => selectedIconId = id} />

		<div class="rounded-xl px-4 flex items-center" style="background-color: var(--color-surface-container); height: 52px">
			<input
				type="text"
				placeholder={t.list_description_placeholder}
				bind:value={description}
				class="w-full bg-transparent outline-none text-base"
				style="color: var(--color-on-surface); font-size: 16px"
			/>
		</div>

		<div class="rounded-xl px-4 flex items-center" style="background-color: var(--color-surface-container); height: 52px">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				placeholder={t.list_name_label}
				bind:value={name}
				autofocus
				onfocus={(e) => { const el = e.target as HTMLInputElement; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); }}
				class="w-full bg-transparent outline-none text-base font-medium"
				style="color: var(--color-on-surface); font-size: 16px"
			/>
		</div>
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
			onclick={() => name.trim() && onSave(name.trim(), description.trim(), selectedIconId, shareAfterCreate)}
			disabled={!name.trim()}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{list ? t.list_save : t.create}
		</button>
	</div>
</div>
