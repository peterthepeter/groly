
import type { RequestHandler } from './$types';
import { getSession, logout } from '#lib/auth';
import { db } from '#lib/db';
import { pushSubscriptions } from '#lib/db/schema';
import { and, eq, or } from 'drizzle-orm';

export const POST: RequestHandler = async ({ cookies, request }) => {
	const sessionId = cookies.get('session');
	const user = sessionId ? getSession(sessionId) : null;
	const deviceId = cookies.get('push_device');
	let endpoint: unknown;
	try { endpoint = (await request.json())?.endpoint; } catch { /* Older clients send no body. */ }
	if (user && (deviceId || typeof endpoint === 'string')) {
		db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, user.id), or(
			deviceId ? eq(pushSubscriptions.id, deviceId) : undefined,
			typeof endpoint === 'string' ? eq(pushSubscriptions.endpoint, endpoint) : undefined
		))).run();
	}
	if (sessionId) logout(sessionId);
	cookies.delete('session', { path: '/' });
	cookies.delete('push_device', { path: '/' });
	return Response.json({ ok: true });
};
