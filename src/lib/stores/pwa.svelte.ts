let _updateAvailable = $state(false);

export const pwaStore = {
	get updateAvailable() { return _updateAvailable; }
};

export function initUpdateDetection() {
	if (!('serviceWorker' in navigator)) return;

	navigator.serviceWorker.ready.then((reg) => {
		// New SW already waiting (e.g. user had the tab open when deploy happened)
		if (reg.waiting && navigator.serviceWorker.controller) {
			_updateAvailable = true;
		}

		reg.addEventListener('updatefound', () => {
			const newWorker = reg.installing;
			if (!newWorker) return;
			newWorker.addEventListener('statechange', () => {
				if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
					_updateAvailable = true;
				}
			});
		});
	}).catch(() => { /* SW not available in dev */ });
}

let _lastUpdateCheck = 0;

// Call this on each SvelteKit navigation to trigger a SW update check.
// Throttled to at most once per minute to avoid unnecessary network requests.
export function checkForUpdate() {
	if (!('serviceWorker' in navigator)) return;
	const now = Date.now();
	if (now - _lastUpdateCheck < 60_000) return;
	_lastUpdateCheck = now;
	navigator.serviceWorker.ready.then((reg) => reg.update()).catch(() => {});
}

export async function applyUpdate() {
	if (!('serviceWorker' in navigator)) return;

	const reg = await navigator.serviceWorker.ready;
	if (reg.waiting) {
		// Aktuelle Version speichern, damit nach dem Reload "Was ist neu" angezeigt werden kann
		const { LATEST_CHANGES } = await import('$lib/changelog');
		localStorage.setItem('groly_last_version', LATEST_CHANGES.version);

		navigator.serviceWorker.addEventListener('controllerchange', () => {
			window.location.reload();
		}, { once: true });
		reg.waiting.postMessage({ type: 'SKIP_WAITING' });
	}
}
