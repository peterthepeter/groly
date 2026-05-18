// Geofence-Helper: prüft GPS und gibt die ID einer passenden Liste zurück.
// Event-Listener-Registrierung passiert im resumeOrchestrator, nicht hier —
// dieses Modul ist reine Logik.

import { getOfflineLists } from '$lib/sync/manager';
import { userSettings } from '$lib/userSettings.svelte';

const RADIUS_M = 100;
const SESSION_KEY = 'groly_loc_nav_done';

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 6371000;
	const dLat = (lat2 - lat1) * Math.PI / 180;
	const dLng = (lng2 - lng1) * Math.PI / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getCurrentPosition(): Promise<GeolocationPosition> {
	return new Promise((resolve, reject) => {
		navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 8000, maximumAge: 30000 });
	});
}

export function resetLocationNavSession() {
	try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

export async function findGeofenceMatch(): Promise<string | null> {
	if (!userSettings.locationNavEnabled) return null;
	if (!('geolocation' in navigator)) return null;
	try {
		if (sessionStorage.getItem(SESSION_KEY)) return null;
		sessionStorage.setItem(SESSION_KEY, '1');
	} catch { /* ignore */ }

	let pos: GeolocationPosition;
	try {
		pos = await getCurrentPosition();
	} catch {
		return null;
	}
	const { latitude, longitude } = pos.coords;

	const lists = await getOfflineLists();
	const match = lists.find(l =>
		l.locationLat != null &&
		l.locationLng != null &&
		!userSettings.isListLocationDisabled(l.id) &&
		haversineDistance(latitude, longitude, l.locationLat, l.locationLng) <= RADIUS_M
	);
	return match?.id ?? null;
}
