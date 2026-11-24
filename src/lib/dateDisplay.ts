import { formatCalendarDate, formatClockTime, formatTime } from '#lib/dates';
import { userSettings } from '#lib/userSettings.svelte';

export function displayDate(date: Date, options: Intl.DateTimeFormatOptions, locale?: string): string {
	return formatCalendarDate(date, userSettings.dateFormat, options, locale);
}

export function displayTime(value: number | string, locale?: string): string {
	return typeof value === 'string'
		? formatClockTime(value, userSettings.timeFormat)
		: formatTime(value, userSettings.timeFormat, locale);
}

export function displayDateTime(date: Date, options: Intl.DateTimeFormatOptions, locale?: string): string {
	if (!userSettings.dateFormat && !userSettings.timeFormat) {
		return date.toLocaleString(locale, { ...options, hour: '2-digit', minute: '2-digit' });
	}
	return `${displayDate(date, options, locale)} · ${displayTime(date.getTime(), locale)}`;
}
