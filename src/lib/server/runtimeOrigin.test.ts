import { describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import { configureOrigin } from '../../../scripts/runtime-origin.mjs';

describe('runtime ORIGIN compatibility', () => {
	it.each(['https://groly.example.com', 'http://localhost:3100', 'http://[::1]:3000'])('retains %s regardless of spoofed proxy headers', origin => {
		const env = { ORIGIN: origin, HOST_HEADER: 'x-forwarded-host', PORT_HEADER: 'x-forwarded-port' };
		const apply = configureOrigin(env);
		const req = { headers: { 'x-groly-runtime-host': 'attacker.example', 'x-groly-runtime-protocol': 'http', 'x-forwarded-host': 'attacker.example' } } as unknown as IncomingMessage;
		apply(req);
		expect(req.headers['x-groly-runtime-host']).toBe(new URL(origin).host);
		expect(req.headers['x-groly-runtime-protocol']).toBe(new URL(origin).protocol.slice(0, -1));
		expect(env.PORT_HEADER).toBeUndefined();
	});
	it('does not enable trust in forwarded headers for direct HTTP', () => {
		const env: NodeJS.ProcessEnv = {};
		const apply = configureOrigin(env);
		const req = { headers: { 'x-groly-direct-protocol': 'https' } } as unknown as IncomingMessage;
		apply(req);
		expect(req.headers['x-groly-direct-protocol']).toBe('http');
		expect(env.HOST_HEADER).toBeUndefined();
	});
	it('normalizes ORIGIN so HTTPS session cookies remain secure', () => {
		const env = { ORIGIN: ' HTTPS://Groly.Example.com/ ' };
		configureOrigin(env);
		expect(env.ORIGIN).toBe('https://groly.example.com');
	});
	it('preserves explicitly configured proxy protocol headers without ORIGIN', () => {
		const env = { PROTOCOL_HEADER: 'x-forwarded-proto' };
		const req = { headers: { 'x-forwarded-proto': 'https' } } as unknown as IncomingMessage;
		configureOrigin(env)(req);
		expect(req.headers['x-forwarded-proto']).toBe('https');
	});
	it.each(['ftp://example.com', 'https://user:password@example.com', 'https://example.com/path', 'https://example.com?query=1', 'example.com'])('rejects malformed ORIGIN %s', origin => {
		expect(() => configureOrigin({ ORIGIN: origin })).toThrow('ORIGIN');
	});
});
