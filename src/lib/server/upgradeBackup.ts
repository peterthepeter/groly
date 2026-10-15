import type Database from 'better-sqlite3';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, mkdir, open, readFile, readdir, rename, stat, statfs, writeFile } from 'node:fs/promises';
import path from 'node:path';

const VERSION_KEY = 'last_successful_start_version';
const PENDING_KEY = 'upgrade_backup_in_progress';
type FileDigest = { path: string; size: number; sha256: string };
export type BackupManifest = {
	format: 1;
	targetVersion: string;
	sourceVersion: string | null;
	createdAt: string;
	database: FileDigest;
	uploads: FileDigest[];
};

async function digest(filename: string): Promise<string> {
	const hash = createHash('sha256');
	for await (const chunk of createReadStream(filename)) hash.update(chunk);
	return hash.digest('hex');
}

async function inventory(directory: string, prefix = ''): Promise<FileDigest[]> {
	let entries;
	try { entries = await readdir(directory, { withFileTypes: true }); }
	catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT' && !prefix) return [];
		throw error;
	}
	const files: FileDigest[] = [];
	for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
		const relative = path.posix.join(prefix, entry.name);
		const filename = path.join(directory, entry.name);
		if (entry.isSymbolicLink()) throw new Error(`Upload symlinks cannot be safely backed up: ${relative}`);
		if (entry.isDirectory()) files.push(...await inventory(filename, relative));
		else if (entry.isFile()) files.push({ path: relative, size: (await stat(filename)).size, sha256: await digest(filename) });
		else throw new Error(`Unsupported upload file: ${relative}`);
	}
	return files;
}

function metadataIn(database: Database.Database, key: string): string | null {
	if (!database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'").get()) return null;
	const row = database.prepare('SELECT value FROM app_meta WHERE key = ?').get(key) as { value: string } | undefined;
	return row?.value ?? null;
}

export function markSuccessfulStart(database: Database.Database, version: string): void {
	database.transaction(() => {
		database.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(VERSION_KEY, version);
		database.prepare('DELETE FROM app_meta WHERE key = ?').run(PENDING_KEY);
	})();
}

async function flush(filename: string) {
	const handle = await open(filename, 'r');
	try { await handle.sync(); } finally { await handle.close(); }
}

/** Verify every byte before a previously completed snapshot can be reused. */
export async function verifyUpgradeBackup(directory: string, database: Database.Database): Promise<BackupManifest> {
	const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8')) as BackupManifest;
	if (manifest.format !== 1 || !manifest.database || !Array.isArray(manifest.uploads)) throw new Error('Invalid backup manifest');
	for (const file of [manifest.database, ...manifest.uploads.map(file => ({ ...file, path: `uploads/${file.path}` }))]) {
		const filename = path.resolve(directory, file.path);
		if (!filename.startsWith(path.resolve(directory) + path.sep)) throw new Error('Invalid path in backup manifest');
		if ((await stat(filename)).size !== file.size || await digest(filename) !== file.sha256) throw new Error(`Backup checksum mismatch: ${file.path}`);
	}
	// The constructor of the active SQLite connection works for both Node addon ABIs.
	const Constructor = database.constructor as typeof Database;
	const snapshot = new Constructor(path.join(directory, manifest.database.path), { readonly: true, fileMustExist: true });
	try {
		if (snapshot.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('Backup SQLite integrity check failed');
	} finally { snapshot.close(); }
	return manifest;
}

/** Called before migrations, seeds, cleanup, or any application write. */
export async function prepareUpgradeBackup(database: Database.Database, databasePath: string, targetVersion: string): Promise<string | null> {
	if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(targetVersion)) throw new Error('Invalid application version');
	const existing = database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' LIMIT 1").get();
	const sourceVersion = metadataIn(database, VERSION_KEY);
	if (!existing || sourceVersion === targetVersion) return null;

	const dataDirectory = path.dirname(path.resolve(databasePath));
	const backupRoot = path.join(dataDirectory, 'backups');
	await mkdir(backupRoot, { recursive: true, mode: 0o700 });
	const stateFile = path.join(backupRoot, `.upgrade-${targetVersion}.json`);
	try {
		const state = JSON.parse(await readFile(stateFile, 'utf8')) as { directory: string; sourceVersion: string | null };
		const directory = path.resolve(backupRoot, state.directory);
		if (path.dirname(directory) !== backupRoot || state.sourceVersion !== sourceVersion) throw new Error('Invalid upgrade backup state');
		const manifest = await verifyUpgradeBackup(directory, database);
		if (manifest.targetVersion !== targetVersion || manifest.sourceVersion !== sourceVersion) throw new Error('Backup version mismatch');
		if (metadataIn(database, PENDING_KEY) === state.directory) return directory;
		// Restoring an old snapshot also restores its metadata. The missing pending
		// marker distinguishes a rollback from an interrupted initialization, so
		// subsequent writes made with the old app receive a new pre-upgrade backup.
		await rename(stateFile, `${stateFile}.previous-${randomUUID()}`);
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
		// A missing state is normal. A state pointing at a missing backup is not.
		const stateExists = await stat(stateFile).then(() => true, (stateError: NodeJS.ErrnoException) => {
			if (stateError.code !== 'ENOENT') throw stateError;
			return false;
		});
		if (stateExists) throw new Error('Upgrade backup is missing; restore the snapshot before retrying');
	}

	const uploadsDirectory = path.join(dataDirectory, 'uploads');
	const uploads = await inventory(uploadsDirectory);
	const databaseBytes = Number(database.pragma('page_count', { simple: true })) * Number(database.pragma('page_size', { simple: true }));
	const required = databaseBytes + uploads.reduce((total, file) => total + file.size, 0) + 16 * 1024 * 1024;
	const space = await statfs(backupRoot);
	if (Number(space.bavail) * Number(space.bsize) < required) throw new Error(`Insufficient disk space for upgrade backup (need at least ${required} bytes)`);

	const name = `${new Date().toISOString().replaceAll(':', '-')}-${targetVersion}-${randomUUID()}`;
	const staging = path.join(backupRoot, `.partial-${name}`);
	const completed = path.join(backupRoot, name);
	await mkdir(staging, { mode: 0o700 });
	const databaseName = path.basename(databasePath);
	if (databaseName === 'manifest.json' || databaseName === 'uploads') throw new Error('Unsupported database filename');
	await database.backup(path.join(staging, databaseName));
	for (const file of uploads) {
		const destination = path.join(staging, 'uploads', file.path);
		await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 });
		await copyFile(path.join(uploadsDirectory, file.path), destination);
	}
	if (JSON.stringify(await inventory(uploadsDirectory)) !== JSON.stringify(uploads)) throw new Error('Uploads changed during backup; stop other containers using this data directory');
	const manifest: BackupManifest = {
		format: 1, targetVersion, sourceVersion, createdAt: new Date().toISOString(),
		database: { path: databaseName, size: (await stat(path.join(staging, databaseName))).size, sha256: await digest(path.join(staging, databaseName)) },
		uploads
	};
	await writeFile(path.join(staging, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
	await verifyUpgradeBackup(staging, database);
	await flush(path.join(staging, databaseName));
	for (const file of uploads) await flush(path.join(staging, 'uploads', file.path));
	await flush(path.join(staging, 'manifest.json'));
	const directories = new Set<string>();
	for (const file of uploads) {
		for (let directory = path.dirname(path.join(staging, 'uploads', file.path)); directory !== staging; directory = path.dirname(directory)) directories.add(directory);
	}
	for (const directory of [...directories].sort((a, b) => b.length - a.length)) await flush(directory);
	await flush(staging);
	await rename(staging, completed);
	// Publish the retry marker only after a complete, verified snapshot exists.
	const stagingState = path.join(backupRoot, `.pending-${targetVersion}-${randomUUID()}.json`);
	await writeFile(stagingState, JSON.stringify({ directory: name, sourceVersion }) + '\n', { flag: 'wx', mode: 0o600 });
	await flush(stagingState);
	await rename(stagingState, stateFile);
	await flush(backupRoot);
	if (database.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'app_meta'").get()) {
		database.prepare('INSERT INTO app_meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(PENDING_KEY, name);
	}
	console.log(`[groly:backup] Verified pre-upgrade backup: ${completed}`);
	return completed;
}
