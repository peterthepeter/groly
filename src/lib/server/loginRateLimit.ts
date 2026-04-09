const attempts = new Map<string, { count: number; resetAt: number }>();

export function attemptsSize(): number {
	return attempts.size;
}

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
