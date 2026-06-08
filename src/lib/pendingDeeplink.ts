// Persistente Briefkasten-IDB für Push-Deep-Links. Auf iOS ist das der EINZIGE
// zuverlässige Zustellweg vom Service-Worker zur App: per Remote-Inspector belegt
// werden postMessage/BroadcastChannel an einen schlafenden PWA-Client nach Suspend
// stillschweigend verworfen, ein IDB-Eintrag überlebt dagegen jede Suspend-Tiefe.
// Der Service-Worker schreibt beim notificationclick, die App liest beim Aufwachen
// (resumeOrchestrator) — und zwar mit einem geduldigen Zeitfenster, weil der SW
// seinen Write nach langem Suspend erst 2-5 s nach dem Antippen committet.
//
// Diese Datei stellt nur zwei Operationen bereit: schreiben + atomar konsumieren
// (der Read löscht den Eintrag, damit derselbe Deep-Link nicht doppelt feuert).

const DB_NAME = 'groly-deeplink';
const STORE = 'pending';
const KEY = 'current';
const TTL_MS = 60 * 60 * 1000; // 1 Stunde — alte Pushes nicht versehentlich nachträglich öffnen

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
	} catch { /* IDB nicht verfügbar */ }
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
