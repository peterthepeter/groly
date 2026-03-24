import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { listMembers } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const listId = event.params.id;
	const targetUserId = event.params.userId;

	// Nur der eingeladene User selbst kann annehmen
	if (targetUserId !== user!.id) {
		return json({ error: 'Keine Berechtigung' }, { status: 403 });
	}

	const member = db
		.select()
		.from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id)))
		.get();

	if (!member) return json({ error: 'Einladung nicht gefunden' }, { status: 404 });
	if (member.status === 'accepted') return json({ ok: true });

	db.update(listMembers)
		.set({ status: 'accepted' })
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, user!.id)))
		.run();

	return json({ ok: true });
};
