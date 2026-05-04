type WakeLockSentinel = { release: () => Promise<void>; addEventListener?: (e: string, cb: () => void) => void };

let sentinel: WakeLockSentinel | null = null;

export async function acquireWakeLock() {
	if (typeof navigator === 'undefined') return;
	const nav = navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
	if (!nav.wakeLock) return;
	try {
		sentinel = await nav.wakeLock.request('screen');
	} catch { /* user gesture required, low battery, etc. */ }
}

export async function releaseWakeLock() {
	try { await sentinel?.release(); } catch {}
	sentinel = null;
}
