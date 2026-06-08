/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

// Precache all static assets emitted by Vite (JS, CSS, icons, etc.)
// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time
declare global {
	interface ServiceWorkerGlobalScope {
		__WB_MANIFEST: Array<{ url: string; revision: string | null }>;
	}
}
precacheAndRoute(self.__WB_MANIFEST);

// Cache-first for SvelteKit immutable assets (content-hashed, never change)
registerRoute(
	({ url }) => url.pathname.startsWith('/_app/immutable/'),
	new CacheFirst({
		cacheName: 'immutable-assets',
		plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 365 * 24 * 60 * 60 })]
	})
);

// StaleWhileRevalidate for icons and other static files
registerRoute(
	({ url }) => url.pathname.startsWith('/icons/') || url.pathname.endsWith('.png') || url.pathname.endsWith('.svg'),
	new StaleWhileRevalidate({ cacheName: 'static-assets' })
);

// Cache all images (including external recipe images) on first load so they're
// available offline. StaleWhileRevalidate serves from cache instantly and
// refreshes in the background when online.
registerRoute(
	({ request }) => request.destination === 'image',
	new StaleWhileRevalidate({
		cacheName: 'images',
		plugins: [new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 })]
	})
);

// Cache SvelteKit server-load responses (__data.json) so offline navigation works
// after the user has visited a page at least once while online.
registerRoute(
	({ url }) => url.pathname.endsWith('/__data.json'),
	new NetworkFirst({
		cacheName: 'pages',
		networkTimeoutSeconds: 5,
		plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 7 * 24 * 60 * 60 })]
	})
);

// Navigation requests (full page loads): NetworkFirst with cache fallback
// This ensures the app shell loads offline from cache
registerRoute(
	new NavigationRoute(
		new NetworkFirst({
			cacheName: 'pages',
			networkTimeoutSeconds: 5,
			plugins: [new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 7 * 24 * 60 * 60 })]
		}),
		// Don't intercept API routes
		{ denylist: [/^\/api\//] }
	)
);

// When a navigation request fails (no network, no cached page), serve the cached
// root page as the app shell. SvelteKit's client-side router then takes over and
// renders the correct route — data loading falls back to IndexedDB where available.
setCatchHandler(async ({ request }) => {
	if (request.destination === 'document') {
		const cache = await caches.open('pages');
		const shell = await cache.match('/');
		if (shell) return shell;
	}
	return Response.error();
});

self.addEventListener('install', (event) => {
	self.skipWaiting();
	event.waitUntil(
		caches.open('pages').then(cache =>
			cache.add(new Request('/', { cache: 'reload' })).catch(() => {})
		)
	);
});
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('message', (event) => {
	if ((event.data as { type?: string })?.type === 'SKIP_WAITING') {
		self.skipWaiting();
	}
});

self.addEventListener('push', (event) => {
	if (!event.data) return;
	const data = event.data.json() as { title: string; body: string; url?: string; tag?: string };
	event.waitUntil(
		self.registration.showNotification(data.title, {
			body: data.body,
			icon: '/icons/icon-192.png',
			badge: '/icons/icon-192.png',
			tag: data.tag,
			data: { url: data.url ?? '/' }
		})
	);
});

// Inline-IDB-Helper: schreibt den Deep-Link in die persistente "groly-deeplink"-IDB.
// Das ist der EINZIGE auf iOS zuverlässige Zustellweg (überlebt jede Suspend-Tiefe).
// Schema-Konstanten (DB-Name, Store-Name, Key) müssen mit src/lib/pendingDeeplink.ts
// identisch bleiben.
function swSetPendingDeeplink(url: string): Promise<void> {
	return new Promise((resolve) => {
		try {
			const req = indexedDB.open('groly-deeplink', 1);
			req.onupgradeneeded = () => req.result.createObjectStore('pending');
			req.onsuccess = () => {
				const db = req.result;
				const tx = db.transaction('pending', 'readwrite');
				tx.objectStore('pending').put({ url, ts: Date.now() }, 'current');
				tx.oncomplete = () => { db.close(); resolve(); };
				tx.onerror = () => { db.close(); resolve(); };
			};
			req.onerror = () => resolve();
		} catch { resolve(); }
	});
}

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url: string = (event.notification.data as { url: string })?.url ?? '/';
	event.waitUntil((async () => {
		// Die EINE Wahrheit: Deep-Link in die persistente IDB-Mailbox schreiben.
		// Passiert in JEDEM Fall (kalt/warm/Suspend); die App liest sie beim Aufwachen
		// geduldig aus (resumeOrchestrator), denn dieser Write committet nach langem
		// Suspend erst 2-5 s nach dem Antippen.
		await swSetPendingDeeplink(url);

		const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
		const client =
			(clientsList.find((c) => (c as WindowClient).focused) as WindowClient | undefined) ??
			(clientsList[0] as WindowClient | undefined);
		if (client) {
			// App läuft schon (Hintergrund/Standby) → nach vorne holen UND anstupsen.
			// Der Nudge ist KEIN eigener Kanal, nur ein Trigger: er sagt der App "lies
			// die Mailbox". Im Warm-Fall wirkt er sofort, auch wenn visibilitychange
			// (vom Sperrbildschirm aus) nicht feuert. client.navigate() vom SW ist auf
			// iOS-PWA ein No-Op und wird daher nicht genutzt.
			try { client.postMessage({ type: 'deeplink-nudge' }); } catch { /* egal */ }
			try { await client.focus(); } catch { /* focus evtl. nicht erlaubt */ }
		} else {
			// Echter Kaltstart → neues Fenster öffnen. Beim Mount liest sie die Mailbox.
			await self.clients.openWindow(url);
		}
	})());
});
