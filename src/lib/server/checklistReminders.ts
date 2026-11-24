import { and, eq, lte } from 'drizzle-orm';
import { db } from '#lib/db';
import { checklistReminders, items, lists } from '#lib/db/schema';
import { getListAccess } from './checklists';
import { sendPushToUser } from './pushNotifications';
import { emit } from './userEvents';

const RETRY_DELAY = 60_000;
const DELIVERY_WINDOW = 20 * 60_000;

export async function checkChecklistReminders(now = Date.now()) {
	const due = db.select({
		reminder: checklistReminders, item: items, listName: lists.name
	}).from(checklistReminders)
		.innerJoin(items, eq(checklistReminders.itemId, items.id))
		.innerJoin(lists, eq(items.listId, lists.id))
		.where(and(eq(checklistReminders.status, 'pending'), lte(checklistReminders.nextAttemptAt, now)))
		.orderBy(checklistReminders.nextAttemptAt).limit(50).all();

	await Promise.allSettled(due.map(async ({ reminder, item, listName }) => {
		const { userId, itemId, dueAt, nextAttemptAt } = reminder;
		const key = and(eq(checklistReminders.itemId, itemId), eq(checklistReminders.userId, userId));
		const changes = db.update(checklistReminders).set({ nextAttemptAt: now + RETRY_DELAY })
			.where(and(key, eq(checklistReminders.status, 'pending'), eq(checklistReminders.nextAttemptAt, nextAttemptAt))).run();
		if (!changes.changes) return;

		const { permission } = getListAccess(item.listId, userId);
		if (item.isChecked || (permission !== 'owner' && permission !== 'write')) {
			db.delete(checklistReminders).where(key).run();
			return;
		}
		const withinWindow = now - dueAt <= DELIVERY_WINDOW;
		const result = withinWindow ? await sendPushToUser(userId, {
			title: listName,
			body: item.name,
			url: `/listen/${encodeURIComponent(item.listId)}?entry=${encodeURIComponent(itemId)}`,
			tag: `checklist-${itemId}-${dueAt}`
		}).catch(() => 'failed' as const) : 'failed';
		if (withinWindow && result === 'failed') return;
		const status = result === 'sent' ? 'sent' : 'missed';
		const updated = db.update(checklistReminders).set({ status })
			.where(and(key, eq(checklistReminders.dueAt, dueAt), eq(checklistReminders.status, 'pending'),
				eq(checklistReminders.nextAttemptAt, now + RETRY_DELAY))).run();
		if (updated.changes) emit(userId, { type: 'checklist_refreshed', listId: item.listId });
	}));
}
