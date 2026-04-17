import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { sendPushToUser } from '$lib/server/pushNotifications';

// Server-side rate limit: 1 test per 60s per user
const lastTestTime = new Map<string, number>();
const COOLDOWN_MS = 60_000;

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const userId = user!.id;
	const now = Date.now();
	const last = lastTestTime.get(userId) ?? 0;
	const remaining = Math.ceil((COOLDOWN_MS - (now - last)) / 1000);

	if (remaining > 0) {
		return json({ error: 'rate_limited', remaining }, { status: 429 });
	}

	// Set rate limit only after successful send
	let lang = 'de';
	try {
		const settings = user!.settings;
		if (settings && JSON.parse(settings)?.lang === 'en') lang = 'en';
	} catch { /* use default */ }

	const result = await sendPushToUser(userId, {
		title: lang === 'en' ? '🔔 Test Notification' : '🔔 Test-Benachrichtigung',
		body: lang === 'en' ? 'Push notifications are working!' : 'Push-Notifications funktionieren!',
		url: '/einstellungen'
	});

	if (result === 'no_subscription') {
		return json({ error: 'no_subscription' }, { status: 404 });
	}

	lastTestTime.set(userId, now);
	return json({ ok: true, delivered: result === 'sent' });
};
