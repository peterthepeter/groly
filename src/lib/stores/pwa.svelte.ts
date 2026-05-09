export function initUpdateDetection() {
	if (!('serviceWorker' in navigator)) return;

	// Wenn ein neuer SW die Kontrolle übernimmt (auto-skipWaiting), Version speichern und neu laden.
	// hadController stellt sicher, dass wir nur bei echten Updates reloaden, nicht beim ersten Install.
	const hadController = !!navigator.serviceWorker.controller;
	navigator.serviceWorker.addEventListener('controllerchange', async () => {
		if (!hadController) return;
		const { LATEST_CHANGES } = await import('$lib/changelog');
		localStorage.setItem('groly_last_version', LATEST_CHANGES.version);
		window.location.reload();
	});
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
