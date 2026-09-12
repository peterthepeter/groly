import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { parseRecipeHtml } from '$lib/server/recipeImport';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

function isPrivateIp(rawAddress: string): boolean {
	const address = rawAddress.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
	const mappedIpv4 = address.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/)?.[1];
	if (mappedIpv4) {
		const parts = mappedIpv4.split('.').map(Number);
		if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
		const [a, b, c] = parts;
		return a === 0
			|| a === 10
			|| a === 127
			|| (a === 100 && b >= 64 && b <= 127)
			|| (a === 169 && b === 254)
			|| (a === 172 && b >= 16 && b <= 31)
			|| (a === 192 && (b === 0 || b === 168))
			|| (a === 198 && (b === 18 || b === 19))
			|| (a === 198 && b === 51 && c === 100)
			|| (a === 203 && b === 0 && c === 113)
			|| a >= 224;
	}
	if (isIP(address) === 6) {
		return address === '::'
			|| address === '::1'
			|| address.startsWith('::ffff:')
			|| /^f[cd]/.test(address)
			|| /^fe[89ab]/.test(address)
			|| /^ff/.test(address);
	}
	return isIP(address) !== 4;
}

function parsePublicRecipeUrl(raw: string): URL | null {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return null;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	const host = parsed.hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || isPrivateIp(host)) return null;
	return parsed;
}

async function validateRecipeUrl(raw: string): Promise<URL | null> {
	const parsed = parsePublicRecipeUrl(raw);
	if (!parsed) return null;
	const host = parsed.hostname.toLowerCase();

	try {
		const addresses = await lookup(host, { all: true, verbatim: true });
		if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIp(address))) return null;
	} catch {
		return null;
	}
	return parsed;
}

async function readLimitedHtml(response: Response): Promise<string> {
	const declaredLength = Number(response.headers.get('content-length'));
	if (Number.isFinite(declaredLength) && declaredLength > MAX_PAGE_BYTES) throw new Error('PAGE_TOO_LARGE');
	if (!response.body) return '';

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let received = 0;
	let html = '';
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		received += value.byteLength;
		if (received > MAX_PAGE_BYTES) {
			await reader.cancel();
			throw new Error('PAGE_TOO_LARGE');
		}
		html += decoder.decode(value, { stream: true });
	}
	return html + decoder.decode();
}

async function fetchRecipePage(rawUrl: string): Promise<string> {
	let currentUrl = rawUrl;
	for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
		const validatedUrl = await validateRecipeUrl(currentUrl);
		if (!validatedUrl) throw new Error(redirectCount === 0 ? 'INVALID_URL' : 'INVALID_REDIRECT');

		const response = await fetch(validatedUrl, {
			redirect: 'manual',
			headers: {
				'User-Agent': 'Mozilla/5.0 (compatible; Groly/1.0)',
				Accept: 'text/html,application/xhtml+xml'
			},
			signal: AbortSignal.timeout(10000)
		});

		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const location = response.headers.get('location');
			if (!location) throw new Error('INVALID_REDIRECT');
			currentUrl = new URL(location, validatedUrl).href;
			continue;
		}
		if (!response.ok) throw new Error(`HTTP_${response.status}`);
		const contentType = response.headers.get('content-type')?.toLowerCase();
		if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
			throw new Error('UNSUPPORTED_CONTENT_TYPE');
		}
		return readLimitedHtml(response);
	}
	throw new Error('TOO_MANY_REDIRECTS');
}

export const POST: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	let rawUrl: unknown;
	try {
		rawUrl = (await event.request.json() as { url?: unknown }).url;
	} catch {
		return json({ error: 'INVALID_URL' }, { status: 400 });
	}
	if (typeof rawUrl !== 'string' || !rawUrl.trim()) return json({ error: 'INVALID_URL' }, { status: 400 });
	const sourceUrl = rawUrl.trim();
	if (!parsePublicRecipeUrl(sourceUrl)) return json({ error: 'INVALID_URL' }, { status: 400 });

	let html: string;
	try {
		html = await fetchRecipePage(sourceUrl);
	} catch (cause) {
		console.warn('[recipe-import] Page fetch failed', {
			host: new URL(sourceUrl).hostname,
			reason: cause instanceof Error ? cause.message : 'UNKNOWN'
		});
		return json({ error: 'PAGE_LOAD_FAILED' }, { status: 422 });
	}

	const recipe = parseRecipeHtml(html);
	if (!recipe) return json({ error: 'NO_RECIPE_FOUND' }, { status: 422 });
	return json({ ...recipe, sourceUrl });
};
