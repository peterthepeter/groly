import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { subscribe } from '#lib/server/userEvents';
import { getSession } from '#lib/auth';
import { registerSessionStream } from '#lib/server/sessionStreams';

const enc = new TextEncoder();

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;
	const expectedUser = event.url.searchParams.get('userId');
	if (expectedUser && expectedUser !== user!.id) return Response.json({ error: 'Account changed' }, { status: 401 });
	const sessionId = event.cookies.get('session')!;
	const isAuthorized = () => getSession(sessionId)?.id === user!.id;
	let cleanup = () => {};

	const stream = new ReadableStream({
		start(controller) {
			controller.enqueue(enc.encode(': connected\n\n'));

			const unsubscribe = subscribe(user!.id, controller, isAuthorized);
			let unregister = () => {};
			cleanup = () => {
				clearInterval(keepalive);
				unsubscribe();
				unregister();
				event.request.signal.removeEventListener('abort', cleanup);
				try { controller.close(); } catch { /* Already closed. */ }
			};

			const keepalive = setInterval(() => {
				if (!isAuthorized()) { cleanup(); return; }
				try { controller.enqueue(enc.encode(': ping\n\n')); }
				catch { cleanup(); }
			}, 25000);
			unregister = registerSessionStream(sessionId, user!.id, cleanup);
			event.request.signal.addEventListener('abort', cleanup, { once: true });
			if (event.request.signal.aborted) cleanup();
		},
		cancel() { cleanup(); }
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
