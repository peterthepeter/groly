<script lang="ts">
	import { page } from '$app/state';
	import { t } from '#lib/i18n.svelte';
	import { networkStore } from '#lib/stores/online.svelte';
	import UnavailableView from '#lib/components/UnavailableView.svelte';
	const offline = $derived(!networkStore.online || !networkStore.serverReachable);
</script>

<UnavailableView
	title={offline ? t.offline_title : t.page_unavailable_title}
	message={offline ? t.offline_page_message : t.page_unavailable_message}
	backHref={page.url.pathname.startsWith('/rezepte/') ? '/rezepte' : '/'}
	backLabel={page.url.pathname.startsWith('/rezepte/') ? t.offline_recipes : t.offline_home}
/>
