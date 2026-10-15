import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Derive the only permitted public tags; manual verification has none. */
export function releasePolicy(eventName, event, version, repository) {
	assert(['workflow_dispatch', 'release'].includes(eventName), 'Unsupported workflow event');
	assert(typeof repository === 'string' && repository.trim() === repository && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(repository), 'Invalid GitHub repository');
	const image = `ghcr.io/${repository.toLowerCase()}`;
	if (eventName === 'workflow_dispatch') {
		return { mode: 'local', repository: image, localImage: 'groly:verify', version: '', versionTag: '', channelTag: '' };
	}

	// Docker tags cannot contain SemVer build metadata (+...). Reject malformed
	// prerelease identifiers rather than silently publishing a different name.
	assert(typeof version === 'string' && version.length <= 128, 'Invalid package version');
	const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
	assert(match?.[0] === version, 'Invalid package version');
	const prerelease = match[4] !== undefined;
	if (prerelease) {
		assert(match[4].split('.').every(id => /^[0-9A-Za-z-]+$/.test(id) && (!/^\d+$/.test(id) || id === '0' || !id.startsWith('0'))), 'Invalid prerelease version');
	}
	assert.equal(event.action, 'published', 'Release must be published');
	assert.equal(event.release?.draft, false, 'Draft releases cannot publish images');
	assert.equal(event.release?.tag_name, `v${version}`, 'Release tag must match package.json');
	assert.equal(event.release?.prerelease, prerelease, 'Release channel must match SemVer');
	return {
		mode: 'release', repository: image, localImage: '', version,
		versionTag: `${image}:${version}`,
		channelTag: `${image}:${prerelease ? 'beta' : 'latest'}`
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
	const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
	const policy = releasePolicy(process.env.GITHUB_EVENT_NAME, event, version, process.env.GITHUB_REPOSITORY);
	for (const [key, value] of Object.entries(policy)) process.stdout.write(`${key}=${value}\n`);
}
