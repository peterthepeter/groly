// Client-seitiger Event-Bus für den globalen SSE-Kanal
type Handler = (event: Record<string, unknown>) => void;
const handlers = new Map<string, Set<Handler>>();

/** Registriert einen Handler für einen Event-Typ. Gibt eine Funktion zum Abmelden zurück. */
export function on(type: string, handler: Handler): () => void {
	if (!handlers.has(type)) handlers.set(type, new Set());
	handlers.get(type)!.add(handler);
	return () => handlers.get(type)?.delete(handler);
}

/** Verteilt ein Event an alle registrierten Handler für den Typ. */
export function dispatch(event: Record<string, unknown>): void {
	const type = event.type as string;
	handlers.get(type)?.forEach(h => h(event));
}
