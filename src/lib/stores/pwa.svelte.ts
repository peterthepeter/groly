// Hört auf Service-Worker Messages und routet Deep-Links (Push-Klick bei laufender App).
// Notwendig, weil `client.navigate()` aus dem SW heraus auf iOS-PWAs unzuverlässig ist:
// Der Aufruf läuft scheinbar erfolgreich durch, die URL wird aber nicht real gewechselt.
// Statt URL-Navigation aus dem SW heraus schickt der SW eine Nachricht — die App routet selbst.
export function initDeepLinkListener() {
	if (!('serviceWorker' in navigator)) return;
	navigator.serviceWorker.addEventListener('message', (event) => {
		const data = event.data as { type?: string; url?: string } | undefined;
		if (data?.type === 'deeplink' && typeof data.url === 'string') {
			// Dynamischer Import vermeidet einen Top-Level-Import aus $app/navigation,
			// der diesen Helper sonst an den Client-Bundle bindet.
			import('$app/navigation').then(({ goto }) => goto(data.url!));
		}
	});
}

export function initUpdateDetection() {
	if (!('serviceWorker' in navigator)) return;

	// Wenn ein neuer SW die Kontrolle übernimmt (auto-skipWaiting), Version speichern und neu laden.
	// hadController stellt sicher, dass wir nur bei echten Updates reloaden, nicht beim ersten Install.
	const hadController = !!navigator.serviceWorker.controller;
	navigator.serviceWorker.addEventListener('controllerchange', () => {
		if (!hadController) return;
		// localStorage wird NICHT hier gesetzt — sonst überschreibt der Reload
		// das "ungelesen"-Signal für das WhatsNew-Modal. Das setzt das Modal selbst beim Schließen.
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
