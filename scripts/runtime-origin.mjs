/** Preserve the deployment's existing runtime ORIGIN without trusting client headers.
 * @param {NodeJS.ProcessEnv} env
 */
export function configureOrigin(env) {
	const configured = env.ORIGIN?.trim();
	if (!configured) {
		// Direct HTTP remains usable without proxy headers, as in docker-compose.
		env.PROTOCOL_HEADER ||= 'x-groly-direct-protocol';
		const direct = env.PROTOCOL_HEADER === 'x-groly-direct-protocol';
		return /** @param {import('node:http').IncomingMessage} req */ (req) => {
			if (direct) req.headers['x-groly-direct-protocol'] = 'http';
		};
	}
	let origin;
	try { origin = new URL(configured); }
	catch { throw new Error('ORIGIN must be an absolute http:// or https:// origin'); }
	if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) {
		throw new Error('ORIGIN must contain only the http(s) scheme, hostname, and optional port');
	}
	env.ORIGIN = origin.origin;
	env.PROTOCOL_HEADER = 'x-groly-runtime-protocol';
	env.HOST_HEADER = 'x-groly-runtime-host';
	delete env.PORT_HEADER;
	return /** @param {import('node:http').IncomingMessage} req */ (req) => {
		req.headers['x-groly-runtime-protocol'] = origin.protocol.slice(0, -1);
		req.headers['x-groly-runtime-host'] = origin.host;
	};
}
