// Date helpers used across the app. All functions operate in the LOCAL timezone.
//
// "DateKey" = "YYYY-MM-DD" string anchored to local calendar days. This is the
// canonical representation for per-day buckets (mood logs, schedules, etc).
//
// `dateKeyToDate` returns a Date anchored at noon (12:00) to avoid DST/midnight
// edge cases when later extracting weekday or formatting.

export function toLocalDateKey(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function tsToDateKey(ts: number): string {
	return toLocalDateKey(new Date(ts));
}

export function todayKey(): string {
	return toLocalDateKey(new Date());
}

export function dateKeyToDate(key: string): Date {
	return new Date(key + 'T12:00:00');
}

// Formats a timestamp (ms) as a localized HH:MM clock time.
export function formatTime(ts: number): string {
	return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
