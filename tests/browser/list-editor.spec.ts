import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

test.use({ serviceWorkers: 'block' });
const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

test('list edits survive sharing, cancel discards preferences, and failed saves can be retried', async ({ page, request }) => {
	const id = `groly-list-editor-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=editor-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-editor-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100', '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		expect((await page.request.patch('/api/users/me', { data: { settings: { locationNavEnabled: true, categorySortEnabled: true } } })).ok()).toBe(true);
		await page.reload();
		const shell = page.locator('.manage-sheet-shell');
		const getList = async () => (await page.request.get('/api/lists/upgrade-list')).json();
		const getSettings = async () => (await (await page.request.get('/api/users/me')).json()).settings;
		const getNotifications = async () => (await (await page.request.get('/api/lists/upgrade-list/notifications')).json()).enabled;
		const open = async (name: string) => {
			await page.getByText(name, { exact: true }).first().click({ button: 'right' });
			await expect(shell.getByRole('heading', { name: de.list_edit_title, exact: true })).toBeVisible();
			await expect(shell.getByRole('switch', { name: de.list_notifications, exact: true })).toBeEnabled();
		};
		await open('Familie 🥦');
		await expect(shell.locator('header').getByRole('button', { name: de.list_delete, exact: true })).toBeVisible();
		await shell.getByLabel(de.list_name_label, { exact: true }).fill('Entwurf');
		await shell.getByRole('button', { name: new RegExp(de.list_share_members) }).click();
		await expect(page.getByRole('heading', { name: 'Liste teilen', exact: true })).toBeVisible();
		await page.getByRole('button', { name: de.sort_mode_done, exact: true }).click();
		await expect(shell.getByLabel(de.list_name_label, { exact: true })).toHaveValue('Entwurf');
		await shell.getByRole('button', { name: new RegExp(de.settings_category_sorting) }).click();
		await shell.getByRole('switch', { name: de.list_sort_use_global, exact: true }).click();
		const firstCategory = await shell.locator('[data-category-key]').first().getAttribute('data-category-key');
		await shell.locator('.category-order-grip').first().press('End');
		await expect(shell.locator('[data-category-key]').last()).toHaveAttribute('data-category-key', firstCategory!);
		await shell.getByRole('button', { name: de.sort_mode_done, exact: true }).click();
		await shell.getByRole('switch', { name: de.list_notifications, exact: true }).click();
		await shell.getByRole('button', { name: de.list_cancel, exact: true }).click();
		expect((await getList()).name).toBe('Familie 🥦');
		expect((await getSettings()).listCategorySettings?.['upgrade-list']).toBeUndefined();
		expect(await getNotifications()).toBe(true);

		await open('Familie 🥦');
		await shell.getByLabel(de.list_name_label, { exact: true }).fill('Gespeicherte Familie');
		await shell.getByRole('button', { name: new RegExp(de.settings_category_sorting) }).click();
		await shell.getByRole('switch', { name: de.list_sort_use_global, exact: true }).click();
		await shell.locator('.category-order-grip').first().press('End');
		await shell.getByRole('button', { name: de.sort_mode_done, exact: true }).click();
		await shell.getByRole('switch', { name: de.list_notifications, exact: true }).click();
		await page.route('**/api/lists/upgrade-list/notifications', route => route.request().method() === 'PUT'
			? route.fulfill({ status: 500, json: {} }) : route.continue());
		await shell.getByRole('button', { name: de.list_save, exact: true }).click();
		await expect(shell.getByRole('alert')).toHaveText(de.list_save_error);
		await expect(shell.getByLabel(de.list_name_label, { exact: true })).toHaveValue('Gespeicherte Familie');
		expect((await getList()).name).toBe('Familie 🥦');
		expect((await getSettings()).listCategorySettings?.['upgrade-list']).toBeUndefined();
		await page.unroute('**/api/lists/upgrade-list/notifications');
		await shell.getByRole('button', { name: de.list_save, exact: true }).click();
		await expect(shell).toHaveCount(0);
		expect((await getList()).name).toBe('Gespeicherte Familie');
		expect(await getNotifications()).toBe(false);
		await expect.poll(async () => (await getSettings()).listCategorySettings?.['upgrade-list']?.order.at(-1)).toBe(firstCategory);

		// The default icon must survive reopening a list whose iconId is null.
		expect((await getList()).iconId).toBeNull();
		await open('Gespeicherte Familie');
		await expect(shell.getByRole('button', { name: `${de.list_icon}: ${de.list_icon_standard}`, exact: true })).toBeVisible();
		for (const theme of ['dark', 'light']) {
			await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
			await page.setViewportSize({ width: 320, height: 568 });
			await expect(shell.getByRole('button', { name: de.list_save, exact: true })).toBeInViewport();
			expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
			await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-list-editor-de-${theme}-320.png` });
		}
		await shell.getByRole('button', { name: new RegExp(de.settings_category_sorting) }).click();
		await shell.locator('[data-category-key]').last().scrollIntoViewIfNeeded();
		await expect(shell.getByRole('button', { name: de.sort_mode_done, exact: true })).toBeInViewport();
		await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-list-categories-320.png` });
		await shell.getByRole('button', { name: de.sort_mode_done, exact: true }).click();
		await shell.getByRole('button', { name: de.list_cancel, exact: true }).click();
		expect((await page.request.patch('/api/users/me', { data: { settings: { lang: 'en' } } })).ok()).toBe(true);
		await page.reload();
		await page.getByText('Gespeicherte Familie', { exact: true }).first().click({ button: 'right' });
		await expect(shell.getByRole('heading', { name: en.list_edit_title, exact: true })).toBeVisible();
		await expect(shell.getByRole('button', { name: en.list_save, exact: true })).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		expect(errors).toEqual([]);
	} finally {
		try { docker('rm', '-f', id); } catch { /* Preserve the original test failure. */ }
		try { docker('volume', 'rm', volume); } catch { /* Never touch user volumes. */ }
	}
});
