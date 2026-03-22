// In-memory pub/sub für Server-Sent Events pro Liste
const enc = new TextEncoder();

type Controller = ReadableStreamDefaultController<Uint8Array>;
const subs = new Map<string, Set<Controller>>();

export function subscribe(listId: string, ctrl: Controller): () => void {
	if (!subs.has(listId)) subs.set(listId, new Set());
	subs.get(listId)!.add(ctrl);
	return () => {
		subs.get(listId)?.delete(ctrl);
		if (subs.get(listId)?.size === 0) subs.delete(listId);
	};
}

export function emit(listId: string, event: object): void {
	const subscribers = subs.get(listId);
	if (!subscribers?.size) return;
	const msg = enc.encode(`data: ${JSON.stringify(event)}\n\n`);
	for (const ctrl of subscribers) {
		try { ctrl.enqueue(msg); } catch { /* Verbindung bereits geschlossen */ }
	}
}
