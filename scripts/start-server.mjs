import { configureOrigin } from './runtime-origin.mjs';

// Configure the adapter before its modules read the environment. The listener is
// installed before the event loop can accept requests, retaining adapter shutdown.
const applyOrigin = configureOrigin(process.env);
const { server } = await import('../build/index.js');
server.prependListener('request', applyOrigin);
process.on('sveltekit:shutdown', () => process.exit(0));
