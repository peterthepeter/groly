import { afterEach, describe, expect, it, vi } from 'vitest';
import { registerRoute } from 'workbox-routing';

vi.mock('workbox-precaching', () => ({ precacheAndRoute: vi.fn(), matchPrecache: vi.fn() }));
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn(), NavigationRoute: class {}, setCatchHandler: vi.fn() }));
vi.mock('workbox-strategies', () => ({ NetworkFirst: class {}, CacheFirst: class {}, StaleWhileRevalidate: class {} }));
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }));

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });

describe('service-worker account privacy', () => {
	it('drops old-account and legacy pushes after logout or account switching', async () => {
		const handlers = new Map<string, (event: unknown) => void>();
		const stored = new Map<string, Response>();
		const showNotification = vi.fn().mockResolvedValue(undefined);
		const openWindow = vi.fn();
		const NativeRequest = globalThis.Request;
		vi.stubGlobal('Request', class extends NativeRequest {
			constructor(input: RequestInfo | URL, init?: RequestInit) {
				super(typeof input === 'string' ? new URL(input, 'https://groly.example') : input, init);
			}
		});
		vi.stubGlobal('__GROLY_PAGE_CACHE__', 'pages-test-version');
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
		vi.stubGlobal('caches', {
			open: async () => ({ match: async (key: string) => stored.get(key)?.clone(), put: async (key: string, response: Response) => { stored.set(key, response.clone()); } }),
			keys: async () => [], delete: async () => true
		});
		vi.stubGlobal('self', {
			location: { origin: 'https://groly.example' }, __WB_MANIFEST: [],
			addEventListener: (type: string, handler: (event: unknown) => void) => handlers.set(type, handler),
			registration: { showNotification }, clients: { openWindow }
		});
		await import('../service-worker/service-worker');
		async function fire(type: string, event: Record<string, unknown>) {
			let pending = Promise.resolve();
			handlers.get(type)!({ ...event, waitUntil: (promise: Promise<void>) => { pending = promise; } });
			await pending;
		}
		const setAccount = (userId: string | null) => fire('message', { data: { type: 'SET_ACCOUNT', userId }, ports: [] });
		const push = (userId?: string) => fire('push', { data: { json: () => ({ title: 'Private reminder', body: 'Private details', userId }) } });
		await setAccount('alice'); await push('alice');
		expect(showNotification).toHaveBeenCalledTimes(1);
		await setAccount(null); await push('alice'); await push();
		expect(showNotification).toHaveBeenCalledTimes(1);
		await setAccount('bob'); await push('alice'); await push('bob');
		expect(showNotification).toHaveBeenCalledTimes(2);
		expect(showNotification.mock.calls[1][1].data.userId).toBe('bob');
		await fire('notificationclick', { notification: { close: vi.fn(), data: { userId: 'alice', url: '/tracker' } } });
		expect(openWindow).not.toHaveBeenCalled();

		// Compatibility with the installed 0.9.x client: CACHE_HOME can identify
		// the new account only from the authenticated network response.
		await setAccount('alice');
		const authenticated = (userId: string) => Object.defineProperty(new Response('<html></html>', { headers: { 'X-Groly-User': userId } }), 'url', { value: 'https://groly.example/' });
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(authenticated('bob')));
		await fire('message', { data: { type: 'CACHE_HOME' }, ports: [] });
		await push('alice'); await push('bob');
		expect(showNotification).toHaveBeenCalledTimes(3);
		expect(showNotification.mock.calls[2][1].data.userId).toBe('bob');

		// An older authenticated request finishing after logout cannot reactivate
		// that account's cached shell or its queued notifications.
		let finish!: (response: Response) => void;
		const waitingFetch = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
		vi.stubGlobal('fetch', waitingFetch);
		const pendingAccount = setAccount('alice');
		await vi.waitFor(() => expect(waitingFetch).toHaveBeenCalledTimes(1));
		await setAccount(null);
		finish(authenticated('alice'));
		await pendingAccount;
		await push('alice');
		expect(showNotification).toHaveBeenCalledTimes(3);

		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ ok: true })));
		await setAccount('alice');
		const route = vi.mocked(registerRoute).mock.calls.find(call => call[2] === 'POST');
		expect(route).toBeDefined();
		const logout = route![1] as (options: { request: Request }) => Promise<Response>;
		await logout({ request: new Request('https://groly.example/api/auth/logout', { method: 'POST' }) });
		await push('alice');
		expect(showNotification).toHaveBeenCalledTimes(3);
	});
});
