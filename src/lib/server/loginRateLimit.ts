const attempts = new Map<string, { count: number; resetAt: number }>();

export function attemptsSize(): number {
	return attempts.size;
}

function pruneExpired() {
	const now = Date.now();
	for (const [ip, entry] of attempts) {
		if (now > entry.resetAt) attempts.delete(ip);
	}
}

// Abgelaufene Einträge stündlich bereinigen
setInterval(pruneExpired, 60 * 60 * 1000);

export function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = attempts.get(ip);
	if (!entry || now > entry.resetAt) {
		if (entry) attempts.delete(ip);
		attempts.set(ip, { count: 1, resetAt: now + 15 * 60 * 1000 });
		return true;
	}
	if (entry.count >= 10) return false;
	entry.count++;
	return true;
}
