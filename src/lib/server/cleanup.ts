import { db } from '$lib/db';
import { barcodeCache, items, itemHistory, sessions, supplementLogs, mealPlanEntries, userInvites } from '$lib/db/schema';
import { and, eq, lt, or, isNotNull } from 'drizzle-orm';

const SIX_MONTHS_MS = 6 * 30 * 24 * 60 * 60 * 1000;
const TWO_MONTHS_S = 60 * 24 * 60 * 60;
const SIX_MONTHS_S = 6 * 30 * 24 * 60 * 60;
const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;
const THIRTY_DAYS_S = 30 * 24 * 60 * 60;

export function cleanupBarcodeCache() {
	db.delete(barcodeCache).where(lt(barcodeCache.lastSeenAt, Date.now() - SIX_MONTHS_MS)).run();
}

export function cleanupOldData() {
	const nowS = Math.floor(Date.now() / 1000);
	// Abgehakte Items löschen, die älter als 60 Tage sind
	db.delete(items).where(and(eq(items.isChecked, true), lt(items.checkedAt, nowS - TWO_MONTHS_S))).run();
	// Vorschläge löschen, die seit mehr als 6 Monaten nicht genutzt wurden
	db.delete(itemHistory).where(lt(itemHistory.lastUsedAt, nowS - SIX_MONTHS_S)).run();
	// Supplement-Logs älter als 2 Jahre löschen
	db.delete(supplementLogs).where(lt(supplementLogs.loggedAt, Date.now() - TWO_YEARS_MS)).run();
	// Abgelaufene Sessions löschen
	db.delete(sessions).where(lt(sessions.expiresAt, nowS)).run();
	// Wochenplan-Einträge löschen, die älter als 6 Monate sind
	const sixMonthsAgoDate = new Date(Date.now() - SIX_MONTHS_MS);
	const cutoffDate = sixMonthsAgoDate.toISOString().slice(0, 10);
	db.delete(mealPlanEntries).where(lt(mealPlanEntries.date, cutoffDate)).run();
	// Invite-/Reset-Tokens löschen: verbrauchte ODER seit 30 Tagen abgelaufene
	const inviteCutoff = nowS - THIRTY_DAYS_S;
	db.delete(userInvites).where(or(isNotNull(userInvites.usedAt), lt(userInvites.expiresAt, inviteCutoff))).run();
}
