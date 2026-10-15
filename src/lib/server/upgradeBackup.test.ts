import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, mkdir, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { markSuccessfulStart, prepareUpgradeBackup, verifyUpgradeBackup } from './upgradeBackup';

vi.mock('node:fs/promises', async importOriginal => {
	const actual = await importOriginal<typeof import('node:fs/promises')>();
	return { ...actual, statfs: vi.fn(actual.statfs), copyFile: vi.fn(actual.copyFile) };
});

let directory: string;
let sqlite: Database.Database;
let filename: string;
beforeEach(async () => {
	directory = await mkdtemp(path.join(tmpdir(), 'groly-backup-test-'));
	filename = path.join(directory, 'groly.db');
	sqlite = new Database(filename);
	sqlite.pragma('journal_mode = WAL');
});
afterEach(async () => {
	vi.restoreAllMocks();
	sqlite.close();
	await rm(directory, { recursive: true, force: true });
});

async function seed() {
	sqlite.exec("CREATE TABLE app_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE records (id TEXT PRIMARY KEY, note TEXT); INSERT INTO records VALUES ('kept-id', 'größer 🥦');");
	await mkdir(path.join(directory, 'uploads', 'nested'), { recursive: true });
	await writeFile(path.join(directory, 'uploads', 'nested', 'photo.png'), Buffer.from([0, 1, 2, 255]));
}

describe('pre-upgrade backups', () => {
	it('does not back up an empty first installation', async () => {
		expect(await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1')).toBeNull();
	});
	it('preserves WAL data and uploaded bytes, and restores independently of the original database', async () => {
		await seed();
		const backup = (await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1'))!;
		expect((await verifyUpgradeBackup(backup, sqlite)).uploads).toHaveLength(1);
		sqlite.exec('DELETE FROM records');
		const restored = new Database(path.join(backup, 'groly.db'), { readonly: true });
		try { expect(restored.prepare('SELECT * FROM records').all()).toEqual([{ id: 'kept-id', note: 'größer 🥦' }]); }
		finally { restored.close(); }
		expect(await readFile(path.join(backup, 'uploads', 'nested', 'photo.png'))).toEqual(Buffer.from([0, 1, 2, 255]));
	});
	it('reuses the verified original backup after an interrupted initialization', async () => {
		await seed();
		const backup = await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1');
		sqlite.exec("UPDATE records SET note = 'partially migrated'");
		expect(await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1')).toBe(backup);
		expect((await readdir(path.join(directory, 'backups'))).filter(name => !name.startsWith('.'))).toHaveLength(1);
	});
	it('skips normal restarts and takes a separate snapshot for the next version', async () => {
		await seed();
		const beta = await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1');
		markSuccessfulStart(sqlite, '1.0.0-beta.1');
		expect(await prepareUpgradeBackup(sqlite, filename, '1.0.0-beta.1')).toBeNull();
		const stable = await prepareUpgradeBackup(sqlite, filename, '1.0.0');
		expect(stable).not.toBe(beta);
		expect((await verifyUpgradeBackup(stable!, sqlite)).sourceVersion).toBe('1.0.0-beta.1');
	});
	it('takes a new snapshot after a rollback so writes made with the old version are protected', async () => {
		await seed();
		const original = await prepareUpgradeBackup(sqlite, filename, '1.0.0');
		// A restored pre-upgrade database has no in-progress marker.
		sqlite.prepare('DELETE FROM app_meta WHERE key = ?').run('upgrade_backup_in_progress');
		sqlite.exec("INSERT INTO records VALUES ('after-rollback', 'new data from the old version')");
		const retry = await prepareUpgradeBackup(sqlite, filename, '1.0.0');
		expect(retry).not.toBe(original);
		const restored = new Database(path.join(retry!, 'groly.db'), { readonly: true });
		try { expect(restored.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 2 }); }
		finally { restored.close(); }
	});
	it('blocks startup if an existing snapshot has been damaged', async () => {
		await seed();
		const backup = (await prepareUpgradeBackup(sqlite, filename, '1.0.0'))!;
		await writeFile(path.join(backup, 'uploads', 'nested', 'photo.png'), 'corrupt');
		await expect(prepareUpgradeBackup(sqlite, filename, '1.0.0')).rejects.toThrow('checksum mismatch');
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 1 });
	});
	it('blocks startup if a completed snapshot has disappeared', async () => {
		await seed();
		const backup = (await prepareUpgradeBackup(sqlite, filename, '1.0.0'))!;
		await rm(backup, { recursive: true });
		await expect(prepareUpgradeBackup(sqlite, filename, '1.0.0')).rejects.toThrow('backup is missing');
	});
	it('retains an interrupted partial backup and creates a verified snapshot on retry', async () => {
		await seed();
		vi.mocked(fs.copyFile).mockRejectedValueOnce(Object.assign(new Error('Disk write interrupted'), { code: 'ENOSPC' }));
		await expect(prepareUpgradeBackup(sqlite, filename, '1.0.0')).rejects.toThrow('Disk write interrupted');
		const names = await readdir(path.join(directory, 'backups'));
		expect(names).toHaveLength(1);
		expect(names[0]).toMatch(/^\.partial-/);
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 1 });
		expect(sqlite.prepare('SELECT * FROM app_meta').all()).toEqual([]);
		const completed = (await prepareUpgradeBackup(sqlite, filename, '1.0.0'))!;
		expect((await verifyUpgradeBackup(completed, sqlite)).uploads).toHaveLength(1);
		expect(await readdir(path.join(directory, 'backups'))).toContain(names[0]);
	});
	it('rejects upload symlinks without touching user records', async () => {
		await seed();
		await symlink(filename, path.join(directory, 'uploads', 'external'));
		await expect(prepareUpgradeBackup(sqlite, filename, '1.0.0')).rejects.toThrow('symlinks');
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 1 });
	});
	it('fails before snapshotting when disk space is insufficient', async () => {
		await seed();
		vi.mocked(fs.statfs).mockResolvedValueOnce({ bavail: 0, bsize: 4096 } as Awaited<ReturnType<typeof fs.statfs>>);
		await expect(prepareUpgradeBackup(sqlite, filename, '1.0.0')).rejects.toThrow('Insufficient disk space');
		expect(sqlite.prepare('SELECT COUNT(*) AS n FROM records').get()).toEqual({ n: 1 });
	});
});
