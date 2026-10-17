import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const repository = 'ghcr.io/peterthepeter/groly';

/** Freeze the published latest image before any candidate can replace its tag. */
export function resolveLatestImage() {
	const raw = execFileSync('docker', ['manifest', 'inspect', '--verbose', `${repository}:latest`], { encoding: 'utf8', timeout: 120_000 });
	const manifest = JSON.parse(raw);
	const entries = Array.isArray(manifest) ? manifest : [manifest];
	const candidate = entries.find(entry => entry.Descriptor?.platform?.architecture === 'amd64' && entry.Descriptor?.platform?.os === 'linux')
		?? (entries.length === 1 ? entries[0] : null);
	const digest = candidate?.Descriptor?.digest;
	assert(typeof digest === 'string' && /^sha256:[a-f0-9]{64}$/.test(digest), 'Cannot identify the published latest AMD64 image');
	return `${repository}@${digest}`;
}

/** @param {string} baseline */
export function baselineImage(baseline) {
	return baseline.startsWith(`${repository}@sha256:`) ? baseline : `${repository}:${baseline}`;
}
