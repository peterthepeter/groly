import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

// A metadata-only patch of the stable upstream release. npm installs dependencies
// before lifecycle scripts, so a postinstall patch cannot remove this dead tree.
const version = '0.31.11';
const upstreamIntegrity = 'sha512-YCYqxTLIB2OCqf6w9/Vef13baBVbwQIPcbT4Y56AfO6B9ajZhDhD8Jkveg/hJvT/iuMloKD/IYYkyMMNhr7Kqg==';
const url = `https://registry.npmjs.org/drizzle-kit/-/drizzle-kit-${version}.tgz`;
const directory = await mkdtemp(path.join(tmpdir(), 'groly-drizzle-vendor-'));
const destination = path.resolve('vendor');
try {
	const response = await fetch(url);
	assert(response.ok, `Upstream download failed: ${response.status}`);
	const archive = Buffer.from(await response.arrayBuffer());
	assert.equal(`sha512-${createHash('sha512').update(archive).digest('base64')}`, upstreamIntegrity, 'Upstream archive integrity changed');
	const source = path.join(directory, 'upstream.tgz');
	await writeFile(source, archive);
	execFileSync('tar', ['-xzf', source, '-C', directory]);
	const packageDirectory = path.join(directory, 'package');
	for (const filename of await readdir(packageDirectory)) {
		if (/\.(?:cjs|mjs|js)$/.test(filename)) {
			assert(!/esbuild-kit|esm-loader/.test(await readFile(path.join(packageDirectory, filename), 'utf8')), `Loader is used in ${filename}; reassess patch`);
		}
	}
	const filename = path.join(packageDirectory, 'package.json');
	const metadata = JSON.parse(await readFile(filename, 'utf8'));
	assert.equal(metadata.version, version);
	assert.equal(metadata.dependencies['@esbuild-kit/esm-loader'], '^2.5.5');
	delete metadata.dependencies['@esbuild-kit/esm-loader'];
	await writeFile(filename, JSON.stringify(metadata, null, 2) + '\n');
	await mkdir(destination, { recursive: true });
	execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', destination], { cwd: packageDirectory });
	console.log(`Rebuilt vendor/drizzle-kit-${version}.tgz from verified upstream; only the unused loader declaration was removed.`);
} finally {
	await rm(directory, { recursive: true, force: true });
}
