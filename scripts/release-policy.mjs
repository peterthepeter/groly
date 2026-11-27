import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

/** Select the explicitly configured verification level, never from the version. */
export function releaseVerification(config, override) {
	const valid = value => value === 'standard' || value === 'full';
	assert(config && valid(config.verification), 'Release verification must be standard or full');
	if (override === undefined || override === '') return config.verification;
	assert(valid(override), 'Release verification override must be standard or full');
	return override;
}

function imageRepository(repository) {
	assert(typeof repository === 'string' && repository.trim() === repository && /^[a-z0-9][a-z0-9._-]*\/[a-z0-9][a-z0-9._-]*$/i.test(repository), 'Invalid GitHub repository');
	return `ghcr.io/${repository.toLowerCase()}`;
}

function releaseTarget(version, repository, ref, sha) {
	const image = imageRepository(repository);

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
	assert.equal(ref, `refs/heads/${branch}`, 'Release must be run from its channel branch');
	assert(/^[0-9a-f]{40}$/.test(sha), 'Invalid commit SHA');
	return {
		mode: 'release', repository: image, localImage: 'groly:verify', version, gitTag, branch, channel,
		versionTag: `${image}:${version}`,
		channelTag: `${image}:${channel}`
	};
}

export function releasePolicy(version, repository, draft, ref, sha) {
	if (!draft) {
		return { mode: 'local', repository: imageRepository(repository), localImage: 'groly:verify', version };
	}
	assert.equal(draft.draft, true, 'Release must be a draft until verification succeeds');
	assert.equal(draft.tag_name, 'v' + version, 'Release tag must match package.json');
	assert.equal(draft.prerelease, version.includes('-'), 'Release channel must match SemVer');
	assert.equal(draft.target_commitish, sha, 'Draft release must target the exact commit being verified');
	return releaseTarget(version, repository, ref, sha);
}

export function releaseCommit(version, repository, ref, sha) {
	const subject = execFileSync('git', ['show', '-s', '--format=%s', sha], { encoding: 'utf8' }).trimEnd();
	assert.equal(subject, 'release: v' + version, 'Release subject must match the package version');
	const notes = execFileSync('git', ['show', '-s', '--format=%b', sha], { encoding: 'utf8' }).trimEnd();
	assert(notes.trim(), 'Approved GitHub release notes are missing from the commit body');
	return { target: releaseTarget(version, repository, ref, sha), notes };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
	const config = JSON.parse(readFileSync('.github/release.json', 'utf8'));
	const { GITHUB_EVENT_NAME: event, GITHUB_REPOSITORY: repo, GITHUB_REF: ref, GITHUB_SHA: sha } = process.env;
	assert(['push', 'workflow_dispatch'].includes(event));
	const policy = event === 'push' ? releaseCommit(version, repo, ref, sha).target : releasePolicy(version, repo);
	const verification = releaseVerification(config, event === 'workflow_dispatch' ? process.env.GROLY_VERIFICATION_INPUT : undefined);
	for (const [key, value] of Object.entries({ ...policy, verification })) process.stdout.write(`${key}=${value}\n`);
}
