// Zentrale Schutzschicht: GET-Anfragen an die eigene API (/api/...) bekommen einen
// harten Abbruch-Timeout.
//
// Hintergrund: Nach iOS-Standby/Suspend ist die (HTTP/2-)Verbindung zum Server oft
// tot, während navigator.onLine weiterhin 'true' meldet. Ein nacktes fetch() bleibt
// dann hängen, bis das Betriebssystem den Socket selbst aufgibt (zig Sekunden) — in
// dieser Zeit erreichen die Lade-Funktionen weder die Server-Daten noch ihren
// Offline-catch, die Anzeige friert ein und frisch (lokal) gespeicherte Einträge
// erscheinen nicht. Mit Timeout bricht der GET schnell ab und der ohnehin vorhandene
// catch-Fallback (lokaler IndexedDB-Cache) greift sofort.
//
// Bewusst NUR GET: Lesezugriffe sind idempotent und gefahrlos abbrechbar.
// Schreibvorgänge (POST/PUT/DELETE) laufen unverändert über die Mutation-Queue
// (src/lib/sync/manager.ts) — dort würde ein Timeout-Abbruch Duplikate riskieren.
// Aufrufer mit eigenem AbortSignal (z. B. fetchWithTimeout, Barcode-Scanner) werden
// nicht angetastet. Externe URLs (andere Origin) ebenfalls nicht.

const GET_TIMEOUT_MS = 8000;
let installed = false;

export function installApiFetchTimeout(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	const nativeFetch = window.fetch.bind(window);

	const wrapped = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
		const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
		// Nur same-origin GET an /api/ ohne bereits gesetztes Signal absichern.
		if (method !== 'GET' || init?.signal || !isSameOriginApi(input)) {
			return nativeFetch(input, init);
		}
		const ctrl = new AbortController();
		const timer = setTimeout(() => ctrl.abort(), GET_TIMEOUT_MS);
		return nativeFetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(timer));
	};

	window.fetch = wrapped as typeof window.fetch;
}

function isSameOriginApi(input: RequestInfo | URL): boolean {
	const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
	try {
		const u = new URL(raw, window.location.origin);
		return u.origin === window.location.origin && u.pathname.startsWith('/api/');
	} catch {
		return false;
	}
}
