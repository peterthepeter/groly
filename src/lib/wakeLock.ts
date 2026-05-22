type WakeLockSentinel = { release: () => Promise<void>; released?: boolean; addEventListener?: (e: string, cb: () => void) => void };

let sentinel: WakeLockSentinel | null = null;
let holders = 0;
let visListener: (() => void) | null = null;

async function tryRequest() {
	if (typeof navigator === 'undefined') return;
	const nav = navigator as unknown as { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinel> } };
	if (!nav.wakeLock) return;
	if (sentinel && !sentinel.released) return;
	try {
		sentinel = await nav.wakeLock.request('screen');
	} catch { /* user gesture required, low battery, etc. */ }
}

export async function acquireWakeLock() {
	holders++;
	if (typeof document !== 'undefined' && !visListener) {
		visListener = () => {
			if (document.visibilityState === 'visible' && holders > 0) tryRequest();
		};
		document.addEventListener('visibilitychange', visListener);
	}
	await tryRequest();
}

export async function releaseWakeLock() {
	holders = Math.max(0, holders - 1);
	if (holders > 0) return;
	try { await sentinel?.release(); } catch {}
	sentinel = null;
	if (typeof document !== 'undefined' && visListener) {
		document.removeEventListener('visibilitychange', visListener);
		visListener = null;
	}
}
