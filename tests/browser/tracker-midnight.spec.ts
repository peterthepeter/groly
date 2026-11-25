import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import en from '../../messages/en.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
const localServer = process.env.GROLY_TRACKER_TEST_URL;
const username = 'tracker-midnight-test';
const password = 'Tracker-midnight-fixture2026!';
test.skip(!image && !localServer, 'Set GROLY_TEST_IMAGE or use a disposable local server at GROLY_TRACKER_TEST_URL');
test.use({ timezoneId: 'Europe/Berlin', serviceWorkers: 'block' });

test('quick logging uses the current day after midnight and honors a selected history date', async ({ page }) => {
	const origin = localServer ?? 'http://127.0.0.1:3100';
	const container = `groly-tracker-midnight-${randomUUID().slice(0, 8)}`;
	const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 });
	let startedContainer = false;
	const supplementName = `Spirulina ${randomUUID().slice(0, 8)}`;

	try {
		if (!localServer) {
			docker('run', '-d', '--rm', '--platform', 'linux/amd64', '--name', container, '-p', '127.0.0.1:3100:3000',
				'-e', 'DATABASE_URL=/tmp/tracker-midnight.db', '-e', `ORIGIN=${origin}`, '-e', `ADMIN_USERNAME=${username}`,
				'-e', `ADMIN_PASSWORD=${password}`, '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', image!);
			startedContainer = true;
		}
		await expect.poll(async () => {
			try { return (await page.request.get(`${origin}/api/health`)).status(); } catch { return 0; }
		}).toBe(200);
		expect((await page.request.post(`${origin}/api/auth/login`, { data: { username, password } })).ok()).toBe(true);
		expect((await page.request.patch(`${origin}/api/users/me`, {
			data: { settings: {
				lang: 'en', dateFormat: 'mdy-slash', timeFormat: '24h',
				waterTrackerEnabled: false, caffeineTrackerEnabled: false, meditationTrackerEnabled: false,
				moodTrackerEnabled: false, nutritionTrackerEnabled: false
			} }
		})).ok()).toBe(true);
		const created = await page.request.post(`${origin}/api/supplements`, {
			data: { name: supplementName, unit: 'piece', stockQuantity: 10, defaultAmount: 2 }
		});
		expect(created.status()).toBe(201);
		const { id } = await created.json();
		const checkSavedLogs = async (dates: string[], stock: number) => {
			await expect.poll(async () => {
				const [{ logs }, { supplements }] = await Promise.all([
					page.request.get(`${origin}/api/supplement-logs`).then(response => response.json()),
					page.request.get(`${origin}/api/supplements`).then(response => response.json())
				]);
				return {
					logs: logs.filter((log: { supplementId: string }) => log.supplementId === id)
						.map((log: { loggedAt: number; amount: number }) => ({ loggedAt: log.loggedAt, amount: log.amount })),
					stock: supplements.find((row: { id: string }) => row.id === id)?.stockQuantity
				};
			}).toEqual({ logs: dates.map(date => ({ loggedAt: Date.parse(date), amount: 2 })), stock });
		};

		const openLog = () => page.getByRole('button', { name: en.add, exact: true }).click();
		const closeLog = () => page.getByRole('button', { name: en.close, exact: true }).click();
		const logHeader = page.getByText(en.supplement_log_save, { exact: true }).locator('..');
		const logTile = page.getByRole('button', { name: new RegExp(`^${supplementName},`) });

		await page.clock.setFixedTime(new Date('2026-11-24T20:00:00+01:00'));
		await page.goto(`${origin}/tracker`);
		await openLog();
		await expect(logTile).toBeVisible();
		await expect(logHeader).toContainText('11/24');
		await closeLog();

		await page.clock.setFixedTime(new Date('2026-11-25T08:21:00+01:00'));
		await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
		await openLog();
		await expect(logHeader).toContainText('11/25');
		await logTile.click();
		await closeLog();
		await expect(page.getByText(supplementName, { exact: true })).toBeVisible();
		await checkSavedLogs(['2026-11-25T08:21:00+01:00'], 8);

		// Save from an open dialog even when the display clock has yet to see midnight.
		await openLog();
		await page.clock.setFixedTime(new Date('2026-11-26T00:00:00+01:00'));
		await logTile.click();
		await closeLog();
		await checkSavedLogs(['2026-11-25T08:21:00+01:00', '2026-11-26T00:00:00+01:00'], 6);

		await page.getByRole('button', { name: en.supplement_tab_history, exact: true }).click();
		await page.getByLabel(en.a11y_choose_date).fill('2026-11-24');
		await openLog();
		await expect(logHeader).toContainText('11/24');
		await logTile.click();
		await closeLog();
		await checkSavedLogs([
			'2026-11-24T00:00:00+01:00', '2026-11-25T08:21:00+01:00', '2026-11-26T00:00:00+01:00'
		], 4);
	} finally {
		if (startedContainer) docker('rm', '-f', container);
	}
});
