import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Temporary diagnostic sink. Activated only when GROLY_DEBUG env var is set.
// All other requests are silently dropped. To be removed after diagnosis.
export const POST: RequestHandler = async ({ request }) => {
	if (!process.env.GROLY_DEBUG) return json({ ok: false });
	try {
		const { msg } = (await request.json()) as { msg?: string };
		if (typeof msg === 'string') {
			const safe = msg.replace(/[\r\n]+/g, ' ').slice(0, 500);
			console.log(`[groly:dbg] ${safe}`);
		}
	} catch { /* ignore malformed */ }
	return json({ ok: true });
};
