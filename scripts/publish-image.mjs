import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { releaseCommit, releasePolicy } from './release-policy.mjs';
import { pathToFileURL } from 'node:url';

const manifestTypes = [
	'application/vnd.oci.image.manifest.v1+json', 'application/vnd.oci.image.index.v1+json',
	'application/vnd.docker.distribution.manifest.v2+json', 'application/vnd.docker.distribution.manifest.list.v2+json'
].join(', ');

export function manifestDigest(bytes) {
	return 'sha256:' + createHash('sha256').update(bytes).digest('hex');
}

function gh(...args) {
	return execFileSync('gh', args, { encoding: 'utf8' }).trimEnd();
}

async function registry(repository, username, password) {
	assert(/^[\w.-]+\/[\w.-]+$/.test(repository));
	const url = new URL('https://ghcr.io/token');
	url.searchParams.set('service', 'ghcr.io');
	url.searchParams.set('scope', 'repository:' + repository + ':pull,push');
	const auth = await fetch(url, { headers: { Authorization: 'Basic ' + Buffer.from(username + ':' + password).toString('base64') } });
	assert(auth.ok, 'GHCR authorization returned ' + auth.status);
	const { token } = await auth.json();
	assert(token);
	const headers = { Authorization: 'Bearer ' + token, Accept: manifestTypes };
	const manifest = ref => 'https://ghcr.io/v2/' + repository + '/manifests/' + encodeURIComponent(ref);
	return {
		async digest(tag) {
			const response = await fetch(manifest(tag), { method: 'HEAD', headers });
			if (response.status === 404) return null;
			assert(response.ok, 'Read ' + tag + ': ' + response.status);
			const digest = response.headers.get('docker-content-digest');
			assert(/^sha256:[a-f0-9]{64}$/.test(digest), 'Missing manifest digest for ' + tag);
			return digest;
		},
		async read(digest) {
			const response = await fetch(manifest(digest), { headers });
			assert(response.ok, 'Read tested manifest: ' + response.status);
			const bytes = Buffer.from(await response.arrayBuffer());
			assert.equal(manifestDigest(bytes), digest);
			return { bytes, type: JSON.parse(bytes).mediaType };
		},
		async put(tag, { bytes, type }) {
			const response = await fetch(manifest(tag), {
				method: 'PUT', headers: { ...headers, 'Content-Type': type }, body: bytes
			});
			assert.equal(response.status, 201, 'Publish ' + tag + ': ' + response.status);
		}
	};
}

// The release job serializes writers per channel. Recheck its source commit
// before each write, including retries after a partially completed release.
export async function publishImage(client, digest, version, channel, assertCurrent) {
	assert(/^sha256:[a-f0-9]{64}$/.test(digest));
	const manifest = await client.read(digest);
	await assertCurrent();
	const existing = await client.digest(version);
	assert(!existing || existing === digest, 'Version tag already identifies a different image');
	if (!existing) await client.put(version, manifest);
	assert.equal(await client.digest(version), digest);
	await assertCurrent();
	if (await client.digest(channel) !== digest) await client.put(channel, manifest);
	assert.equal(await client.digest(channel), digest);
}

function remoteTag(repo, tag) {
	const lines = gh('api', 'repos/' + repo + '/git/matching-refs/tags/' + tag, '--jq',
		'.[] | select(.ref == ' + JSON.stringify('refs/tags/' + tag) + ') | .object.sha');
	return lines || null;
}

async function publishRelease() {
	const { GITHUB_REPOSITORY: repo, GITHUB_ACTOR: actor, GH_TOKEN: token, GITHUB_SHA: sha,
		GITHUB_REF: ref, DIGEST: digest, OCI_ARCHIVE: archive } = process.env;
	const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
	const { target, notes } = releaseCommit(version, repo, ref, sha);
	const assertCurrent = () => {
		assert.equal(gh('api', 'repos/' + repo + '/git/ref/heads/' + target.branch, '--jq', '.object.sha'), sha, 'Release branch advanced');
		const tag = remoteTag(repo, target.gitTag);
		assert(!tag || tag === sha, 'Git tag already points to another commit');
	};
	assertCurrent();
	const raw = execFileSync('skopeo', ['inspect', '--raw', 'oci-archive:' + archive]);
	assert.equal(manifestDigest(raw), digest, 'Downloaded candidate differs from the tested manifest');
	const client = await registry(repo.toLowerCase(), actor, token);
	const existing = await client.digest(version);
	assert(!existing || existing === digest, 'Version tag already identifies a different image');

	const releases = 'repos/' + repo + '/releases';
	const ids = gh('api', '--paginate', releases + '?per_page=100', '--jq',
		'.[] | select(.tag_name == ' + JSON.stringify(target.gitTag) + ') | .id');
	assert(!ids.includes('\n'), 'Multiple releases have the same tag');
	const prerelease = target.channel === 'beta';
	const release = ids ? JSON.parse(gh('api', releases + '/' + ids)) :
		JSON.parse(execFileSync('gh', ['api', '--method', 'POST', releases, '--input', '-'], {
			input: JSON.stringify({ tag_name: target.gitTag, name: target.gitTag, body: notes, draft: true, prerelease, target_commitish: sha })
		}));
	assert.equal(release.body.trimEnd(), notes, 'Draft release notes differ from the approved commit');
	assert.equal(release.prerelease, prerelease);
	assert.equal(release.target_commitish, sha);
	if (release.draft) releasePolicy(version, repo, release, ref, sha);
	else assert.equal(remoteTag(repo, target.gitTag), sha);

	// Stage by digest. Public release tags are assigned only after checking the manifest bytes.
	if (!await client.digest(digest)) {
		execFileSync('skopeo', ['copy', '--preserve-digests', 'oci-archive:' + archive,
			'docker://' + target.repository + '@' + digest], { stdio: 'inherit' });
	}
	await publishImage(client, digest, version, target.channel, assertCurrent);
	assertCurrent();
	if (release.draft) gh('api', '--method', 'PATCH', releases + '/' + release.id,
		'-F', 'draft=false', '-f', 'make_latest=' + String(!prerelease));
	const published = JSON.parse(gh('api', releases + '/' + release.id));
	assert.equal(published.draft, false);
	assert.equal(published.prerelease, prerelease);
	assert.equal(remoteTag(repo, target.gitTag), sha);
	console.log(published.html_url, target.versionTag, target.channelTag, digest);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await publishRelease();
