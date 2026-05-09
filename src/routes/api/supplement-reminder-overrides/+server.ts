import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementReminderOverrides } from '$lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { randomUUID } from 'crypto';

// POST { date, reminderTime, done } → upsert override
export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { date, reminderTime, done } = body;

		if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return json({ error: 'date ungültig (YYYY-MM-DD)' }, { status: 400 });
		if (!reminderTime || !/^\d{2}:\d{2}$/.test(reminderTime)) return json({ error: 'reminderTime ungültig (HH:MM)' }, { status: 400 });
		if (typeof done !== 'boolean') return json({ error: 'done muss boolean sein' }, { status: 400 });

		const now = Date.now();
		const id = randomUUID();

		db.insert(supplementReminderOverrides)
			.values({ id, userId: user!.id, date, reminderTime, done, createdAt: now })
			.onConflictDoUpdate({
				target: [supplementReminderOverrides.userId, supplementReminderOverrides.date, supplementReminderOverrides.reminderTime],
				set: { done, createdAt: now }
			})
			.run();

		return json({ ok: true });
	} catch (e) {
		console.error('POST /api/supplement-reminder-overrides error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

// DELETE ?date=YYYY-MM-DD&reminderTime=HH:MM → remove override
export const DELETE: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const date = event.url.searchParams.get('date');
	const reminderTime = event.url.searchParams.get('reminderTime');

	if (!date || !reminderTime) return json({ error: 'date und reminderTime erforderlich' }, { status: 400 });

	db.delete(supplementReminderOverrides)
		.where(and(
			eq(supplementReminderOverrides.userId, user!.id),
			eq(supplementReminderOverrides.date, date),
			eq(supplementReminderOverrides.reminderTime, reminderTime)
		))
		.run();

	return json({ ok: true });
};
