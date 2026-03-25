<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLanguage } from '$lib/i18n.svelte';

	let { children } = $props();

	onMount(async () => {
		initLanguage();
		// Re-register push subscription once per day. Prevents lost subscriptions if the
		// server DB loses the entry (e.g. after a redeploy that cleared data, or a 410 cleanup).
		if (
			'serviceWorker' in navigator &&
			'PushManager' in window &&
			Notification.permission === 'granted'
		) {
			const THROTTLE_KEY = 'groly_push_reregister';
			const last = parseInt(localStorage.getItem(THROTTLE_KEY) ?? '0', 10);
			if (Date.now() - last > 86_400_000) {
				try {
					const reg = await navigator.serviceWorker.ready;
					const sub = await reg.pushManager.getSubscription();
					if (sub) {
						const json = sub.toJSON();
						fetch('/api/push/subscribe', {
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
						}).catch(() => {});
						localStorage.setItem(THROTTLE_KEY, String(Date.now()));
					}
				} catch { /* ignore */ }
			}
		}
	});
</script>

<svelte:head>
	<title>Groly</title>
</svelte:head>

<div class="max-w-[430px] mx-auto relative">
	{@render children()}
</div>
