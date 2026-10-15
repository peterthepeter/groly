import { spawn } from 'node:child_process';

// Make actionable build warnings a failed gate instead of publishing a green
// image with deprecations. Stream the original diagnostics without filtering.
const env = { ...process.env };
if ('NO_COLOR' in env) delete env.FORCE_COLOR;
const child = spawn(process.execPath, ['node_modules/vite/bin/vite.js', 'build'], { env, stdio: ['inherit', 'pipe', 'pipe'] });
let diagnostics = '';
for (const [stream, target] of [[child.stdout, process.stdout], [child.stderr, process.stderr]]) {
	stream.on('data', chunk => { diagnostics += chunk.toString(); target.write(chunk); });
}
const code = await new Promise((resolve, reject) => {
	child.on('error', reject);
	child.on('exit', (code, signal) => resolve(signal ? 1 : code));
});
if (code !== 0) process.exit(Number(code) || 1);
const plain = diagnostics.replace(/\u001b\[[0-9;]*m/g, '');
if (/\bWarning:|\bWARN\b|\bdeprecated\b|\(!\)/i.test(plain)) {
	console.error('Build rejected: resolve the emitted warnings before release.');
	process.exit(1);
}
await import('./verify-sw-manifest.mjs');
