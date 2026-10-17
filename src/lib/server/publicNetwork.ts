import { request as httpRequest } from 'node:http';
import { Agent, request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib';
import { resolvePublicUrl } from './recipeImportSecurity';

type Addresses = NonNullable<Awaited<ReturnType<typeof resolvePublicUrl>>>['addresses'];

/** DNS is resolved and checked once, then that exact result is used to connect. */
export function pinnedLookup(addresses: Addresses): LookupFunction {
	return (_hostname, options, callback) => {
		const candidates = options.family ? addresses.filter(entry => entry.family === options.family) : addresses;
		if (!candidates.length) { callback(new Error('No public address for this address family'), '', 4); return; }
		if (options.all) callback(null, candidates);
		else callback(null, candidates[0].address, candidates[0].family);
	};
}

async function publicTarget(raw: string, signal: AbortSignal) {
	signal.throwIfAborted();
	const target = await new Promise<Awaited<ReturnType<typeof resolvePublicUrl>>>((resolve, reject) => {
		const abort = () => reject(signal.reason);
		signal.addEventListener('abort', abort, { once: true });
		resolvePublicUrl(raw).then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
	});
	signal.throwIfAborted();
	if (!target) throw new Error('URL_NOT_ALLOWED');
	return target;
}

export async function publicPushAgent(raw: string): Promise<Agent> {
	const target = await publicTarget(raw, AbortSignal.timeout(10_000));
	if (target.url.protocol !== 'https:') throw new Error('HTTPS_REQUIRED');
	return new Agent({ lookup: pinnedLookup(target.addresses), keepAlive: false });
}

export async function fetchPublicResource(raw: string, accept = 'text/html', timeoutMs = 12_000, maxBytes = 3 * 1024 * 1024): Promise<{ response: Response; finalUrl: string }> {
	const signal = AbortSignal.timeout(timeoutMs);
	let current = raw;
	for (let redirects = 0; redirects <= 5; redirects++) {
		const { url, addresses } = await publicTarget(current, signal);
		const result = await new Promise<{ redirect?: string; response?: Response }>((resolve, reject) => {
			const send = url.protocol === 'https:' ? httpsRequest : httpRequest;
			const req = send(url, {
				agent: false, lookup: pinnedLookup(addresses), signal,
				headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Groly/1.0)', Accept: accept, 'Accept-Encoding': 'gzip, deflate, br' }
			}, async incoming => {
				try {
					const status = incoming.statusCode ?? 502;
					if ([301, 302, 303, 307, 308].includes(status)) {
						const location = incoming.headers.location;
						incoming.destroy();
						if (!location) throw new Error('INVALID_REDIRECT');
						resolve({ redirect: new URL(location, url).href });
						return;
					}
					if (Number(incoming.headers['content-length']) > maxBytes) throw new Error('PAGE_TOO_LARGE');
					const encoding = incoming.headers['content-encoding'];
					const decoder = encoding === 'gzip' ? createGunzip() : encoding === 'br' ? createBrotliDecompress() : encoding === 'deflate' ? createInflate() : null;
					if (decoder) incoming.on('error', error => decoder.destroy(error));
					const stream = decoder ? incoming.pipe(decoder) : incoming;
					const chunks: Buffer[] = [];
					let size = 0;
					for await (const chunk of stream) {
						size += chunk.length;
						if (size > maxBytes) throw new Error('PAGE_TOO_LARGE');
						chunks.push(Buffer.from(chunk));
					}
					resolve({ response: new Response([204, 205, 304].includes(status) ? null : Buffer.concat(chunks), {
						status, headers: { 'Content-Type': incoming.headers['content-type'] ?? 'application/octet-stream' }
					}) });
				} catch (error) { incoming.destroy(); reject(error); }
			});
			req.on('error', reject);
			req.end();
		});
		if (result.redirect) { current = result.redirect; continue; }
		return { response: result.response!, finalUrl: url.href };
	}
	throw new Error('TOO_MANY_REDIRECTS');
}
