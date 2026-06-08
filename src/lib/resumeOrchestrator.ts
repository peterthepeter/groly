// Push-Deep-Links: EIN Mechanismus, mehrfach angestoßen.
//
// Die einzige Wahrheit ist die persistente IDB-Mailbox: der Service-Worker schreibt
// dort beim notificationclick IMMER die Ziel-Seite rein (kalt/warm/Suspend). Die App
// hat genau EINE Lese-Funktion (tryDeeplinkNow) — und ruft sie bei JEDEM verfügbaren
// Aufwach-Signal auf:
//   - Mount (Kaltstart)
//   - visibilitychange (sichtbar werden)
//   - window focus / pageshow
//   - Service-Worker-"Nudge" (client.postMessage) — wirkt im Warm-Fall sofort, auch
//     wenn visibilitychange vom Sperrbildschirm aus nicht feuert
// Keines dieser Signale ist allein zuverlässig; zusammen deckt immer eines den Moment
// ab. Das Lesen ist idempotent (atomarer Consume löscht den Eintrag, navigating-Riegel
// verhindert Doppel-Navigation), also sind mehrfache Auslöser harmlos.
//
// Weil der SW seinen Mailbox-Write nach tiefem Suspend erst 2-5 s nach dem Antippen
// committet, liest die Funktion nicht nur einmal, sondern fasst geduldig bis ~7 s nach.
//
// Geofence (Liste am Standort öffnen) läuft NUR beim Voll-Resume (Mount/sichtbar),
// nicht bei den Zusatz-Triggern — sonst gäbe es bei jedem Fokus eine GPS-Abfrage.

import { consumePendingDeeplink } from '$lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '$lib/locationNav';
import { drainPendingMutations } from '$lib/sync/manager';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	let navigating = false;
	let watching = false;
	// Zeitpunkt der letzten Deep-Link-Navigation. Verhindert, dass ein verspäteter
	// Geofence-Treffer ein gerade per Push geöffnetes Sheet wieder wegnavigiert.
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

	// Geduldiges Nachfassen: deckt die iOS-SW-Cold-Boot-Latenz ab (der Mailbox-Write
	// landet teils erst 2-5 s nach dem Antippen). Bricht sofort ab, sobald etwas da
	// ist. Guard verhindert mehrere parallele Watch-Schleifen.
	async function watchMailbox() {
		if (watching) return;
		watching = true;
		try {
			const delays = [250, 250, 250, 250, 500, 500, 1000, 1000, 1000, 1000, 1000]; // ~7 s
			for (const d of delays) {
				await new Promise((r) => setTimeout(r, d));
				const url = await consumePendingDeeplink();
				if (url) { lastDeeplinkAt = Date.now(); await navigateTo(url); void drainPendingMutations(); return; }
			}
		} finally {
			watching = false;
		}
	}

	// DIE EINE Lese-Funktion: Mailbox jetzt lesen; bei Treffer navigieren, sonst im
	// Hintergrund geduldig weiter beobachten. Gibt true zurück, wenn ein Deep-Link
	// geöffnet wurde (für die Geofence-Entscheidung).
	async function tryDeeplinkNow(): Promise<boolean> {
		const url = await consumePendingDeeplink();
		if (url) { lastDeeplinkAt = Date.now(); await navigateTo(url); void drainPendingMutations(); return true; }
		void watchMailbox();
		return false;
	}

	// Voll-Resume (Mount / sichtbar werden): erst Deep-Link, sonst Geofence.
	async function handleResume() {
		if (await tryDeeplinkNow()) return;
		if (Date.now() - lastDeeplinkAt > 2000) {
			const matchId = await findGeofenceMatch();
			// Falls der Watcher zwischenzeitlich einen Deep-Link geöffnet hat, den
			// Geofence-Treffer NICHT mehr drüberlegen.
			if (matchId && Date.now() - lastDeeplinkAt > 2000) await navigateTo(`/listen/${matchId}`);
		}
		void drainPendingMutations();
	}

	// ── Auslöser ────────────────────────────────────────────────────────────────

	// 1) Mount (Kaltstart / Hard-Reload).
	void handleResume();

	// 2) Sichtbar werden — Voll-Resume inkl. Geofence (entprellt gegen Doppel-Feuern).
	let lastResumeAt = 0;
	document.addEventListener('visibilitychange', () => {
		if (document.visibilityState !== 'visible') return;
		const now = Date.now();
		if (now - lastResumeAt < 600) return;
		lastResumeAt = now;
		resetLocationNavSession();
		void handleResume();
	});

	// 3) Zusatz-Trigger NUR für den Deep-Link (kein Geofence → keine GPS-Abfrage):
	//    window focus, pageshow und der direkte SW-Nudge. Sie lesen denselben
	//    Briefkasten — so wird er auch dann gelesen, wenn visibilitychange mal nicht
	//    feuert (Antippen vom Sperrbildschirm/Standby).
	window.addEventListener('focus', () => void tryDeeplinkNow());
	window.addEventListener('pageshow', () => void tryDeeplinkNow());
	if ('serviceWorker' in navigator) {
		navigator.serviceWorker.addEventListener('message', (ev: MessageEvent) => {
			const data = ev.data as { type?: string } | undefined;
			if (data?.type === 'deeplink-nudge') void tryDeeplinkNow();
		});
	}
}
