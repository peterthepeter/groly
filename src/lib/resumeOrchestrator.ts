// Orchestriert Aktionen beim App-Resume (initialer Mount + Sichtbar-Werden aus dem
// Hintergrund):
//   1. Push-Deep-Link aus der persistenten IDB-Mailbox lesen → goto.
//      Auf iOS schreibt der Service-Worker den Eintrag nach langem Suspend erst
//      2-5 s nach dem Antippen (Cold-Boot des SW-Prozesses); DESHALB lesen wir nicht
//      einmalig, sondern beobachten die Mailbox geduldig bis ~7 s nach dem Aufwachen.
//      (postMessage/BroadcastChannel wurden bewusst entfernt: nach iOS-Suspend
//      nachweislich verworfen — die IDB-Mailbox ist der einzige verlässliche Weg.)
//   2. Kein Deep-Link → Geofence prüfen → ggf. goto zur passenden Liste.
//   3. Pending-Mutations-Queue antriggern — gestrandete Logs synchronisieren.

import { consumePendingDeeplink } from '$lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '$lib/locationNav';
import { drainPendingMutations } from '$lib/sync/manager';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let navigating = false;
	// Zeitpunkt der letzten Deep-Link-Navigation. Verhindert, dass ein verspäteter
	// Geofence-Treffer ein gerade per Push geöffnetes Sheet wieder wegnavigiert.
	let lastDeeplinkAt = 0;
	let watching = false;

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

	async function consumeAndNavigate(url: string) {
		lastDeeplinkAt = Date.now();
		await navigateTo(url);
		void drainPendingMutations();
	}

	// Geduldiges Beobachten der Mailbox: deckt die iOS-SW-Cold-Boot-Latenz ab (der
	// Eintrag landet teils erst 2-5 s nach dem Antippen). Bricht sofort ab, sobald
	// etwas da ist. Läuft im Hintergrund neben dem Geofence-Check; ein eintreffender
	// Deep-Link gewinnt gegen einen Geofence-Treffer (getippte Erinnerung hat Vorrang).
	async function watchForDeeplink() {
		if (watching) return;
		watching = true;
		try {
			const delays = [250, 250, 250, 250, 500, 500, 1000, 1000, 1000, 1000, 1000]; // ~7 s gesamt
			for (const d of delays) {
				await new Promise((r) => setTimeout(r, d));
				const url = await consumePendingDeeplink();
				if (url) { await consumeAndNavigate(url); return; }
			}
		} finally {
			watching = false;
		}
	}

	async function handleResume() {
		// 1) Sofort-Read — Kaltstart und warmer SW treffen hier direkt.
		const url = await consumePendingDeeplink();
		if (url) { await consumeAndNavigate(url); return; }

		// 2) Noch kein Deep-Link: Mailbox im Hintergrund weiter beobachten (späterer
		//    SW-Write) UND parallel den Geofence auf eigener, flotter Zeitschiene
		//    prüfen — so wird der Standort-Check nicht durch das ~7-s-Fenster verzögert.
		void watchForDeeplink();
		if (Date.now() - lastDeeplinkAt > 2000) {
			const matchId = await findGeofenceMatch();
			// Nochmal prüfen: falls der Watcher zwischenzeitlich einen Deep-Link
			// geöffnet hat, den Geofence-Treffer NICHT mehr drüberlegen.
			if (matchId && Date.now() - lastDeeplinkAt > 2000) {
				await navigateTo(`/listen/${matchId}`);
			}
		}
		void drainPendingMutations();
	}

	// Initialer Check beim Mount (Cold-Start oder Hard-Reload).
	void handleResume();

	// Bei jedem Sichtbar-Werden erneut prüfen (Resume aus Hintergrund/Suspend).
	// visibilitychange feuert auf iOS auch nach langem Suspend zuverlässig (per
	// Remote-Inspector belegt) — das kurze Entprellen fängt nur Doppel-Feuern ab.
	let lastResumeAt = 0;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		const now = Date.now();
		if (now - lastResumeAt < 500) return;
		lastResumeAt = now;
		resetLocationNavSession();
		void handleResume();
	});
}
