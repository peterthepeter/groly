// Temporary client→server debug bridge for diagnosing push-notification deep-link
// behaviour on iOS. Active only when GROLY_DEBUG container env var is set.
// Logs land in `docker logs groly` as `[groly:dbg] <msg>` so they sit next to the
// existing [groly:mem] / [groly:push] traces.
// Should be removed once the iOS bug is diagnosed.

export function debugLog(msg: string): void {
	if (typeof fetch === 'undefined') return;
	// Fire-and-forget; never block UI or throw if logging fails.
	void fetch('/api/debug-log', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ msg }),
		keepalive: true
	}).catch(() => {});
}
