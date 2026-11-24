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

export function toLocalTimeKey(d: Date): string {
	return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
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

export const DATE_FORMATS = ['dmy-dot', 'dmy-slash', 'mdy-slash', 'ymd-dash'] as const;
export const TIME_FORMATS = ['24h', '12h'] as const;
export type DateFormat = (typeof DATE_FORMATS)[number];
export type TimeFormat = (typeof TIME_FORMATS)[number];

export function isDateFormat(value: unknown): value is DateFormat {
	return DATE_FORMATS.some(format => format === value);
}

export function isTimeFormat(value: unknown): value is TimeFormat {
	return TIME_FORMATS.some(format => format === value);
}

export function detectRegionalFormats(locale?: string): { dateFormat: DateFormat; timeFormat: TimeFormat } {
	const parts = new Intl.DateTimeFormat(locale, { year: 'numeric', month: '2-digit', day: '2-digit' })
		.formatToParts(new Date(2026, 10, 23, 12));
	const first = parts.find(part => part.type === 'year' || part.type === 'month' || part.type === 'day');
	const separator = parts.find(part => part.type === 'literal')?.value;
	const dateFormat = first?.type === 'year' ? 'ymd-dash'
		: first?.type === 'month' ? 'mdy-slash'
		: separator?.includes('.') ? 'dmy-dot' : 'dmy-slash';
	const { hourCycle } = new Intl.DateTimeFormat(locale, { hour: 'numeric' }).resolvedOptions();
	const timeFormat = hourCycle === 'h11' || hourCycle === 'h12' ? '12h' : '24h';
	return { dateFormat, timeFormat };
}

export function formatDateKey(dateKey: string, format: DateFormat = 'dmy-dot', includeYear = true): string {
	if (!dateKey) return '';
	const [year, month, day] = dateKey.split('-');
	switch (format) {
		case 'dmy-slash': return includeYear ? `${day}/${month}/${year}` : `${day}/${month}`;
		case 'mdy-slash': return includeYear ? `${month}/${day}/${year}` : `${month}/${day}`;
		case 'ymd-dash': return includeYear ? dateKey : `${month}-${day}`;
		default: return includeYear ? `${day}.${month}.${year}` : `${day}.${month}.`;
	}
}

export function formatClockTime(timeKey: string, format?: TimeFormat): string {
	if (format !== '12h' || !timeKey) return timeKey;
	const [hours, minutes] = timeKey.split(':');
	const hour = Number(hours);
	return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatTime(ts: number, format?: TimeFormat, locale?: string): string {
	const date = new Date(ts);
	if (format) return formatClockTime(toLocalTimeKey(date), format);
	return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

export function formatCalendarDate(
	date: Date,
	format: DateFormat | undefined,
	options: Intl.DateTimeFormatOptions,
	locale?: string
): string {
	if (!format || !options.day || !options.month) return date.toLocaleDateString(locale, options);
	const value = formatDateKey(toLocalDateKey(date), format, Boolean(options.year));
	return options.weekday ? `${date.toLocaleDateString(locale, { weekday: options.weekday })}, ${value}` : value;
}
