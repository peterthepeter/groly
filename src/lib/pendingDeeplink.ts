// Persistent "Briefkasten" für Push-Deep-Links, der das iOS-Suspend-Problem
// umgeht: der Service-Worker schreibt die ankommende URL in IndexedDB, die
// App liest beim Resume daraus. So gehen Messages nicht verloren, auch wenn
// der postMessage-Pfad nach langem iOS-Suspend stumm bleibt (bewiesen per
// Remote-Inspector-Log: nach 30 min Suspend feuert visibilitychange, aber
// sw-message kommt nicht durch).
//
// Eigene IndexedDB-Datenbank (NICHT Dexie) damit der Service-Worker den
// Code bare-IDB inlinen kann, ohne Dexie-Bundle in den SW zu ziehen.

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
	} catch { /* IDB nicht verfügbar — Fast-Path (postMessage) versucht's noch */ }
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

// Mehrfaches Lesen mit Verzögerung — fängt iOS-SW-Cold-Start-Race ab, bei dem
// der SW-Write erst Hunderte ms nach dem App-Resume committed wird. Wir prüfen
// sofort, dann nach 300ms, dann nach 1000ms. Sobald ein Eintrag da ist: zurückgeben.
export async function consumePendingDeeplinkWithRetry(): Promise<string | null> {
	const delays = [0, 300, 1000];
	for (const delay of delays) {
		if (delay > 0) await new Promise(r => setTimeout(r, delay));
		const url = await consumePendingDeeplink();
		if (url) return url;
	}
	return null;
}
