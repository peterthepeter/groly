import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { pushSubscriptions } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomBytes } from 'crypto';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { endpoint, keys } = await event.request.json();
	if (!endpoint || !keys?.auth || !keys?.p256dh) {
		return json({ error: 'Ungültige Subscription' }, { status: 400 });
	}

	const id = randomBytes(12).toString('base64url');
	const ts = Math.floor(Date.now() / 1000);

	// Remove all previous subscriptions for this user to prevent duplicate notifications
	// when the same user has both a browser tab and installed PWA registered
	db.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, user!.id)).run();

	db.insert(pushSubscriptions)
		.values({ id, userId: user!.id, endpoint, auth: keys.auth, p256dh: keys.p256dh, createdAt: ts })
		.run();

	return json({ ok: true }, { status: 201 });
};

export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const { endpoint } = await event.request.json();
	if (!endpoint) return json({ error: 'Endpoint fehlt' }, { status: 400 });

	db.delete(pushSubscriptions)
		.where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user!.id)))
		.run();

	return json({ ok: true });
};
