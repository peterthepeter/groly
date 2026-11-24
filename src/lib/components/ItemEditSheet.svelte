<script lang="ts">
	import type { Snippet } from 'svelte';
	import { t } from '#lib/i18n.svelte';

	let { title, saveLabel, fields, onSave, onClose, onDelete, onToggleFavorite, deleteLabel = t.a11y_delete_item,
		isFavorite = false, saveDisabled = false, busy = false, error, bottomOffset }: {
		title: string;
		saveLabel?: string;
		fields: Snippet;
		onSave?: () => void;
		onClose: () => void;
		onDelete?: (() => void) | null;
		onToggleFavorite?: (() => void) | null;
		deleteLabel?: string;
		isFavorite?: boolean;
		saveDisabled?: boolean;
		busy?: boolean;
		error?: string | null;
		bottomOffset?: number;
	} = $props();
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50" style="background-color: rgba(0,0,0,0.6)" onclick={onClose}></div>

<div class="fixed bottom-0 left-0 right-0 z-[60] max-w-[430px] mx-auto rounded-t-3xl px-6 pb-5 pt-3"
     class:viewport-aware={bottomOffset !== undefined}
     style="background-color: var(--modal-bg)" style:bottom={bottomOffset === undefined ? undefined : `${bottomOffset}px`}
     style:--edit-keyboard-offset={bottomOffset === undefined ? undefined : `${bottomOffset}px`}>
	<div class="flex justify-center mb-3">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<div class="flex items-center justify-between mb-3">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{title}</h2>
		{#if onDelete}
			<button
				type="button"
				onclick={onDelete}
				class="w-9 h-9 rounded-xl flex items-center justify-center transition-colors active:scale-95"
				style="color: #ef4444"
				aria-label={deleteLabel}
				disabled={busy || undefined}
			>
				<svg width="17" height="17" viewBox="0 0 24 24" fill="none"
				     stroke="currentColor" stroke-width="2"
				     stroke-linecap="round" stroke-linejoin="round">
					<polyline points="3 6 5 6 21 6"/>
					<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
					<path d="M10 11v6M14 11v6"/>
					<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="rounded-2xl mb-3 overflow-hidden edit-fields" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
		{@render fields()}
	</div>

	{#if error}<p role="alert" class="text-sm mb-3" style="color: var(--color-error)">{error}</p>{/if}
	<div class="flex items-center gap-2">
		{#if onToggleFavorite}
			<button
				type="button"
				onpointerdown={(e) => e.preventDefault()}
				onclick={onToggleFavorite}
				disabled={busy || undefined}
				aria-pressed={bottomOffset === undefined ? undefined : isFavorite}
				class="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-colors"
				style="background-color: {isFavorite ? 'color-mix(in srgb, var(--color-primary) 18%, transparent)' : 'var(--bubble-interactive-bg)'};
				       border: 1px solid {isFavorite ? 'var(--color-primary)' : 'var(--bubble-interactive-border)'};
				       color: {isFavorite ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}"
				aria-label={isFavorite ? t.favorites_remove : t.favorites_add}
			>
				<svg width="18" height="18" viewBox="0 0 24 24"
				     fill={isFavorite ? 'currentColor' : 'none'}
				     stroke="currentColor" stroke-width="1.8"
				     stroke-linecap="round" stroke-linejoin="round">
					<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
				</svg>
			</button>
		{/if}
		<button
			onclick={onClose}
			disabled={busy || undefined}
			class="flex-1 py-3 rounded-full text-sm font-semibold"
			style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface-variant)"
		>
			{onSave ? t.item_cancel : t.close}
		</button>
		{#if onSave}<button
			onclick={onSave}
			disabled={saveDisabled || busy}
			class="flex-1 py-3 rounded-full text-sm font-semibold disabled:opacity-40"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{saveLabel}
		</button>{/if}
	</div>
</div>

<style>
	.viewport-aware {
		display: flex;
		flex-direction: column;
		max-height: min(90dvh, calc(100dvh - var(--edit-keyboard-offset)));
		padding-bottom: max(1.25rem, env(safe-area-inset-bottom, 0px));
	}
	.viewport-aware > :not(.edit-fields) { flex-shrink: 0; }
	.viewport-aware .edit-fields { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
</style>
