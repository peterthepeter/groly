import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { pushSubscriptions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import webpush from 'web-push';
import { env } from '$env/dynamic/private';

let initialized = false;

function init(): boolean {
	if (initialized) return true;
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
	webpush.setVapidDetails(
		env.VAPID_SUBJECT ?? 'mailto:admin@groly.local',
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY
	);
	initialized = true;
	return true;
}

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	if (!init()) {
		return json({ ok: false, error: 'VAPID keys not configured' });
	}

	const subs = db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, user!.id))
		.all();

	if (subs.length === 0) {
		return json({ ok: false, error: 'No subscription found in DB for your user' });
	}

	const results = await Promise.allSettled(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
					JSON.stringify({ title: 'Groly Test', body: 'Push funktioniert!', url: '/' })
				);
				return { endpoint: sub.endpoint.slice(0, 60), status: 'sent' };
			} catch (err: unknown) {
				const e = err as { statusCode?: number; message?: string };
				return {
					endpoint: sub.endpoint.slice(0, 60),
					status: 'failed',
					error: `statusCode=${e.statusCode} message=${e.message}`
				};
			}
		})
	);

	return json({
		ok: true,
		subscriptionCount: subs.length,
		results: results.map((r) => (r.status === 'fulfilled' ? r.value : { status: 'failed', error: String(r.reason) }))
	});
};
