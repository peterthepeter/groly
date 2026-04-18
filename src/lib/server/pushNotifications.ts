import webpush from 'web-push';
import { db } from '$lib/db';
import { pushSubscriptions, listMembers, listNotificationPrefs, lists, users } from '$lib/db/schema';
import { eq, and, inArray } from 'drizzle-orm';
import { env } from '$env/dynamic/private';

type Lang = 'de' | 'en';
type PayloadFn = (lang: Lang) => { title: string; body: string; url?: string };

function getUserLang(settings: string | null): Lang {
	try {
		if (settings && JSON.parse(settings)?.lang === 'en') return 'en';
	} catch { /* use default */ }
	return 'de';
}

let initialized = false;

function init() {
	if (initialized) return;
	if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return;
	webpush.setVapidDetails(
		env.VAPID_SUBJECT ?? 'mailto:admin@groly.local',
		env.VAPID_PUBLIC_KEY,
		env.VAPID_PRIVATE_KEY
	);
	initialized = true;
}

function isNotificationsEnabled(listId: string, userId: string): boolean {
	const pref = db
		.select()
		.from(listNotificationPrefs)
		.where(and(eq(listNotificationPrefs.listId, listId), eq(listNotificationPrefs.userId, userId)))
		.get();
	// Wenn kein Eintrag: default enabled
	return pref === undefined ? true : pref.enabled;
}

export async function sendPushToListMembers(
	listId: string,
	excludeUserId: string,
	payloadFn: PayloadFn
) {
	init();
	if (!initialized) return;

	const list = db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).get();
	if (!list) return;

	// Akzeptierte Mitglieder (non-owner) mit aktivierten list-level notifications
	const members = db
		.select({ userId: listMembers.userId })
		.from(listMembers)
		.where(
			and(
				eq(listMembers.listId, listId),
				eq(listMembers.status, 'accepted'),
				eq(listMembers.notificationsEnabled, true)
			)
		)
		.all();

	const candidateIds: string[] = members.map((m) => m.userId);

	// Owner hinzufügen
	candidateIds.push(list.ownerId);

	// Auslöser und Duplikate entfernen, dann per-list pref prüfen
	const recipientIds = [...new Set(candidateIds)]
		.filter((id) => id !== excludeUserId)
		.filter((id) => isNotificationsEnabled(listId, id));

	if (recipientIds.length === 0) return;

	const subs = db
		.select({ sub: pushSubscriptions, settings: users.settings })
		.from(pushSubscriptions)
		.innerJoin(users, eq(pushSubscriptions.userId, users.id))
		.where(inArray(pushSubscriptions.userId, recipientIds))
		.all();

	if (subs.length === 0) return;

	const staleEndpoints: string[] = [];

	await Promise.allSettled(
		subs.map(async ({ sub, settings }) => {
			const lang = getUserLang(settings);
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
					JSON.stringify(payloadFn(lang))
				);
			} catch (err: unknown) {
				const status = (err as { statusCode?: number })?.statusCode;
				if (status === 410 || status === 404) {
					staleEndpoints.push(sub.endpoint);
				}
			}
		})
	);

	for (const endpoint of staleEndpoints) {
		db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
	}
}

export async function sendPushToUser(
	userId: string,
	payload: { title: string; body: string; url?: string; tag?: string }
): Promise<'sent' | 'no_subscription' | 'failed'> {
	init();
	if (!initialized) return 'failed';

	const subs = db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.userId, userId))
		.all();

	if (subs.length === 0) return 'no_subscription';

	const payloadStr = JSON.stringify(payload);
	const staleEndpoints: string[] = [];
	let anySuccess = false;

	await Promise.allSettled(
		subs.map(async (sub) => {
			try {
				await webpush.sendNotification(
					{ endpoint: sub.endpoint, keys: { auth: sub.auth, p256dh: sub.p256dh } },
					payloadStr
				);
				anySuccess = true;
			} catch (err: unknown) {
				const status = (err as { statusCode?: number })?.statusCode;
				if (status === 410 || status === 404) {
					staleEndpoints.push(sub.endpoint);
				}
			}
		})
	);

	for (const endpoint of staleEndpoints) {
		db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint)).run();
	}

	return anySuccess ? 'sent' : 'failed';
}
