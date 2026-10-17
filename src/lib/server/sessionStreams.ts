// Close long-lived streams immediately when their session is revoked.
const streams = new Map<string, { userId: string; close: () => void }[]>();

export function registerSessionStream(sessionId: string, userId: string, close: () => void): () => void {
	const entry = { userId, close };
	streams.set(sessionId, [...(streams.get(sessionId) ?? []), entry]);
	return () => {
		const remaining = streams.get(sessionId)?.filter(value => value !== entry) ?? [];
		if (remaining.length) streams.set(sessionId, remaining);
		else streams.delete(sessionId);
	};
}

export function closeSessionStreams(sessionId: string) {
	const entries = streams.get(sessionId) ?? [];
	streams.delete(sessionId);
	for (const entry of entries) entry.close();
}

export function closeUserStreams(userId: string, exceptSessionId?: string) {
	for (const [sessionId, entries] of streams) {
		if (sessionId !== exceptSessionId && entries.some(entry => entry.userId === userId)) closeSessionStreams(sessionId);
	}
}
