import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';

const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const [name, metadata] of Object.entries(lock.packages)) {
	assert(!metadata.deprecated, `Deprecated dependency: ${name}: ${metadata.deprecated}`);
	assert(!name.includes('@esbuild-kit/'), `Abandoned loader returned: ${name}`);
}
assert.equal(lock.packages['node_modules/glob'].version, '13.0.6');
const drizzle = lock.packages['node_modules/drizzle-kit'];
assert.equal(drizzle.version, '0.31.11');
assert(!drizzle.dependencies['@esbuild-kit/esm-loader']);
const archive = readFileSync('vendor/drizzle-kit-0.31.11.tgz');
assert.equal(drizzle.integrity, `sha512-${createHash('sha512').update(archive).digest('base64')}`, 'Vendored archive and lock integrity differ');
assert(statSync('vendor/drizzle-kit-0.31.11.tgz').size > 0);
console.log('Dependency inventory verified: no deprecated packages or abandoned loaders; patched archive matches its lockfile integrity.');
