// Orchestriert Aktionen beim App-Resume (initialer Mount + Sichtbar-Werden aus
// dem Hintergrund). Reihenfolge:
//   1. Pending Push-Deep-Link aus IndexedDB konsumieren → goto
//   2. Wenn kein Deep-Link: Geofence prüfen → goto zur passenden Liste
//
// Push hat Priorität, Geofence ist Fallback. Beide Pfade laufen jetzt
// Layout-weit (vorher war Geofence nur auf der Listen-Übersichts-Seite,
// und Push verließ sich auf SW-postMessage, der nach langem iOS-Suspend
// stumm bleibt — siehe pendingDeeplink.ts).

import { consumePendingDeeplinkWithRetry } from '$lib/pendingDeeplink';
import { findGeofenceMatch, resetLocationNavSession } from '$lib/locationNav';

export function initResumeOrchestrator() {
	if (typeof window === 'undefined') return;

	async function handleResume() {
		const { goto } = await import('$app/navigation');
		const pending = await consumePendingDeeplinkWithRetry();
		if (pending) {
			const cur = location.pathname + location.search;
			if (cur !== pending) goto(pending);
			return;
		}
		const matchId = await findGeofenceMatch();
		if (matchId) goto(`/listen/${matchId}`);
	}

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
