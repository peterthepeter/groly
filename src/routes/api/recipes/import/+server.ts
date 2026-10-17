
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { parseRecipeHtml } from '#lib/server/recipeImport';
import { parsePublicRecipeUrl } from '#lib/server/recipeImportSecurity';
import { fetchPublicResource } from '#lib/server/publicNetwork';

async function fetchRecipePage(rawUrl: string): Promise<{ html: string; finalUrl: string }> {
	const { response, finalUrl } = await fetchPublicResource(rawUrl, 'text/html,application/xhtml+xml');
	if (!response.ok) throw new Error(`HTTP_${response.status}`);
	const contentType = response.headers.get('content-type')?.toLowerCase();
	if (contentType && !contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) throw new Error('UNSUPPORTED_CONTENT_TYPE');
	return { html: await response.text(), finalUrl };
}

export const POST: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	let rawUrl: unknown;
	try {
		rawUrl = (await event.request.json() as { url?: unknown }).url;
	} catch {
		return Response.json({ error: 'INVALID_URL' }, { status: 400 });
	}
	if (typeof rawUrl !== 'string' || !rawUrl.trim()) return Response.json({ error: 'INVALID_URL' }, { status: 400 });
	const sourceUrl = rawUrl.trim();
	if (!parsePublicRecipeUrl(sourceUrl)) return Response.json({ error: 'INVALID_URL' }, { status: 400 });

	let page: { html: string; finalUrl: string };
	try {
		page = await fetchRecipePage(sourceUrl);
	} catch (cause) {
		console.warn('[recipe-import] Page fetch failed', {
			host: new URL(sourceUrl).hostname,
			reason: cause instanceof Error ? cause.message : 'UNKNOWN'
		});
		return Response.json({ error: 'PAGE_LOAD_FAILED' }, { status: 422 });
	}

	const recipe = parseRecipeHtml(page.html, page.finalUrl);
	if (!recipe) return Response.json({ error: 'NO_RECIPE_FOUND' }, { status: 422 });
	return Response.json({ ...recipe, sourceUrl });
};
