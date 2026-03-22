import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { lists, listMembers } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { subscribe } from '$lib/server/listEvents';

function hasAccess(listId: string, userId: string): boolean {
	const list = db.select().from(lists).where(eq(lists.id, listId)).get();
	if (!list) return false;
	if (list.ownerId === userId) return true;
	const member = db.select().from(listMembers)
		.where(and(eq(listMembers.listId, listId), eq(listMembers.userId, userId))).get();
	return !!member;
}

const enc = new TextEncoder();

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	if (!hasAccess(event.params.id, user!.id)) {
		return new Response('Forbidden', { status: 403 });
	}

	const listId = event.params.id;

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(': connected\n\n'));

			const unsubscribe = subscribe(listId, controller);

			const keepalive = setInterval(() => {
				try { controller.enqueue(enc.encode(': ping\n\n')); }
				catch { clearInterval(keepalive); }
			}, 25000);

			event.request.signal.addEventListener('abort', () => {
				clearInterval(keepalive);
				unsubscribe();
			});
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			'Connection': 'keep-alive',
			'X-Accel-Buffering': 'no'
		}
	});
};
