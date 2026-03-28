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

export async function applyUpdate() {
	if (!('serviceWorker' in navigator)) return;

	const reg = await navigator.serviceWorker.ready;
	if (reg.waiting) {
		navigator.serviceWorker.addEventListener('controllerchange', () => {
			window.location.reload();
		}, { once: true });
		reg.waiting.postMessage({ type: 'SKIP_WAITING' });
	}
}
