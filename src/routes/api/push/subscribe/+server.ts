
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { pushSubscriptions } from '#lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { ECDH, randomBytes } from 'crypto';
import { parsePublicRecipeUrl } from '#lib/server/recipeImportSecurity';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { endpoint, keys } = await event.request.json();
	const url = typeof endpoint === 'string' && endpoint.length <= 4096 ? parsePublicRecipeUrl(endpoint) : null;
	if (!url || url.protocol !== 'https:' || typeof keys?.auth !== 'string' || typeof keys?.p256dh !== 'string' || !/^[A-Za-z0-9_-]{22}={0,2}$/.test(keys.auth) || !/^[A-Za-z0-9_-]{87}={0,2}$/.test(keys.p256dh)) {
		return Response.json({ error: 'Ungültige Subscription' }, { status: 400 });
	}
	try { ECDH.convertKey(Buffer.from(keys.p256dh, 'base64url'), 'prime256v1'); }
	catch { return Response.json({ error: 'Ungültige Subscription' }, { status: 400 }); }

	const id = randomBytes(12).toString('base64url');
	const ts = Math.floor(Date.now() / 1000);

	// Upsert by endpoint: each device/browser context keeps its own subscription.
	// Multiple devices → multiple rows → each device gets notified independently.
	const stored = db.insert(pushSubscriptions)
		.values({ id, userId: user!.id, endpoint, auth: keys.auth, p256dh: keys.p256dh, createdAt: ts })
		.onConflictDoUpdate({
			target: pushSubscriptions.endpoint,
			set: { userId: user!.id, auth: keys.auth, p256dh: keys.p256dh, createdAt: ts }
		})
		.returning({ id: pushSubscriptions.id }).get()!;
	event.cookies.set('push_device', stored.id, {
		path: '/', httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 365,
		secure: process.env.ORIGIN?.startsWith('https://') ?? false
	});

	return Response.json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { endpoint } = await event.request.json();
	if (!endpoint) return Response.json({ error: 'Endpoint fehlt' }, { status: 400 });

	db.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user!.id)))
		.run();
	event.cookies.delete('push_device', { path: '/' });

	return Response.json({ ok: true });
};
