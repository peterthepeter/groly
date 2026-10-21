import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	consume: vi.fn<() => Promise<string | null>>(),
	store: vi.fn<(url: string) => Promise<void>>(),
	geofence: vi.fn<() => Promise<string | null>>(),
	resetLocation: vi.fn(),
	drain: vi.fn(),
	refreshSettings: vi.fn(),
	goto: vi.fn<(url: string) => Promise<void>>()
}));

vi.mock('#lib/pendingDeeplink', () => ({ consumePendingDeeplink: mocks.consume, setPendingDeeplink: mocks.store }));
vi.mock('#lib/locationNav', () => ({ findGeofenceMatch: mocks.geofence, resetLocationNavSession: mocks.resetLocation }));
vi.mock('#lib/sync/manager', () => ({ drainPendingMutations: mocks.drain }));
vi.mock('#lib/userSettings.svelte', () => ({ refreshActiveUserSettings: mocks.refreshSettings }));
vi.mock('$app/navigation', () => ({ goto: mocks.goto }));

import { initResumeOrchestrator } from './resumeOrchestrator';

function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>(done => { resolve = done; });
	return { promise, resolve };
}

let pageWindow: EventTarget;
let pageDocument: EventTarget;
let worker: EventTarget;
let visibility: 'visible' | 'hidden';
let address: { pathname: string; search: string };
let mailbox: string | null;

async function settle() {
	await vi.dynamicImportSettled();
	await vi.advanceTimersByTimeAsync(0);
}

function setVisibility(value: 'visible' | 'hidden') {
	visibility = value;
	pageDocument.dispatchEvent(new Event('visibilitychange'));
}

function nudge() {
	const event = new Event('message');
	Object.defineProperty(event, 'data', { value: { type: 'deeplink-nudge' } });
	worker.dispatchEvent(event);
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.setSystemTime(new Date('2026-10-21T08:00:00Z'));
	vi.resetAllMocks();
	pageWindow = new EventTarget();
	pageDocument = new EventTarget();
	worker = new EventTarget();
	visibility = 'visible';
	Object.defineProperty(pageDocument, 'visibilityState', { get: () => visibility });
	address = { pathname: '/listen/previous', search: '' };
	mailbox = null;
	vi.stubGlobal('window', pageWindow);
	vi.stubGlobal('document', pageDocument);
	vi.stubGlobal('navigator', { serviceWorker: worker });
	vi.stubGlobal('location', address);
	mocks.consume.mockImplementation(async () => {
		const url = mailbox;
		mailbox = null;
		return url;
	});
	mocks.store.mockImplementation(async url => { mailbox = url; });
	mocks.geofence.mockResolvedValue(null);
	mocks.goto.mockImplementation(async url => {
		const target = new URL(url, 'https://groly.example');
		address.pathname = target.pathname;
		address.search = target.search;
	});
});

afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
	vi.unstubAllGlobals();
});

describe('push and location navigation on resume', () => {
	it('checks location immediately on normal opening and again after backgrounding', async () => {
		mocks.geofence.mockResolvedValueOnce('first-shop').mockResolvedValueOnce('second-shop');
		initResumeOrchestrator();
		await settle();
		expect(mocks.goto).toHaveBeenLastCalledWith('/listen/first-shop');
		pageWindow.dispatchEvent(new Event('focus'));
		pageWindow.dispatchEvent(new Event('pageshow'));
		await settle();
		expect(mocks.geofence).toHaveBeenCalledTimes(1);
		setVisibility('hidden');
		setVisibility('visible');
		await settle();
		expect(mocks.geofence).toHaveBeenCalledTimes(2);
		expect(mocks.resetLocation).toHaveBeenCalledOnce();
		expect(mocks.goto).toHaveBeenLastCalledWith('/listen/second-shop');
	});

	it.each(['log-supplement', 'log-mood'])('opens %s from the mailbox without requesting location', async action => {
		mailbox = `/tracker?action=${action}`;
		initResumeOrchestrator();
		pageWindow.dispatchEvent(new Event('focus'));
		setVisibility('visible');
		await settle();
		expect(mocks.goto).toHaveBeenCalledExactlyOnceWith(`/tracker?action=${action}`);
		expect(mocks.geofence).not.toHaveBeenCalled();
	});

	it('honors a cold-start action URL before the mailbox becomes available', async () => {
		address = { pathname: '/tracker', search: '?action=log-mood' };
		vi.stubGlobal('location', address);
		initResumeOrchestrator();
		await settle();
		expect(mocks.geofence).not.toHaveBeenCalled();
		mailbox = '/tracker?action=log-mood';
		await vi.advanceTimersByTimeAsync(1000);
		expect(mailbox).toBeNull();
		expect(mocks.goto).not.toHaveBeenCalled();
	});

	it('uses the worker intent before a delayed mailbox read and resumes GPS on the next normal visit', async () => {
		initResumeOrchestrator();
		await settle();
		setVisibility('hidden');
		const read = deferred<string | null>();
		mocks.consume.mockReturnValueOnce(read.promise);
		nudge();
		setVisibility('visible');
		read.resolve(null);
		await settle();
		expect(mocks.geofence).toHaveBeenCalledTimes(1);
		mailbox = '/tracker?action=log-supplement';
		await vi.advanceTimersByTimeAsync(250);
		await settle();
		expect(mocks.goto).toHaveBeenLastCalledWith('/tracker?action=log-supplement');
		// The tracker removes the action after opening its sheet.
		address.search = '';
		await vi.advanceTimersByTimeAsync(1000);
		setVisibility('hidden');
		setVisibility('visible');
		await settle();
		expect(mocks.geofence).toHaveBeenCalledTimes(2);
	});

	it.each(['log-supplement', 'log-mood'])('never drops %s while a location navigation is in flight', async action => {
		const locationNavigation = deferred<void>();
		mocks.geofence.mockResolvedValue('shop');
		mocks.goto.mockImplementationOnce(() => locationNavigation.promise);
		initResumeOrchestrator();
		await settle();
		expect(mocks.goto).toHaveBeenCalledExactlyOnceWith('/listen/shop');
		mailbox = `/tracker?action=${action}`;
		nudge();
		await settle();
		expect(mailbox).toBeNull();
		locationNavigation.resolve();
		await settle();
		expect(mocks.goto.mock.calls.map(([url]) => url)).toEqual(['/listen/shop', `/tracker?action=${action}`]);
	});

	it('ignores a slow location result even long after the push has opened its destination', async () => {
		const position = deferred<string | null>();
		mocks.geofence.mockReturnValue(position.promise);
		initResumeOrchestrator();
		await settle();
		mailbox = '/tracker?action=log-mood';
		nudge();
		await settle();
		await vi.advanceTimersByTimeAsync(10_000);
		position.resolve('shop');
		await settle();
		expect(mocks.goto).toHaveBeenCalledExactlyOnceWith('/tracker?action=log-mood');
	});

	it('ignores location results from a previous foreground visit', async () => {
		const previousPosition = deferred<string | null>();
		mocks.geofence.mockReturnValueOnce(previousPosition.promise).mockResolvedValueOnce('current-shop');
		initResumeOrchestrator();
		await settle();
		setVisibility('hidden');
		setVisibility('visible');
		await settle();
		previousPosition.resolve('old-shop');
		await settle();
		expect(mocks.goto).toHaveBeenCalledExactlyOnceWith('/listen/current-shop');
	});

	it('preserves the target after a failed navigation so a later signal can retry', async () => {
		mailbox = '/tracker?action=log-supplement';
		mocks.goto.mockRejectedValueOnce(new Error('navigation failed'));
		initResumeOrchestrator();
		await settle();
		expect(mailbox).toBe('/tracker?action=log-supplement');
		pageWindow.dispatchEvent(new Event('focus'));
		await settle();
		expect(mailbox).toBeNull();
		expect(mocks.goto).toHaveBeenCalledTimes(2);
		expect(mocks.geofence).not.toHaveBeenCalled();
	});
});
