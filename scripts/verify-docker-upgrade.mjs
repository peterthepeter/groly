import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { statSync, writeFileSync } from 'node:fs';
import { seedUpgradeFixture, snapshotUpgradeData } from './docker-fixtures.mjs';
import { baselineImage, resolveLatestImage } from './upgrade-baselines.mjs';

const image = process.env.GROLY_TEST_IMAGE;
assert(image, 'Set GROLY_TEST_IMAGE to the candidate image or immutable registry digest');
const baselines = (process.env.GROLY_BASELINES ?? '0.9.10,0.9.9,0.9.8-hotfix.2').split(',').filter(Boolean);
const latestImage = process.env.GROLY_LATEST_IMAGE ?? resolveLatestImage();
baselines.unshift(latestImage);
if (process.env.GROLY_DATA_COPY) assert(statSync(`${process.env.GROLY_DATA_COPY}/groly.db`).size > 0, 'Real-data copy must contain a nonempty groly.db');
const prefix = `groly-verify-${randomUUID().slice(0, 8)}`;
const containers = new Set(), volumes = new Set();
const results = [];
const docker = (...args) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 }).trim();
const evaluate = (container, fn, args = []) => JSON.parse(execFileSync('docker', ['exec', '-i', container, 'node', '--input-type=module'], {
	input: `console.log(JSON.stringify(await (${fn.toString()})(...${JSON.stringify(args)})))`, encoding: 'utf8', timeout: 60_000, stdio: ['pipe', 'pipe', 'pipe']
}));
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

async function httpRequest(route, options = {}) {
	const response = await fetch(`http://127.0.0.1:3000${route}`, { ...options, redirect: 'manual', signal: AbortSignal.timeout(15_000) });
	const bytes = Buffer.from(await response.arrayBuffer());
	return { status: response.status, headers: Object.fromEntries(response.headers), body: bytes.toString('utf8'), sha256: (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex') };
}
const request = (container, route, options = {}) => evaluate(container, httpRequest, [route, options]);

function start(candidate, volume, suffix, extra = []) {
	const name = `${prefix}-${suffix}`;
	containers.add(name);
	docker('run', '-d', '--platform', 'linux/amd64', '--network', 'none', '--name', name,
		'--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'DATABASE_URL=/app/data/groly.db',
		'-e', 'ADMIN_USERNAME=upgrade-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-bootstrap-fixture!', '-e', 'ORIGIN=http://localhost:3000',
		'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', ...extra, candidate);
	return name;
}
function volume(suffix) { const name = `${prefix}-${suffix}`; docker('volume', 'create', name); volumes.add(name); return name; }
function remove(container) { docker('rm', '-f', container); containers.delete(container); }
async function ready(container, upgraded = false) {
	for (let attempt = 0; attempt < 120; attempt++) {
		try {
			const response = request(container, upgraded ? '/api/health' : '/login');
			if (response.status === 200) return;
		} catch { /* The server may not be listening yet. */ }
		await delay(500);
	}
	throw new Error(`Startup did not become ready: ${container}`);
}
function compare(before, after, label) {
	assert.equal(after.integrity, 'ok', `${label}: SQLite integrity failed`);
	assert.deepEqual(after.foreignKeys, before.foreignKeys, `${label}: new foreign key violations`);
	assert.deepEqual(Object.keys(after.tables), Object.keys(before.tables), `${label}: table inventory changed`);
	for (const [name, expected] of Object.entries(before.tables)) {
		assert(after.tables[name].count === expected.count && after.tables[name].sha256 === expected.sha256 && after.tables[name].schema === expected.schema,
			`${label}: contents or schema changed in table ${name}`);
	}
	assert.deepEqual(after.images, before.images, `${label}: uploaded image checksums changed`);
}
function backups(container) {
	return evaluate(container, async () => {
		const { readdirSync, readFileSync } = await import('node:fs');
		return readdirSync('/app/data/backups').filter(name => !name.startsWith('.')).map(name => ({ name, manifest: JSON.parse(readFileSync(`/app/data/backups/${name}/manifest.json`, 'utf8')) }));
	});
}
async function smoke(container, cookie, fixture) {
	const headers = cookie ? { cookie } : {};
	for (const route of ['/login', '/service-worker.js', '/manifest.webmanifest']) {
		const response = request(container, route);
		assert.equal(response.status, 200, `${route} must be served by the production adapter`);
		if (route === '/service-worker.js') assert(!response.body.includes('self.__WB_MANIFEST'), 'Uninjected service worker');
	}
	assert.equal(request(container, '/api/auth/login', {
		method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://attacker.example' }, body: 'username=test'
	}).status, 403, 'Runtime ORIGIN must retain the framework CSRF check');
	if (!cookie) {
		const login = request(container, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'upgrade-bootstrap', password: 'Groly-bootstrap-fixture!' }) });
		assert.equal(login.status, 200, 'Fresh admin bootstrap or login failed');
		cookie = login.headers['set-cookie'].split(';')[0];
		assert.equal(request(container, '/api/auth/me', { headers: { cookie } }).status, 200);
		await verifyUpload(container, cookie);
		return;
	}
	for (const route of ['/api/auth/me', '/api/lists', '/api/recipes', '/api/supplements', '/api/water-logs', '/api/caffeine-logs', '/api/meditation-logs', '/api/mood-logs', '/api/nutrition/goals', '/', '/rezepte', '/tracker', '/tracker?tab=history', '/tracker/nutrition', '/tracker/verwalten', '/einstellungen']) {
		assert.equal(request(container, route, { headers }).status, 200, `Existing session failed at ${route}`);
	}
	const sse = evaluate(container, async cookie => {
		const controller = new AbortController();
		const response = await fetch('http://127.0.0.1:3000/api/events', { headers: { cookie }, signal: controller.signal });
		const reader = response.body.getReader();
		try { return { status: response.status, type: response.headers.get('content-type'), first: new TextDecoder().decode((await reader.read()).value) }; }
		finally { controller.abort(); }
	}, [cookie]);
	assert.equal(sse.status, 200);
	assert.equal(sse.type, 'text/event-stream');
	assert(sse.first.includes(': connected'), 'SSE failed to establish a stream');
	for (const type of ['logs', 'catalog']) {
		const exported = request(container, `/api/supplement-logs/export?${type}=1&tz=Europe/Moscow`, { headers });
		assert.equal(exported.status, 200, 'CSV export failed');
		assert(exported.headers['content-type'].includes('text/csv'));
		assert(exported.body.includes('supplement'), 'CSV header missing');
	}
	if (fixture) {
		await verifyUpload(container, cookie);
		assert.equal(request(container, '/uploads/upgrade-test.png', { headers }).status, 200, 'Existing recipe image missing');
		const response = request(container, '/api/water-logs', { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ amountMl: 250, clientLogId: 'upgrade-water-client' }) });
		assert.equal(response.status, 200, 'An old queued tracker request must remain idempotent');
		assert.equal(JSON.parse(response.body).deduped, true);
		const login = request(container, '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'upgrade-owner', password: 'Groly-upgrade-test-2026!' }) });
		assert.equal(login.status, 200, 'Existing password hash no longer authenticates');
	}
}

async function verifyUpload(container, cookie) {
	const upload = evaluate(container, async cookie => {
		const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
		const form = new FormData();
		form.set('image', new File([bytes], 'new-image.png', { type: 'image/png' }));
		const response = await fetch('http://127.0.0.1:3000/api/uploads/image', { method: 'POST', headers: { cookie, origin: 'http://localhost:3000' }, body: form });
		return { status: response.status, body: await response.json() };
	}, [cookie]);
	assert.equal(upload.status, 201, 'Image upload failed');
	const downloaded = request(container, upload.body.url, { headers: { cookie } });
	assert.equal(downloaded.status, 200, 'New uploaded image not served');
	assert.equal(downloaded.sha256, (await import('node:crypto')).createHash('sha256').update(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])).digest('hex'), 'Image upload bytes changed');
}

async function expectBlocked(container, before, label) {
	let failed = false;
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			const response = request(container, '/api/health');
			if (response.status === 503 && JSON.parse(response.body).status === 'failed') { failed = true; break; }
		} catch { /* Wait for startup. */ }
		await delay(500);
	}
	assert(failed, `${label}: startup must remain blocked`);
	for (let attempt = 0; attempt < 3; attempt++) assert.equal(request(container, '/login').status, 503, 'A subsequent request bypassed failed initialization');
	compare(before, evaluate(container, snapshotUpgradeData), label);
}

async function verifyUpgrade(baseline, dataCopy) {
	const suffix = dataCopy ? 'real-copy' : baseline.replace(/[^a-zA-Z0-9-]/g, '-').slice(-32);
	const data = volume(suffix);
	if (dataCopy) {
		const copy = `${prefix}-copy`;
		containers.add(copy);
		docker('create', '--name', copy, '--mount', `type=volume,src=${data},dst=/app/data`, image);
		docker('cp', `${dataCopy}/.`, `${copy}:/app/data`);
		remove(copy);
	}
	let container = start(baselineImage(baseline), data, `old-${suffix}`);
	await ready(container);
	let cookie;
	if (!dataCopy) cookie = evaluate(container, seedUpgradeFixture).cookie;
	else cookie = evaluate(container, async () => {
		const { default: Database } = await import('better-sqlite3');
		const db = new Database('/app/data/groly.db');
		const user = db.prepare('SELECT id FROM users LIMIT 1').get();
		if (!user) throw new Error('Real copy contains no users');
		db.prepare('INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)').run('upgrade-copy-session', user.id, Math.floor(Date.now() / 1000) + 86400, Math.floor(Date.now() / 1000));
		db.close();
		return 'session=upgrade-copy-session';
	});
	const before = evaluate(container, snapshotUpgradeData);
	remove(container);
	container = start(image, data, `new-${suffix}`);
	await ready(container, true);
	compare(before, evaluate(container, snapshotUpgradeData), `${baseline} -> candidate`);
	const snapshots = backups(container);
	assert.equal(snapshots.length, 1, 'Exactly one pre-upgrade backup must exist');
	await smoke(container, cookie, !dataCopy);
	const afterWrites = evaluate(container, snapshotUpgradeData);
	remove(container);
	container = start(image, data, `restart-${suffix}`);
	await ready(container, true);
	compare(afterWrites, evaluate(container, snapshotUpgradeData), 'Repeated startup');
	assert.equal(backups(container).length, 1, 'Normal restart created a duplicate backup');
	remove(container);

	const restored = volume(`restored-${suffix}`);
	docker('run', '--rm', '--platform', 'linux/amd64', '--network', 'none', '--entrypoint', 'node',
		'--mount', `type=volume,src=${data},dst=/source,readonly`, '--mount', `type=volume,src=${restored},dst=/target`,
		image, '--input-type=module', '-e', `import{cpSync,existsSync}from'node:fs';const source=${JSON.stringify('/source/backups/' + snapshots[0].name)};cpSync(source+'/groly.db','/target/groly.db');if(existsSync(source+'/uploads'))cpSync(source+'/uploads','/target/uploads',{recursive:true});`);
	container = start(baselineImage(baseline), restored, `restored-${suffix}`);
	await ready(container);
	compare(before, evaluate(container, snapshotUpgradeData), 'Restore with original image');
	assert.equal(request(container, '/api/auth/me', { headers: { cookie } }).status, 200);
	remove(container);
	if (baseline === '0.9.10' && !dataCopy) {
		container = start(image, restored, 'full-backup-disk', ['--mount', 'type=tmpfs,destination=/app/data/backups,tmpfs-size=1048576,tmpfs-mode=0700']);
		await expectBlocked(container, before, 'Full backup disk');
		remove(container);
		docker('run', '--rm', '--network', 'none', '--entrypoint', 'node', '--mount', `type=volume,src=${restored},dst=/app/data`, image, '-e', "const fs=require('node:fs');fs.mkdirSync('/app/data/backups',{recursive:true});fs.chmodSync('/app/data/backups',0o500);");
		container = start(image, restored, 'unwritable-backups');
		await expectBlocked(container, before, 'Unwritable backup directory');
		remove(container);
		console.log('PASS failed backups block every request without modifying user data');
	}
	results.push({ baseline, realDataCopy: Boolean(dataCopy), tables: Object.keys(before.tables).length, uploadedFiles: Object.keys(before.images).length, preserved: true, restart: true, restore: true });
	console.log(`PASS ${baseline}${dataCopy ? ' real local copy' : ''}: data, images, sessions, backup, restart and restore`);
}

try {
	docker('image', 'inspect', image);
	const fresh = volume('fresh');
	let container = start(image, fresh, 'fresh');
	await ready(container, true);
	const runtime = evaluate(container, async () => {
		const { existsSync, readdirSync } = await import('node:fs');
		const forbidden = ['@zxing/browser', '@zxing/library', '@lucide/svelte', '@undecaf/zbar-wasm', 'dexie', 'leaflet', 'pdfmake', 'workbox-window', 'workbox-precaching', 'workbox-routing', 'workbox-strategies', 'workbox-expiration', 'vite', 'vitest', 'typescript', '@inlang/paraglide-js', 'drizzle-kit', 'kysely'];
		const leftoverPackages = forbidden.filter(name => existsSync(`/app/node_modules/${name}`));
		const leftoverTools = ['/usr/local/bin/npm', '/usr/local/bin/npx', '/usr/local/bin/yarn', '/usr/local/bin/corepack', '/usr/local/include/node', '/usr/local/lib/node_modules', '/usr/bin/python3', '/usr/bin/g++', '/usr/bin/make'].filter(existsSync);
		const sqliteBinaries = readdirSync('/app/node_modules/better-sqlite3/prebuilds');
		const migrationMetadata = readdirSync('/app/src/lib/db/migrations/meta');
		const barcodeWasm = readdirSync('/app/build/client/_app/immutable/assets').find(name => /^zbar[.-].*\.wasm$/.test(name));
		return { leftoverPackages, leftoverTools, sqliteBinaries, expectedBinary: `linuxmusl-${process.arch}.node`, migrationMetadata, barcodeWasm };
	});
	assert.deepEqual(runtime.leftoverPackages, [], 'Browser/build dependencies leaked into the runtime');
	assert.deepEqual(runtime.leftoverTools, [], 'Build tools or package managers leaked into the runtime');
	assert.deepEqual(runtime.sqliteBinaries, [runtime.expectedBinary], 'Unused native platform binaries shipped');
	assert.deepEqual(runtime.migrationMetadata, ['_journal.json'], 'Drizzle generation snapshots shipped');
	assert(runtime.barcodeWasm, 'The required browser barcode decoder WASM asset is missing');
	const wasm = evaluate(container, async name => {
		const response = await fetch(`http://127.0.0.1:3000/_app/immutable/assets/${name}`);
		const bytes = Buffer.from(await response.arrayBuffer());
		return { status: response.status, magic: bytes.subarray(0, 4).toString('hex'), size: bytes.length };
	}, [runtime.barcodeWasm]);
	assert.equal(wasm.status, 200);
	assert.equal(wasm.magic, '0061736d');
	assert(wasm.size > 1000);
	console.log('PASS runtime contents: no browser/build packages, tools or foreign native binaries; barcode WASM served');
	await smoke(container);
	assert.equal(request(container, '/api/auth/me').status, 401);
	assert.equal(evaluate(container, snapshotUpgradeData).integrity, 'ok');
	remove(container);
	console.log('PASS fresh installation and production service worker');
	const alternate = volume('custom-port');
	container = start(image, alternate, 'custom-port', ['-e', 'PORT=3101']);
	let alternateReady = false;
	for (let attempt = 0; attempt < 120; attempt++) {
		try {
			alternateReady = evaluate(container, async () => (await fetch('http://127.0.0.1:3101/api/health')).status === 200);
			if (alternateReady) break;
		} catch { /* Wait for the configured port. */ }
		await delay(500);
	}
	assert(alternateReady, 'The existing PORT setting no longer works');
	const healthcheck = JSON.parse(docker('inspect', '--format', '{{json .Config.Healthcheck.Test}}', container));
	assert.equal(healthcheck[0], 'CMD-SHELL');
	assert.equal(JSON.parse(docker('exec', container, 'sh', '-c', healthcheck[1])).status, 'ready', 'Image healthcheck ignores PORT');
	remove(container);
	console.log('PASS custom PORT and actual Docker healthcheck');
	for (const baseline of baselines) await verifyUpgrade(baseline);
	if (process.env.GROLY_DATA_COPY) await verifyUpgrade(latestImage, process.env.GROLY_DATA_COPY);
	if (process.env.GROLY_TEST_REPORT) writeFileSync(process.env.GROLY_TEST_REPORT, JSON.stringify({ image, results }, null, 2) + '\n');
} finally {
	for (const container of containers) try { docker('rm', '-f', container); } catch { /* Reported test failure takes priority. */ }
	for (const name of volumes) try { docker('volume', 'rm', name); } catch { /* Never touch non-test volumes. */ }
}
