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
assert(source.includes(Buffer.from('offline.html')), 'Offline fallback absent from precache');
const offlinePage = await readFile('build/client/offline.html', 'utf8');
assert(offlinePage.includes('data-offline-fallback'), 'Offline fallback missing');
assert(!/<(?:script|link|img)[^>]+(?:src|href)=/i.test(offlinePage), 'Offline fallback must work without external assets');
// The prebundled PDF runtime is loaded as a versioned vendor asset. All original
// font faces must remain in the offline precache, with real font bytes intact.
const assets = await readdir('build/client/_app/immutable/assets');
for (const name of ['Roboto-Regular', 'Roboto-Medium', 'Roboto-Italic', 'Roboto-MediumItalic', 'pdfmake.min']) {
	const asset = assets.find(file => file.startsWith(`${name}.`) && /\.(ttf|js)$/.test(file));
	assert(asset, `Missing PDF asset: ${name}`);
	assert(source.includes(Buffer.from(asset)), `PDF asset absent from offline precache: ${asset}`);
	const bytes = await readFile(`build/client/_app/immutable/assets/${asset}`);
	if (asset.endsWith('.ttf')) assert.equal(bytes.subarray(0, 4).toString('hex'), '00010000', `Invalid font: ${asset}`);
	else assert(bytes.length < 1_500_000, 'Prebundled PDF vendor asset exceeded its explicit size budget');
}
for (const chunk of await readdir('build/client/_app/immutable/chunks')) {
	if (chunk.endsWith('.js')) assert((await readFile(`build/client/_app/immutable/chunks/${chunk}`)).length < 500_000, `Oversized application chunk: ${chunk}`);
}
for (const [extension, decode] of [['gz', gunzipSync], ['br', brotliDecompressSync]]) {
	try { assert.deepEqual(decode(await readFile(`build/client/${worker}.${extension}`)), source, `Stale ${extension} service worker`); }
	catch (error) { if (error.code !== 'ENOENT') throw error; }
}
console.log(`Verified ${worker}: injected precache manifest and matching compressed assets`);
