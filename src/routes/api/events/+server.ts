import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { subscribe } from '$lib/server/userEvents';

const enc = new TextEncoder();

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(': connected\n\n'));

			const unsubscribe = subscribe(user!.id, controller);

			const keepalive = setInterval(() => {
				try { controller.enqueue(enc.encode(': ping\n\n')); }
				catch { clearInterval(keepalive); unsubscribe(); }
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
