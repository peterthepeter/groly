// Persistente Briefkasten-IDB für Push-Deep-Links. Backup-Pfad für den Fall,
// dass der primäre BroadcastChannel-Pfad (siehe service-worker.ts +
// resumeOrchestrator.ts) eine Nachricht verpasst — z.B. weil der App-Mount und
// der SW-Boot in unterschiedlichen Prozessen parallel laufen und die App schon
// fertig ist bevor der SW gepostet hat. Die App liest diese IDB beim Mount und
// bei jedem visibilitychange → wenn dort etwas steht, wird navigiert.
//
// Der frühere Polling-Loop (0/300/1000 ms) wurde entfernt: er war ein
// Pflaster gegen genau die Race-Condition, die BroadcastChannel strukturell
// löst. Diese Datei stellt nur noch zwei eindeutige Operationen bereit:
// schreiben + atomar konsumieren.

const DB_NAME = 'groly-deeplink';
const STORE = 'pending';
const KEY = 'current';
const TTL_MS = 60 * 60 * 1000; // 1 Stunde — alte Pushes nicht versehentlich nachträglich öffnen

// BroadcastChannel-Name. Wird vom Service-Worker (inline) und vom
// resumeOrchestrator verwendet — Stringliteral muss synchron bleiben.
export const DEEPLINK_CHANNEL = 'groly-deeplink';

function openDb(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, 1);
		req.onupgradeneeded = () => req.result.createObjectStore(STORE);
		req.onsuccess = () => resolve(req.result);
		req.onerror = () => reject(req.error);
	});
}

export async function setPendingDeeplink(url: string): Promise<void> {
	try {
		const db = await openDb();
		await new Promise<void>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite');
			tx.objectStore(STORE).put({ url, ts: Date.now() }, KEY);
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
		db.close();
	} catch { /* IDB nicht verfügbar — BC-Pfad versucht's noch */ }
}

// Resume-Variante: liest den Briefkasten kurz mehrfach (Summe ~900 ms). Auf iOS
// committet der Service-Worker seinen IDB-Write beim Warm-Resume teils erst
// Hunderte ms NACH dem visibilitychange — ein einziger Read würde dann leer
// zurückkommen und der Deep-Link ginge verloren. Der erste Read (0 ms) trifft
// beim Kaltstart sofort → dort entsteht kein Zeitverlust, die Retries greifen nur
// wenn der Eintrag anfangs noch fehlt.
export async function consumePendingDeeplinkWithRetry(): Promise<string | null> {
	const delays = [0, 200, 300, 400]; // ~900 ms gesamt
	for (const delay of delays) {
		if (delay > 0) await new Promise((r) => setTimeout(r, delay));
		const url = await consumePendingDeeplink();
		if (url) return url;
	}
	return null;
}

export async function consumePendingDeeplink(): Promise<string | null> {
	try {
		const db = await openDb();
		const entry = await new Promise<{ url: string; ts: number } | undefined>((resolve, reject) => {
			const tx = db.transaction(STORE, 'readwrite');
			const store = tx.objectStore(STORE);
			const getReq = store.get(KEY);
			getReq.onsuccess = () => {
				const v = getReq.result as { url: string; ts: number } | undefined;
				if (v) store.delete(KEY);
				resolve(v);
			};
			getReq.onerror = () => reject(getReq.error);
		});
		db.close();
		if (!entry) return null;
		if (Date.now() - entry.ts > TTL_MS) return null;
		return entry.url;
	} catch {
		return null;
	}
}
