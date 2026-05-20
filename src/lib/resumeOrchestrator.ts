// Orchestriert Aktionen beim App-Resume (initialer Mount + Sichtbar-Werden aus
// dem Hintergrund). Reihenfolge:
//   1. Push-Deep-Link konsumieren → goto
//      - Primärpfad: BroadcastChannel-Nachricht vom Service-Worker
//      - Backup-Pfad: IndexedDB-Briefkasten (für den Fall dass der SW postet
//        bevor der App-Listener subscribed war, oder iOS BC im Tiefschlaf droppt)
//   2. Wenn kein Deep-Link: Geofence prüfen → goto zur passenden Liste
//   3. Pending-Mutations-Queue antriggern — gestrandete Logs synchronisieren

import { consumePendingDeeplink, DEEPLINK_CHANNEL } from '$lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '$lib/locationNav';
import { drainPendingMutations } from '$lib/sync/manager';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let bc: BroadcastChannel | null = null;
	let navigating = false;

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
		const pending = await consumePendingDeeplink();
		if (pending) {
			await navigateTo(pending);
		} else {
			const matchId = await findGeofenceMatch();
			if (matchId) await navigateTo(`/listen/${matchId}`);
		}
		// Egal ob navigiert oder nicht: gestrandete Mutations rausschieben.
		void drainPendingMutations();
	}

	// BroadcastChannel SOFORT anhängen — vor dem ersten IDB-Read, damit eine
	// Nachricht die zwischen Listener-Attach und IDB-Read eintrifft nicht
	// verloren geht.
	try {
		bc = new BroadcastChannel(DEEPLINK_CHANNEL);
		bc.onmessage = async (ev) => {
			const data = ev.data as { type?: string; url?: string } | undefined;
			if (data?.type === 'deeplink' && typeof data.url === 'string') {
				// Atomarer Read löscht die IDB-Eintrag — verhindert dass der spätere
				// visibility-Read denselben Deeplink nochmal verarbeitet.
				await consumePendingDeeplink();
				await navigateTo(data.url);
				void drainPendingMutations();
			}
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
