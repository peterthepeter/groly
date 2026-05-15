const SECURITY_HEADERS: Record<string, string> = {
	'X-Content-Type-Options': 'nosniff',
	'X-Frame-Options': 'DENY',
	'Referrer-Policy': 'strict-origin-when-cross-origin',
	'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()'
};

const CSP = [
	"default-src 'self'",
	"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
	"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
	"font-src 'self' https://fonts.gstatic.com",
	"img-src 'self' data: https:",
	"connect-src 'self'",
	"worker-src 'self' blob:",
	"manifest-src 'self'",
	"frame-ancestors 'none'"
].join('; ');

export function applySecurityHeaders(response: Response) {
	for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
		response.headers.set(key, value);
	}
	if (response.headers.get('content-type')?.includes('text/html')) {
		response.headers.set('Content-Security-Policy', CSP);
	}
}
