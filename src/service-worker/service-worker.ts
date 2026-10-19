/// <reference lib="webworker" />
declare const self: ServiceWorkerGlobalScope;

import { precacheAndRoute, matchPrecache } from 'workbox-precaching';
import { registerRoute, NavigationRoute, setCatchHandler } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
declare const __GROLY_PAGE_CACHE__: string;

// self.__WB_MANIFEST is injected by vite-plugin-pwa at build time.
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

// Authenticated documents and loader responses are partitioned by account.
// Static assets remain shared; pending mutations live independently in IndexedDB.
const ACCOUNT_STATE = 'groly-account-state';
const ACCOUNT_KEY = new URL('/__groly_account__', self.location.origin).href;
let accountGeneration = 0;
let accountWrites = Promise.resolve();
let account: Promise<string | null> = caches.open(ACCOUNT_STATE)
	.then(cache => cache.match(ACCOUNT_KEY))
	.then(async response => response ? (await response.json()).userId as string | null : null);

function pageCache(userId: string) { return `${__GROLY_PAGE_CACHE__}-user-${encodeURIComponent(userId)}`; }
function dataCache(userId: string) { return `account-data-${encodeURIComponent(userId)}`; }

async function saveAccount(userId: string | null) {
	accountGeneration++;
	account = Promise.resolve(userId);
	accountWrites = accountWrites.then(async () => {
		await (await caches.open(ACCOUNT_STATE)).put(ACCOUNT_KEY, Response.json({ userId }));
	});
	await accountWrites;
}

function accountStrategy(userId: string, data = false) {
	return new NetworkFirst({
		cacheName: data ? dataCache(userId) : pageCache(userId),
		networkTimeoutSeconds: 5,
		plugins: [
			{ cacheWillUpdate: async ({ response }) => response.status === 200 && !response.redirected && response.headers.get('X-Groly-User') === userId ? response : null },
			new ExpirationPlugin({ maxEntries: data ? 30 : 20, maxAgeSeconds: 7 * 24 * 60 * 60 })
		]
	});
}

// Also clear the worker's identity for installed pre-1.0 clients, whose logout
// code does not send SET_ACCOUNT. Push APIs must never be needed to sign out.
registerRoute(
	({ url }) => url.origin === self.location.origin && url.pathname === '/api/auth/logout',
	async ({ request }) => {
		const response = await fetch(request);
		if (response.ok) await saveAccount(null);
		return response;
	},
	'POST'
);

registerRoute(
	({ url }) => url.pathname.endsWith('/__data.json') && !/^\/(login|invite)(\/|$)/.test(url.pathname),
	async options => {
		const userId = await account;
		return userId ? accountStrategy(userId, true).handle(options) : fetch(options.request);
	}
);
registerRoute(new NavigationRoute(async options => {
	const userId = await account;
	return userId ? accountStrategy(userId).handle(options) : fetch(options.request);
}, { denylist: [/^\/api\//, /^\/(login|invite|install)(\/|$)/] }));

// A home-page SSR document is not a generic app shell: serving it under a
// recipe URL hydrates the wrong route and used to resolve CSS/JS incorrectly.
// The fallback works independently of application JS, fonts and server loaders.
setCatchHandler(async ({ request }) => {
	if (request.destination === 'document') {
		const fallback = await matchPrecache('/offline.html');
		if (fallback) return fallback;
	}
	return Response.error();
});

async function cacheHome(allowAccountChange = false) {
	const generation = accountGeneration;
	const expectedUser = await account;
	try {
		const response = await fetch(new Request('/', { cache: 'reload', credentials: 'same-origin' }));
		const userId = response.headers.get('X-Groly-User');
		if (generation === accountGeneration && (allowAccountChange || !expectedUser || expectedUser === userId) && response.ok && !response.redirected && userId && new URL(response.url).pathname === '/') {
			await saveAccount(userId);
			await (await caches.open(pageCache(userId))).put('/', response);
		}
	} catch { /* Keep the current account's shell available offline. */ }
}

self.addEventListener('install', event => {
	self.skipWaiting();
	event.waitUntil(cacheHome(true));
});
self.addEventListener('activate', event => event.waitUntil((async () => {
	for (const name of await caches.keys()) {
		// Legacy caches have no trustworthy account label. These are server-read
		// responses only; IndexedDB and every pending write are preserved.
		if (name === 'pages' || (name.startsWith('pages-') && !name.startsWith(`${__GROLY_PAGE_CACHE__}-user-`))) await caches.delete(name);
	}
	await self.clients.claim();
})()));
self.addEventListener('message', event => {
	const data = event.data as { type?: string; userId?: unknown };
	if (data?.type === 'SET_ACCOUNT' && (data.userId === null || typeof data.userId === 'string')) {
		event.waitUntil((async () => {
			await saveAccount(data.userId as string | null);
			event.ports[0]?.postMessage({ ok: true });
			if (data.userId) await cacheHome();
		})());
	}
	// Old installed clients send CACHE_HOME rather than SET_ACCOUNT. Derive their
	// account only from the authenticated server response, never from cached HTML.
	if (data?.type === 'CACHE_HOME') event.waitUntil(cacheHome(true));
	if (data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('push', (event) => {
	if (!event.data) return;
	const data = event.data.json() as { title: string; body: string; url?: string; tag?: string; userId?: string };
	event.waitUntil(
		(async () => {
			if (!data.userId || data.userId !== await account) return;
			await self.registration.showNotification(data.title, {
				body: data.body,
				icon: '/icons/icon-192.png',
				badge: '/icons/icon-192.png',
				tag: data.tag,
				data: { url: data.url ?? '/', userId: data.userId }
			});
		})()
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
		const notificationUser = (event.notification.data as { userId?: string })?.userId;
		if (!notificationUser || notificationUser !== await account) return;
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
