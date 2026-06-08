let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);
let pendingCount = $state(0);
let isServerReachable = $state(true);

async function pingServer() {
	// Hartes Zeitlimit: Nach iOS-Suspend oder einer DSL-Zwangstrennung (neue IP)
	// ist die alte Verbindung tot, aber ein fetch() bleibt ohne Abbruch ewig
	// hängen — dann würde isServerReachable nie aktualisiert. 5 s reichen für den
	// winzigen /api/ping, ohne den Nutzer beim Aufwachen lange warten zu lassen.
	const ctrl = new AbortController();
	const t = setTimeout(() => ctrl.abort(), 5000);
	try {
		const res = await fetch('/api/ping', { method: 'GET', cache: 'no-store', signal: ctrl.signal });
		isServerReachable = res.ok;
	} catch {
		isServerReachable = false;
	} finally {
		clearTimeout(t);
	}
}

// Verbindungszustand frisch ermitteln: navigator.onLine neu einlesen (Online-/
// Offline-Ereignisse können während des Hintergrund-Suspends verpasst worden
// sein) und, wenn das Gerät Netz hat, aktiv prüfen ob der Server WIRKLICH
// erreichbar ist. Wird beim Start, bei 'online' und bei jedem Sichtbar-Werden
// aufgerufen.
function refreshConnectivity() {
	isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
	if (isOnline) {
		void pingServer();
	} else {
		isServerReachable = true; // Gerät offline → Server-Zustand ist irrelevant
	}
}

if (typeof window !== 'undefined') {
	window.addEventListener('online', refreshConnectivity);
	window.addEventListener('offline', () => {
		isOnline = false;
		isServerReachable = true; // reset — server state is irrelevant when device is offline
	});

	// Beim Zurückkommen aus dem Hintergrund sofort neu prüfen. Das ist der
	// entscheidende Auslöser: Bei einer nächtlichen DSL-Zwangstrennung bleibt die
	// WLAN-Verbindung iPhone↔Router bestehen, navigator.onLine bleibt 'true' und
	// es feuert KEIN online/offline-Ereignis — nur dieser aktive Ping merkt, dass
	// der Server nicht mehr erreichbar ist.
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState === 'visible') refreshConnectivity();
	});

	// Poll every 30s when online
	setInterval(() => {
		if (isOnline) void pingServer();
	}, 30_000);

	// Initial check
	void pingServer();
}

export const networkStore = {
	get online() {
		return isOnline;
	},
	get serverReachable() {
		return isServerReachable;
	},
	get pendingCount() {
		return pendingCount;
	},
	setPending(count: number) {
		pendingCount = count;
	},
	setServerReachable(val: boolean) {
		isServerReachable = val;
	}
};
