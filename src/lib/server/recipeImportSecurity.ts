import { lookup } from 'dns/promises';
import { isIP } from 'net';

export function isPrivateIpAddress(rawAddress: string): boolean {
	const address = rawAddress.toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
	const mappedIpv4 = address.match(/^(?:::ffff:)?(\d+\.\d+\.\d+\.\d+)$/)?.[1];
	if (mappedIpv4) {
		const parts = mappedIpv4.split('.').map(Number);
		if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
		const [a, b, c] = parts;
		return a === 0
			|| a === 10
			|| a === 127
			|| (a === 100 && b >= 64 && b <= 127)
			|| (a === 169 && b === 254)
			|| (a === 172 && b >= 16 && b <= 31)
			|| (a === 192 && (b === 0 || b === 168))
			|| (a === 198 && (b === 18 || b === 19))
			|| (a === 198 && b === 51 && c === 100)
			|| (a === 203 && b === 0 && c === 113)
			|| a >= 224;
	}
	if (isIP(address) === 6) {
		return address === '::'
			|| address === '::1'
			|| address.startsWith('::ffff:')
			|| /^f[cd]/.test(address)
			|| /^fe[89ab]/.test(address)
			|| /^ff/.test(address);
	}
	return true;
}

export function parsePublicRecipeUrl(raw: string): URL | null {
	let parsed: URL;
	try {
		parsed = new URL(raw);
	} catch {
		return null;
	}
	if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
	if (parsed.username || parsed.password) return null;
	const host = parsed.hostname.toLowerCase();
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return null;
	// Domain names are resolved below. Only pass literal IP addresses to the IP-range check.
	const literalIp = host.replace(/^\[|\]$/g, '');
	if (isIP(literalIp) !== 0 && isPrivateIpAddress(literalIp)) return null;
	return parsed;
}

export async function validateResolvedRecipeUrl(raw: string): Promise<URL | null> {
	const parsed = parsePublicRecipeUrl(raw);
	if (!parsed) return null;
	try {
		const addresses = await lookup(parsed.hostname, { all: true, verbatim: true });
		if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIpAddress(address))) return null;
	} catch {
		return null;
	}
	return parsed;
}
