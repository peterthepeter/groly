// Orchestriert Aktionen beim App-Resume (initialer Mount + Sichtbar-Werden aus
// dem Hintergrund). Reihenfolge:
//   1. Push-Deep-Link konsumieren → goto
//      - Primärpfad: BroadcastChannel-Nachricht vom Service-Worker
//      - Backup-Pfad: IndexedDB-Briefkasten (für den Fall dass der SW postet
//        bevor der App-Listener subscribed war, oder iOS BC im Tiefschlaf droppt)
//   2. Wenn kein Deep-Link: Geofence prüfen → goto zur passenden Liste
//   3. Pending-Mutations-Queue antriggern — gestrandete Logs synchronisieren

import { consumePendingDeeplink, consumePendingDeeplinkWithRetry, DEEPLINK_CHANNEL } from '$lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '$lib/locationNav';
import { drainPendingMutations } from '$lib/sync/manager';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let bc: BroadcastChannel | null = null;
	let navigating = false;
	// Zeitpunkt der letzten Deep-Link-Navigation. Schützt davor, dass ein
	// verspäteter Geofence-Treffer ein gerade per Push geöffnetes Sheet wieder
	// wegnavigiert (BC- und IDB-Pfad können im selben Resume-Zyklus feuern).
	let lastDeeplinkAt = 0;

	async function navigateTo(url: string) {
		if (navigating) return;
		navigating = true;
		try {
			const cur = location.pathname + location.search;
			if (cur !== url) {
				const { goto } = await import('$app/navigation');
				await goto(url);
			}
		} finally {
			navigating = false;
		}
	}

	async function handleResume() {
		// BC-Listener war beim Mount synchron schon attached — etwaige
		// laufende Nachrichten landen dort. Hier zusätzlich aktiv die IDB lesen
		// (Backup-Pfad, falls SW gepostet hat bevor wir subscribed waren).
		const pending = await consumePendingDeeplinkWithRetry();
		if (pending) {
			lastDeeplinkAt = Date.now();
			await navigateTo(pending);
		} else if (Date.now() - lastDeeplinkAt > 2000) {
			const matchId = await findGeofenceMatch();
			if (matchId) await navigateTo(`/listen/${matchId}`);
		}
		// Egal ob navigiert oder nicht: gestrandete Mutations rausschieben.
		void drainPendingMutations();
	}

	// Gemeinsamer Handler für beide Push-Kanäle (Service-Worker-postMessage UND
	// BroadcastChannel). navigateTo hat einen 'navigating'-Riegel und
	// consumePendingDeeplink löscht atomar — Doppel-Zustellung über beide Kanäle
	// ist damit harmlos (der zweite Read kommt leer zurück, navigateTo no-op'd).
	async function onDeeplinkMessage(data: { type?: string; url?: string } | undefined) {
		if (data?.type === 'deeplink' && typeof data.url === 'string') {
			await consumePendingDeeplink();
			lastDeeplinkAt = Date.now();
			await navigateTo(data.url);
			void drainPendingMutations();
		}
	}

	// Direkter Draht Service-Worker → laufende App. DAS ist der zuverlässige Pfad
	// für den Warm-Resume (App war im Hintergrund): der SW stellt den Deep-Link per
	// client.postMessage direkt zu, ohne Umweg über visibilitychange oder BC, die
	// iOS nach dem Tiefschlaf verschluckt.
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', (ev: MessageEvent) => {
			void onDeeplinkMessage(ev.data as { type?: string; url?: string } | undefined);
		});
	}

	// BroadcastChannel SOFORT anhängen — vor dem ersten IDB-Read, damit eine
	// Nachricht die zwischen Listener-Attach und IDB-Read eintrifft nicht
	// verloren geht. Backup-Pfad neben dem SW-postMessage oben.
	try {
		bc = new BroadcastChannel(DEEPLINK_CHANNEL);
		bc.onmessage = (ev) => {
			void onDeeplinkMessage(ev.data as { type?: string; url?: string } | undefined);
		};
	} catch { /* BC nicht verfügbar — IDB-Pfad reicht */ }

	// Initialer Check beim Mount (Cold-Start oder Hard-Reload)
	void handleResume();

	// Bei jedem Sichtbar-Werden nochmal checken (Resume aus Hintergrund/Suspend)
	function onVisibility() {
		if (document.visibilityState === 'visible') {
			resetLocationNavSession();
			void handleResume();
		}
	}
	document.addEventListener('visibilitychange', onVisibility);
}
