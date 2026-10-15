<script lang="ts">
	import { t } from '#lib/i18n.svelte';
	let { title, message, backHref = '/', backLabel, onRetry = () => location.reload() }: {
		title: string;
		message: string;
		backHref?: string;
		backLabel?: string;
		onRetry?: () => void;
	} = $props();
</script>

<section class="mx-auto flex min-h-[65dvh] w-full max-w-[430px] flex-col justify-end gap-6 px-6 pb-8 pt-12" data-offline-unavailable>
	<div role="status">
		<h1 class="text-xl font-semibold" style="color: var(--color-on-surface)">{title}</h1>
		<p class="mt-3 text-base leading-relaxed" style="color: var(--color-on-surface-variant)">{message}</p>
	</div>
	<div class="flex flex-wrap gap-3">
		<a href={backHref} class="flex min-h-11 flex-1 items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-semibold" style="background: var(--color-surface-container); color: var(--color-on-surface)">{backLabel ?? t.offline_home}</a>
		<button onclick={onRetry} class="min-h-11 flex-1 rounded-2xl px-4 py-3 text-sm font-semibold" style="background: var(--color-primary); color: var(--color-on-primary)">{t.offline_retry}</button>
	</div>
</section>
