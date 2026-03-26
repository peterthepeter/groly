// In-memory pub/sub für Server-Sent Events pro User (global user-scoped channel)
import { db } from '$lib/db';
import { lists, listMembers } from '$lib/db/schema';
import { eq, and, count } from 'drizzle-orm';

const enc = new TextEncoder();

type Controller = ReadableStreamDefaultController<Uint8Array>;
const subs = new Map<string, Set<Controller>>();

export function subscribe(userId: string, ctrl: Controller): () => void {
	if (!subs.has(userId)) subs.set(userId, new Set());
	subs.get(userId)!.add(ctrl);
	return () => {
		subs.get(userId)?.delete(ctrl);
		if (subs.get(userId)?.size === 0) subs.delete(userId);
	};
}

export function emit(userId: string, event: object): void {
	const controllers = subs.get(userId);
	if (!controllers?.size) return;
	const msg = enc.encode(`data: ${JSON.stringify(event)}\n\n`);
	for (const ctrl of controllers) {
		try { ctrl.enqueue(msg); } catch { /* Verbindung bereits geschlossen */ }
	}
}

/** Sendet den aktuellen memberCount (aus DB) an den Owner einer Liste */
export function emitMemberCountToOwner(listId: string, ownerId: string): void {
	const memberCount = db
		.select({ cnt: count(listMembers.userId) })
		.from(listMembers)
		.where(eq(listMembers.listId, listId))
		.get()?.cnt ?? 0;
	emit(ownerId, { type: 'list_member_count_changed', listId, memberCount });
}

/** Emittiert an den Owner + alle accepted Members einer Liste */
export function emitToListMembers(listId: string, event: object): void {
	const list = db.select({ ownerId: lists.ownerId }).from(lists).where(eq(lists.id, listId)).get();
	if (!list) return;

	const members = db
		.select({ userId: listMembers.userId })
		.from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.status, 'accepted')))
		.all();

	const userIds = new Set([list.ownerId, ...members.map(m => m.userId)]);
	for (const userId of userIds) emit(userId, event);
}
