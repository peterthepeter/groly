import assert from 'node:assert/strict';
import { test } from 'node:test';
import { releasePolicy } from './release-policy.mjs';

const repository = 'peterthepeter/groly';
const published = (version, prerelease) => ({ action: 'published', release: { tag_name: `v${version}`, prerelease, draft: false } });

test('manual verification never derives public tags, even with release-like event data', () => {
	for (const version of ['1.0.0-beta.1', '1.0.0']) {
		const policy = releasePolicy('workflow_dispatch', published(version, version.includes('-')), version, repository);
		assert.equal(policy.mode, 'local');
		assert.equal(policy.localImage, 'groly:verify');
		assert.equal(policy.versionTag, '');
		assert.equal(policy.channelTag, '');
	}
});

test('beta permits exactly its version tag and beta, never latest', () => {
	const policy = releasePolicy('release', published('1.0.0-beta.1', true), '1.0.0-beta.1', repository);
	assert.deepEqual([policy.versionTag, policy.channelTag], ['ghcr.io/peterthepeter/groly:1.0.0-beta.1', 'ghcr.io/peterthepeter/groly:beta']);
});

test('stable permits exactly its version tag and latest, never beta', () => {
	const policy = releasePolicy('release', published('1.0.0', false), '1.0.0', repository);
	assert.deepEqual([policy.versionTag, policy.channelTag], ['ghcr.io/peterthepeter/groly:1.0.0', 'ghcr.io/peterthepeter/groly:latest']);
});

test('rejects mismatched tag and channel before any publication', () => {
	assert.throws(() => releasePolicy('release', published('0.9.10', false), '1.0.0', repository), /tag must match/);
	assert.throws(() => releasePolicy('release', published('1.0.0-beta.1', false), '1.0.0-beta.1', repository), /channel must match/);
	assert.throws(() => releasePolicy('release', published('1.0.0', true), '1.0.0', repository), /channel must match/);
});

test('rejects draft, unpublished and unexpected event types', () => {
	assert.throws(() => releasePolicy('release', { ...published('1.0.0', false), action: 'created' }, '1.0.0', repository), /must be published/);
	const draft = published('1.0.0', false); draft.release.draft = true;
	assert.throws(() => releasePolicy('release', draft, '1.0.0', repository), /Draft/);
	assert.throws(() => releasePolicy('push', {}, '1.0.0', repository), /Unsupported/);
});

for (const version of ['01.0.0', '1.0', '1.0.0-beta.01', '1.0.0-beta..1', '1.0.0+build.1', '1.0.0\nlatest', '1.0.0\n']) {
	test(`rejects invalid Docker/SemVer version ${JSON.stringify(version)}`, () => {
		assert.throws(() => releasePolicy('release', published(version, version.includes('-')), version, repository), /Invalid/);
	});
}

test('normalizes the repository and rejects unsafe image names', () => {
	assert.equal(releasePolicy('release', published('1.0.0', false), '1.0.0', 'PeterThePeter/Groly').repository, 'ghcr.io/peterthepeter/groly');
	for (const name of ['groly', '../groly', 'owner/groly:latest', 'owner/groly\nextra=value', 'owner/groly\n']) {
		assert.throws(() => releasePolicy('workflow_dispatch', {}, '1.0.0', name), /Invalid GitHub repository/);
	}
});
