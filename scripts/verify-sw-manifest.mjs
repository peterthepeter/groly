import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { gunzipSync, brotliDecompressSync } from 'node:zlib';

// Verify only: adapter-node 6 records asset sizes and hashes at build time.
// Mutating generated files afterwards would invalidate that metadata.
const files = await readdir('build/client');
const worker = files.find(file => file === 'service-worker.js' || file === 'index.js');
assert(worker, 'Service worker missing from the production build');
const source = await readFile(`build/client/${worker}`);
assert(!source.includes(Buffer.from('self.__WB_MANIFEST')), 'Service worker precache manifest was not injected');
assert(source.includes(Buffer.from('_app/immutable/')), 'Service worker does not precache application assets');
for (const [extension, decode] of [['gz', gunzipSync], ['br', brotliDecompressSync]]) {
	try { assert.deepEqual(decode(await readFile(`build/client/${worker}.${extension}`)), source, `Stale ${extension} service worker`); }
	catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Verified ${worker}: injected precache manifest and matching compressed assets`);
