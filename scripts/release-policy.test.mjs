import assert from 'node:assert/strict';
import { test } from 'node:test';
import { manifestDigest, publishImage } from './publish-image.mjs';
import { releasePolicy, releaseVerification } from './release-policy.mjs';

const repository = 'peterthepeter/groly';
const sha = 'a'.repeat(40);
const betaBranch = 'refs/heads/codex/groly-1.0';
const stableBranch = 'refs/heads/main';
const draft = (version, prerelease = version.includes('-')) => ({ tag_name: `v${version}`, prerelease, draft: true, target_commitish: sha });
const plan = (version, release = draft(version), ref = release.prerelease ? betaBranch : stableBranch) =>
	releasePolicy(version, repository, release, ref, sha);

test('uses the configured verification level for both beta and stable releases', () => {
	for (const verification of ['standard', 'full']) {
		assert.equal(releaseVerification({ verification }), verification);
		assert.equal(releaseVerification({ verification }, ''), verification);
		for (const [version, prerelease] of [['1.0.0-beta.7', true], ['1.0.0', false]]) {
			const policy = plan(version);
			assert.equal(policy.channelTag, `ghcr.io/${repository}:${prerelease ? 'beta' : 'latest'}`);
		}
	}
});

test('manual verification can explicitly select either level', () => {
	assert.equal(releaseVerification({ verification: 'standard' }, 'full'), 'full');
	assert.equal(releaseVerification({ verification: 'full' }, 'standard'), 'standard');
});

test('rejects missing or misspelled verification levels instead of skipping checks silently', () => {
	for (const config of [null, {}, { verification: 'mini' }, { verification: 'FULL' }]) {
		assert.throws(() => releaseVerification(config), /verification must be/);
	}
	assert.throws(() => releaseVerification({ verification: 'standard' }, 'unknown'), /override must be/);
});

test('manual verification never derives public tags without a release draft', () => {
	for (const version of ['1.0.0-beta.1', '1.0.0']) {
		const policy = releasePolicy(version, repository);
		assert.equal(policy.mode, 'local');
		assert.equal(policy.localImage, 'groly:verify');
		assert.equal(policy.versionTag, undefined);
		assert.equal(policy.channelTag, undefined);
	}
});

test('beta permits exactly its version tag and beta, never latest', () => {
	const policy = plan('1.0.0-beta.1');
	assert.deepEqual([policy.versionTag, policy.channelTag], ['ghcr.io/peterthepeter/groly:1.0.0-beta.1', 'ghcr.io/peterthepeter/groly:beta']);
});

test('stable permits exactly its version tag and latest, never beta', () => {
	const policy = plan('1.0.0');
	assert.deepEqual([policy.versionTag, policy.channelTag], ['ghcr.io/peterthepeter/groly:1.0.0', 'ghcr.io/peterthepeter/groly:latest']);
});

test('rejects mismatched tag and channel before any publication', () => {
	assert.throws(() => plan('1.0.0', draft('0.9.10')), /tag must match/);
	assert.throws(() => plan('1.0.0-beta.1', draft('1.0.0-beta.1', false)), /channel must match/);
	assert.throws(() => plan('1.0.0', draft('1.0.0', true)), /channel must match/);
});

test('requires a draft pinned to the verified commit and correct branch', () => {
	assert.throws(() => plan('1.0.0', { ...draft('1.0.0'), draft: false }), /must be a draft/);
	assert.throws(() => plan('1.0.0', { ...draft('1.0.0'), target_commitish: 'main' }), /exact commit/);
	assert.throws(() => plan('1.0.0', { ...draft('1.0.0'), target_commitish: 'b'.repeat(40) }), /exact commit/);
	assert.throws(() => plan('1.0.0', draft('1.0.0'), 'refs/tags/v1.0.0'), /channel branch/);
	assert.throws(() => plan('1.0.0-beta.1', draft('1.0.0-beta.1'), stableBranch), /channel branch/);
});

for (const version of ['01.0.0', '1.0', '1.0.0-beta.01', '1.0.0-beta..1', '1.0.0+build.1', '1.0.0\nlatest', '1.0.0\n']) {
	test(`rejects invalid Docker/SemVer version ${JSON.stringify(version)}`, () => {
		assert.throws(() => plan(version), /Invalid/);
	});
}

test('normalizes the repository and rejects unsafe image names', () => {
	assert.equal(releasePolicy('1.0.0', 'PeterThePeter/Groly').repository, 'ghcr.io/peterthepeter/groly');
	for (const name of ['groly', '../groly', 'owner/groly:latest', 'owner/groly\nextra=value', 'owner/groly\n']) {
		assert.throws(() => releasePolicy('1.0.0', name), /Invalid GitHub repository/);
	}
});

test('retries the interrupted publication using the tested manifest, then leaves both tags in place', async () => {
	const configDigest = 'sha256:' + 'b'.repeat(64);
	const manifest = { bytes: Buffer.from(JSON.stringify({ config: { digest: configDigest } })) };
	const digest = manifestDigest(manifest.bytes);
	assert.notEqual(digest, configDigest);
	const tags = new Map();
	const writes = [];
	let failChannel = true;
	const client = {
		async read(id) { assert.equal(id, digest); return manifest; },
		async digest(tag) { return tags.get(tag) ?? null; },
		async put(tag, payload) {
			assert.equal(payload, manifest);
			if (tag === 'latest' && failChannel) throw Error('Channel write interrupted');
			tags.set(tag, digest);
			writes.push(tag);
		}
	};
	const publish = (check = () => {}) => publishImage(client, digest, '1.1.0', 'latest', check);
	await assert.rejects(publish(), /interrupted/);
	assert.deepEqual([...tags.keys()], ['1.1.0']);
	failChannel = false;
	await assert.rejects(publish(() => { throw Error('Release branch advanced'); }), /advanced/);
	assert.equal(tags.has('latest'), false);
	await publish();
	await publish();
	assert.deepEqual(writes, ['1.1.0', 'latest']);
	assert.equal(tags.get('latest'), digest);
	tags.set('1.1.0', configDigest);
	await assert.rejects(publish(), /different image/);
	assert.deepEqual(writes, ['1.1.0', 'latest']);
});
