import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

/** Select the explicitly configured verification level, never from the version. */
export function releaseVerification(config, override) {
	const valid = value => value === 'standard' || value === 'full';
	assert(config && valid(config.verification), 'Release verification must be standard or full');
	if (override === undefined || override === '') return config.verification;
	assert(valid(override), 'Release verification override must be standard or full');
	return override;
}

/** Bind a draft release to the exact commit being checked. A verification-only run cannot publish. */
export function releasePolicy(version, repository, draft = null, ref = '', sha = '') {
	assert(typeof repository === 'string' && repository.trim() === repository && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(repository), 'Invalid GitHub repository');
	const image = `ghcr.io/${repository.toLowerCase()}`;
	if (!draft) return { mode: 'local', repository: image, localImage: 'groly:verify' };

	// Docker tags cannot contain SemVer build metadata (+...). Reject malformed
	// prerelease identifiers rather than silently publishing a different name.
	assert(typeof version === 'string' && version.length <= 128, 'Invalid package version');
	const match = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z.-]+))?$/.exec(version);
	assert(match?.[0] === version, 'Invalid package version');
	const prerelease = match[4] !== undefined;
	if (prerelease) {
		assert(match[4].split('.').every(id => /^[0-9A-Za-z-]+$/.test(id) && (!/^\d+$/.test(id) || id === '0' || !id.startsWith('0'))), 'Invalid prerelease version');
	}
	const gitTag = `v${version}`;
	const branch = prerelease ? 'codex/groly-1.0' : 'main';
	const channel = prerelease ? 'beta' : 'latest';
	assert.equal(draft.draft, true, 'Release must be a draft until verification succeeds');
	assert.equal(draft.tag_name, gitTag, 'Release tag must match package.json');
	assert.equal(draft.prerelease, prerelease, 'Release channel must match SemVer');
	assert.equal(ref, `refs/heads/${branch}`, 'Release must be run from its channel branch');
	assert(/^[0-9a-f]{40}$/.test(sha), 'Invalid commit SHA');
	assert.equal(draft.target_commitish, sha, 'Draft release must target the exact commit being verified');
	return {
		mode: 'release', repository: image, localImage: 'groly:verify', version, gitTag, branch, channel,
		versionTag: `${image}:${version}`,
		channelTag: `${image}:${channel}`
	};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
	const config = JSON.parse(readFileSync('.github/release.json', 'utf8'));
	const draft = process.env.GROLY_RELEASE_DRAFT ? JSON.parse(readFileSync(process.env.GROLY_RELEASE_DRAFT, 'utf8')) : null;
	if (process.env.GROLY_RELEASE_ID) {
		assert(draft && String(draft.id) === process.env.GROLY_RELEASE_ID, 'Release draft does not match the requested ID');
		assert.equal(draft.tag_name, process.env.GROLY_RELEASE_TAG, 'Release draft does not match the requested tag');
	} else {
		assert(!process.env.GROLY_RELEASE_TAG, 'A release tag requires a draft release ID');
	}
	const verification = releaseVerification(config, draft ? undefined : process.env.GROLY_VERIFICATION_INPUT);
	const policy = releasePolicy(version, process.env.GITHUB_REPOSITORY, draft, process.env.GITHUB_REF, process.env.GITHUB_SHA);
	for (const [key, value] of Object.entries({ ...policy, verification })) process.stdout.write(`${key}=${value}\n`);
}
