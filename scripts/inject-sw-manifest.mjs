/**
 * Workaround for vite-plugin-pwa 1.2.0 + Vite 7 environments bug:
 * closeBundle fires for both client and ssr environments, causing buildSW to run twice.
 * The second run overwrites the correctly manifest-injected service-worker.js.
 * This script re-injects the precache manifest after the full build completes.
 */
import { injectManifest } from 'workbox-build';
import { createReadStream } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { createBrotliCompress, createGzip } from 'node:zlib';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';

const swDest = 'build/client/service-worker.js';

const { count, size } = await injectManifest({
	swSrc: swDest,
	swDest: swDest,
	globDirectory: 'build/client',
	globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
	injectionPoint: 'self.__WB_MANIFEST',
});

console.log(`SW precache manifest injected: ${count} entries, ${Math.round(size / 1024)} KiB`);

// Regenerate compressed variants so the server serves correct content
await pipeline(
	createReadStream(swDest),
	createBrotliCompress(),
	createWriteStream(`${swDest}.br`),
);
await pipeline(
	createReadStream(swDest),
	createGzip(),
	createWriteStream(`${swDest}.gz`),
);
console.log('SW compressed variants regenerated (.br, .gz)');
