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
		// Only global unicast. Exclude documentation and transition ranges whose
		// embedded IPv4 address could route back into the operator's network.
		return !/^[23][0-9a-f]{3}:/.test(address)
			|| address.startsWith('2001:db8:')
			|| address.startsWith('2001:0:')
			|| address.startsWith('2001::')
			|| address.startsWith('2002:');
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
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return null;
	// Domain names are resolved below. Only pass literal IP addresses to the IP-range check.
	const literalIp = host.replace(/^\[|\]$/g, '');
	if (isIP(literalIp) !== 0 && isPrivateIpAddress(literalIp)) return null;
	return parsed;
}

export async function validateResolvedRecipeUrl(raw: string): Promise<URL | null> {
	return (await resolvePublicUrl(raw))?.url ?? null;
}

export async function resolvePublicUrl(raw: string): Promise<{ url: URL; addresses: Awaited<ReturnType<typeof resolveAddresses>> } | null> {
	const parsed = parsePublicRecipeUrl(raw);
	if (!parsed) return null;
	try {
		const addresses = await resolveAddresses(parsed.hostname.replace(/^\[|\]$/g, ''));
		if (addresses.length === 0 || addresses.some(({ address }) => isPrivateIpAddress(address))) return null;
		return { url: parsed, addresses };
	} catch {
		return null;
	}
}

function resolveAddresses(host: string) {
	return lookup(host, { all: true, verbatim: true });
}
