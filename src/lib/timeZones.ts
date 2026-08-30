type ZonedDateTimeParts = {
	year: number;
	month: number;
	day: number;
	hour: number;
	minute: number;
	dateKey: string;
	time: string;
	weekday: number;
};

const formatters = new Map<string, Intl.DateTimeFormat>();

export function isValidTimeZone(timeZone: string | null | undefined): timeZone is string {
	if (!timeZone) return false;
	try {
		new Intl.DateTimeFormat('en', { timeZone }).format(0);
		return true;
	} catch {
		return false;
	}
}

export function resolveTimeZone(candidate: string | null | undefined, fallback?: string): string {
	if (isValidTimeZone(candidate)) return candidate;
	if (isValidTimeZone(fallback)) return fallback;
	return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}

function formatterFor(timeZone: string): Intl.DateTimeFormat {
	let formatter = formatters.get(timeZone);
	if (!formatter) {
		formatter = new Intl.DateTimeFormat('en-CA', {
			timeZone,
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hourCycle: 'h23'
		});
		formatters.set(timeZone, formatter);
	}
	return formatter;
}

export function getZonedDateTimeParts(date: Date, timeZone: string): ZonedDateTimeParts {
	const values: Record<string, string> = {};
	for (const part of formatterFor(timeZone).formatToParts(date)) {
		if (part.type !== 'literal') values[part.type] = part.value;
	}
	const year = Number(values.year);
	const month = Number(values.month);
	const day = Number(values.day);
	const hour = Number(values.hour);
	const minute = Number(values.minute);
	return {
		year,
		month,
		day,
		hour,
		minute,
		dateKey: `${values.year}-${values.month}-${values.day}`,
		time: `${values.hour}:${values.minute}`,
		weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay()
	};
}

/** Converts a wall-clock date/time in an IANA timezone to a Unix timestamp. */
export function zonedDateTimeToTimestamp(dateKey: string, time: string, timeZone: string): number {
	const [year, month, day] = dateKey.split('-').map(Number);
	const [hour, minute] = time.split(':').map(Number);
	const target = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
	let guess = target;

	for (let i = 0; i < 4; i += 1) {
		const parts = getZonedDateTimeParts(new Date(guess), timeZone);
		const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, 0, 0);
		const delta = target - represented;
		if (delta === 0) break;
		guess += delta;
	}

	return guess;
}

export function timeZoneFromSettings(settings: string | null | undefined, fallback?: string): string {
	try {
		const parsed = settings ? JSON.parse(settings) as { timeZone?: unknown } : {};
		return resolveTimeZone(typeof parsed.timeZone === 'string' ? parsed.timeZone : null, fallback);
	} catch {
		return resolveTimeZone(null, fallback);
	}
}
