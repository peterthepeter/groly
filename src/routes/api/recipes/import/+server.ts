import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { parseRecipeHtml } from '$lib/server/recipeImport';
import { parsePublicRecipeUrl, validateResolvedRecipeUrl } from '$lib/server/recipeImportSecurity';

const MAX_REDIRECTS = 5;
const MAX_PAGE_BYTES = 3 * 1024 * 1024;

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

async function fetchRecipePage(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
	let currentUrl = rawUrl;
	for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
		const validatedUrl = await validateResolvedRecipeUrl(currentUrl);
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
			await response.body?.cancel();
			currentUrl = new URL(location, validatedUrl).href;
			continue;
		}
		if (!response.ok) throw new Error(`HTTP_${response.status}`);
		const contentType = response.headers.get('content-type')?.toLowerCase();
		if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
			throw new Error('UNSUPPORTED_CONTENT_TYPE');
		}
		return { html: await readLimitedHtml(response), finalUrl: validatedUrl.href };
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

	let page: { html: string; finalUrl: string };
	try {
		page = await fetchRecipePage(sourceUrl);
	} catch (cause) {
		console.warn('[recipe-import] Page fetch failed', {
			host: new URL(sourceUrl).hostname,
			reason: cause instanceof Error ? cause.message : 'UNKNOWN'
		});
		return json({ error: 'PAGE_LOAD_FAILED' }, { status: 422 });
	}

	const recipe = parseRecipeHtml(page.html, page.finalUrl);
	if (!recipe) return json({ error: 'NO_RECIPE_FOUND' }, { status: 422 });
	return json({ ...recipe, sourceUrl });
};
