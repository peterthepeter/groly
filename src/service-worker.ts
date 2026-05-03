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
	// Deliberately NOT calling skipWaiting() here.
	// The app detects the waiting SW and prompts the user before reloading.
	//
	// Pre-cache the root page so we always have an app shell to fall back to
	// when the user navigates to an uncached route while offline.
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

self.addEventListener('notificationclick', (event) => {
	event.notification.close();
	const url: string = (event.notification.data as { url: string })?.url ?? '/';
	event.waitUntil(
		self.clients
			.matchAll({ type: 'window', includeUncontrolled: true })
			.then((clientList) => {
				for (const client of clientList) {
					if (client.url === url && 'focus' in client) return client.focus();
				}
				return self.clients.openWindow(url);
			})
	);
});
