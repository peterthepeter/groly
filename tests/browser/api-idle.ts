import { expect, type Page, type Request } from '@playwright/test';

export function trackApiReads(page: Page) {
	const pending = new Set<Request>();
	let lastActivity = 0;
	page.on('request', request => {
		const { pathname } = new URL(request.url());
		if (request.method() !== 'GET' || !pathname.startsWith('/api/') || pathname === '/api/events' || pathname === '/api/ping') return;
		pending.add(request);
		lastActivity = Date.now();
	});
	const complete = (request: Request) => {
		if (pending.delete(request)) lastActivity = Date.now();
	};
	page.on('requestfinished', complete);
	page.on('requestfailed', complete);
	return async () => {
		// Account and list hydration can start another fetch after a response is read.
		const started = Date.now();
		await expect.poll(() => {
			if (pending.size > 0) return [...pending].map(request => new URL(request.url()).pathname);
			return Date.now() - Math.max(started, lastActivity) >= 250 ? [] : ['Waiting for deferred API reads'];
		}).toEqual([]);
	};
}
