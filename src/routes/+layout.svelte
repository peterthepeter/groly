<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { initLanguage, currentLang } from '$lib/i18n.svelte';
	import { dispatch } from '$lib/sseStore.svelte';
	import { initUpdateDetection, checkForUpdate } from '$lib/stores/pwa.svelte';
	import { afterNavigate } from '$app/navigation';
	import WhatsNewModal from '$lib/components/WhatsNewModal.svelte';
	import ShortcutMenu from '$lib/components/ShortcutMenu.svelte';
	import { shortcuts, shortcutMenu } from '$lib/shortcuts.svelte';
	import { LATEST_CHANGES } from '$lib/changelog';
	import { userSettings } from '$lib/userSettings.svelte';

	let whatsNewOpen = $state(false);

	let { data, children } = $props();

	afterNavigate(() => { checkForUpdate(); shortcutMenu.hide(); });

	function applyTheme(theme: 'system' | 'light' | 'dark') {
		if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
		else if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
		else document.documentElement.removeAttribute('data-theme');
	}

	$effect(() => { applyTheme(userSettings.theme); });

	onMount(() => {
		initLanguage();
		initUpdateDetection();

// "Was ist neu" nach Update anzeigen – nur wenn eingeloggt
		if (data.user) {
			const lastVersion = localStorage.getItem('groly_last_version');
			if (lastVersion && lastVersion !== LATEST_CHANGES.version) {
				whatsNewOpen = true;
			}
			localStorage.setItem('groly_last_version', LATEST_CHANGES.version);
		}

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

<!--
	iOS keyboard bridge: focused synchronously in the shortcut gesture handler
	before goto() so that iOS keeps the keyboard context alive across navigation.
	Focus then transfers to the real input when AddItemBar mounts.
-->
<input
	id="ios-keyboard-bridge"
	type="text"
	aria-hidden="true"
	readonly
	tabindex="-1"
	style="position:fixed; left:-9999px; top:0; opacity:0; pointer-events:none; width:1px; height:1px;"
/>

{#if whatsNewOpen}
	<WhatsNewModal
		version={LATEST_CHANGES.version}
		items={currentLang() === 'en' ? LATEST_CHANGES.en : LATEST_CHANGES.de}
		onClose={() => { whatsNewOpen = false; }}
	/>
{/if}

<!-- ShortcutMenu at root level — avoids BottomNav's z-30 stacking context -->
{#if shortcutMenu.open}
	<ShortcutMenu shortcuts={shortcuts.list} onClose={shortcutMenu.hide} />
{/if}
