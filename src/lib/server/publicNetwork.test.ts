import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { gzipSync } from 'node:zlib';
import { request } from 'node:http';
import { lookup } from 'dns/promises';
import type { LookupAddress } from 'node:dns';
import { fetchPublicResource, pinnedLookup, publicPushAgent } from './publicNetwork';

vi.mock('dns/promises', () => ({ lookup: vi.fn() }));
vi.mock('node:http', () => ({ request: vi.fn() }));

const connected: unknown[] = [];
const allLookup = vi.mocked(lookup as (host: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]>);
function reply(status: number, headers: Record<string, string>, body = Buffer.from('ok')) {
	vi.mocked(request).mockImplementationOnce(((url: URL, options: { lookup: ReturnType<typeof pinnedLookup>; signal: AbortSignal }, callback: (response: PassThrough) => void) => {
		const req = new EventEmitter() as EventEmitter & { end: () => void };
		req.end = () => {
			options.lookup(url.hostname, { all: true }, (error, addresses) => {
				if (error) { req.emit('error', error); return; }
				connected.push(addresses);
				const incoming = Object.assign(new PassThrough(), { statusCode: status, headers });
				const abort = () => incoming.destroy(new Error('aborted'));
				options.signal.addEventListener('abort', abort, { once: true });
				incoming.on('close', () => options.signal.removeEventListener('abort', abort));
				callback(incoming);
				incoming.end(body);
			});
		};
		return req;
	}) as unknown as typeof request);
}

beforeEach(() => {
	vi.clearAllMocks(); connected.length = 0;
	allLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
});

describe('public outbound connections', () => {
	it('connects using the checked IP while preserving the original hostname', async () => {
		reply(200, { 'content-type': 'text/html' }, Buffer.from('<h1>recipe</h1>'));
		const { response, finalUrl } = await fetchPublicResource('http://recipes.example/test');
		expect(await response.text()).toContain('recipe');
		expect(finalUrl).toBe('http://recipes.example/test');
		expect(connected).toEqual([[{ address: '93.184.216.34', family: 4 }]]);
		expect(lookup).toHaveBeenCalledTimes(1);
		expect(vi.mocked(request).mock.calls[0][0]).toEqual(new URL('http://recipes.example/test'));
	});

	it('rejects mixed public/private DNS answers before connecting', async () => {
		allLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }, { address: '127.0.0.1', family: 4 }]);
		await expect(fetchPublicResource('http://rebind.example/test')).rejects.toThrow('URL_NOT_ALLOWED');
		expect(request).not.toHaveBeenCalled();
	});

	it('rechecks redirect destinations and blocks an internal redirect', async () => {
		reply(302, { location: 'http://127.0.0.1/internal' });
		await expect(fetchPublicResource('http://recipes.example/test')).rejects.toThrow('URL_NOT_ALLOWED');
		expect(request).toHaveBeenCalledTimes(1);
	});

	it('follows public redirects and limits decompressed response size', async () => {
		reply(302, { location: '/final' });
		reply(200, { 'content-type': 'text/html' }, Buffer.from('final recipe'));
		expect((await fetchPublicResource('http://recipes.example/start')).finalUrl).toBe('http://recipes.example/final');
		reply(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' }, gzipSync('a'.repeat(1024)));
		await expect(fetchPublicResource('http://recipes.example/large', 'text/html', 1000, 128)).rejects.toThrow('PAGE_TOO_LARGE');
	});

	it('rejects private push endpoints and retains support for arbitrary public HTTPS push providers', async () => {
		await expect(publicPushAgent('https://[::1]/push')).rejects.toThrow('URL_NOT_ALLOWED');
		await expect(publicPushAgent('http://push.example/send')).rejects.toThrow('HTTPS_REQUIRED');
		const agent = await publicPushAgent('https://custom-push.example/send');
		expect(agent.options.lookup).toBeTypeOf('function');
		agent.destroy();
	});
});
