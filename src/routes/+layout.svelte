<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLanguage } from '$lib/i18n.svelte';
	import { dispatch } from '$lib/sseStore.svelte';
	import { initUpdateDetection } from '$lib/stores/pwa.svelte';

	let { data, children } = $props();

	onMount(() => {
		initLanguage();
		initUpdateDetection();

		// Re-register push subscription once per day (fire-and-forget, kein await nötig)
		void (async () => {
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
		})();

		// Globaler SSE-Kanal — nur wenn eingeloggt
		if (!data.user) return;

		let sse: EventSource | null = null;
		let retryDelay = 1000;
		let retryTimeout: ReturnType<typeof setTimeout> | null = null;
		let connected = false;

		function connectSSE() {
			sse = new EventSource('/api/events');
			sse.onopen = () => {
				retryDelay = 1000;
				if (connected) dispatch({ type: 'sse_connected' });
				connected = true;
			};
			sse.onmessage = (e) => {
				try { dispatch(JSON.parse(e.data)); } catch { /* JSON-Parse-Fehler ignorieren */ }
			};
			sse.onerror = () => {
				sse?.close();
				retryTimeout = setTimeout(connectSSE, retryDelay);
				retryDelay = Math.min(retryDelay * 2, 30_000);
			};
		}

		function handleOnline() {
			if (retryTimeout !== null) { clearTimeout(retryTimeout); retryTimeout = null; }
			if (!sse || sse.readyState === EventSource.CLOSED) connectSSE();
		}

		connectSSE();
		window.addEventListener('online', handleOnline);

		return () => {
			sse?.close();
			if (retryTimeout !== null) clearTimeout(retryTimeout);
			window.removeEventListener('online', handleOnline);
		};
	});
</script>

<svelte:head>
	<title>Groly</title>
</svelte:head>

<div class="max-w-[430px] mx-auto relative">
	{@render children()}
</div>
