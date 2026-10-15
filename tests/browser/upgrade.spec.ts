import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to the production Docker candidate');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'], timeout: 120_000 }).trim();

test('an installed 0.9.10 PWA upgrades with its session and unsynced changes intact', async ({ page, context, request }) => {
	const id = `groly-browser-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	let container = '';
	const errors: string[] = [];
	const activeRequests = new Set<object>();
	page.on('request', req => { if (req.url().startsWith('http://127.0.0.1:3100/api/') && !/\/api\/(events|ping|auth\/login)(?:[?]|$)/.test(req.url())) activeRequests.add(req); });
	page.on('response', response => activeRequests.delete(response.request()));
	page.on('requestfailed', req => { activeRequests.delete(req); });
	page.on('pageerror', error => errors.push(error.message));
	const settled = async () => {
		await expect(page.locator('.animate-spin')).toHaveCount(0);
		await expect.poll(() => activeRequests.size).toBe(0);
	};
	const start = (target: string, suffix: string) => {
		container = `${id}-${suffix}`;
		docker('run', '-d', '--platform', 'linux/amd64', '--name', container, '-p', '127.0.0.1:3100:3000',
			'--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=browser-bootstrap',
			'-e', 'ADMIN_PASSWORD=Groly-browser-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100',
			'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', target);
	};
	const wait = async (upgraded: boolean) => {
		await expect.poll(async () => {
			try { return (await request.get(upgraded ? '/api/health' : '/login')).status(); }
			catch { return 0; }
		}).toBe(200);
	};
	try {
		docker('volume', 'create', volume);
		start('ghcr.io/peterthepeter/groly:0.9.10', 'old');
		await wait(false);
		execFileSync('docker', ['exec', '-i', container, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()`, stdio: ['pipe', 'pipe', 'pipe'] });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		await settled();
		await page.goto('/listen/upgrade-list');
		await expect(page.getByText('Hafermilch', { exact: true }).first()).toBeVisible();
		await page.evaluate(async () => { await navigator.serviceWorker.ready; });
		await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
		await settled();
		// Reopen the installed app: the old version distinguishes first installation
		// from updates using the controller present when its layout mounts.
		await page.reload();
		await expect(page.getByText('Hafermilch', { exact: true }).first()).toBeVisible();
		await settled();
		await page.getByRole('button', { name: de.add, exact: true }).click();
		const input = page.locator('[data-add-item-name]');
		await expect(input).toBeVisible();
		await context.setOffline(true);
		await input.fill('Upgrade offline item');
		await input.press('Enter');
		await expect.poll(() => page.evaluate(() => new Promise<boolean>((resolve, reject) => {
			const open = indexedDB.open('groly');
			open.onerror = () => reject(open.error);
			open.onsuccess = () => {
				const db = open.result;
				const rows = db.transaction('pendingMutations').objectStore('pendingMutations').getAll();
				rows.onsuccess = () => { resolve(rows.result.some(row => row.type === 'create_item' && row.payload.name === 'Upgrade offline item')); db.close(); };
			};
		}))).toBe(true);

		docker('rm', '-f', container); container = '';
		start(image!, 'new');
		await wait(true);
		await context.setOffline(false);
		await page.evaluate(async () => { const registration = await navigator.serviceWorker.ready; await registration.update(); }).catch(error => {
			if (!/Execution context was destroyed|navigation/i.test(String(error))) throw error;
		});
		const dismiss = page.getByRole('button', { name: /Alles klar|Got it/ });
		await expect(dismiss).toBeVisible({ timeout: 60_000 });
		await dismiss.click();
		await settled();
		await expect.poll(async () => {
			const response = await page.request.get('/api/lists/upgrade-list/items');
			if (!response.ok()) return -1;
			const body = await response.json();
			const items = Array.isArray(body) ? body : body.items;
			return items.filter((item: { name: string }) => item.name === 'Upgrade offline item').length;
		}, { timeout: 60_000 }).toBe(1);
		expect((await page.request.get('/api/auth/me')).status()).toBe(200);

		for (const route of ['/tracker', '/tracker?tab=history', '/tracker/verwalten', '/tracker/nutrition', '/rezepte', '/einstellungen']) {
			const response = await page.goto(route);
			expect(response?.status(), route).toBe(200);
			await expect(page.locator('body')).not.toContainText('Internal Error');
			await settled();
		}
		await page.goto('/tracker?tab=history');
		await settled();
		await page.getByRole('button', { name: 'Export PDF', exact: true }).click();
		const downloading = page.waitForEvent('download');
		await page.getByRole('button', { name: de.export_button, exact: true }).click();
		const pdf = await downloading;
		const expectedPdfName = await page.evaluate(() => {
			const end = new Date();
			const start = new Date(end); start.setDate(start.getDate() - 29);
			const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			return `groly-full-${key(start)}_${key(end)}.pdf`;
		});
		expect(pdf.suggestedFilename()).toBe(expectedPdfName);
		expect(await pdf.failure()).toBeNull();
		const stream = await pdf.createReadStream();
		const chunks: Buffer[] = [];
		for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
		const bytes = Buffer.concat(chunks);
		expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
		expect(bytes.length).toBeGreaterThan(1000);
		await settled();
		await page.goto('/rezepte?tab=mealplan');
		await expect(page.getByText('So', { exact: true })).toBeVisible();
		const sunday = page.getByText('So', { exact: true }).locator('..').locator('..');
		await sunday.getByText(de.meal_plan_empty_day, { exact: true }).click();
		await page.getByRole('button', { name: /Gemüsepfanne 🥦/ }).click();
		const saved = page.waitForResponse(response => response.url().endsWith('/api/meal-plan') && response.request().method() === 'PUT');
		await page.getByRole('button', { name: de.meal_plan_add_button, exact: true }).click();
		const response = await saved;
		expect(response.status()).toBe(200);
		const date = response.request().postDataJSON().date;
		const expected = await page.evaluate(() => {
			const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + (7 - d.getDay()) % 7);
			return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		});
		expect(date).toBe(expected);
		const meals = await (await page.request.get(`/api/meal-plan?from=${date}&to=${date}`)).json();
		expect(meals.some((meal: { recipeId: string }) => meal.recipeId === 'upgrade-recipe')).toBe(true);
		const worker = await page.request.get('/service-worker.js', { headers: { 'accept-encoding': 'gzip, br' } });
		expect(worker.status()).toBe(200);
		expect(await worker.text()).not.toContain('self.__WB_MANIFEST');
		await page.screenshot({ path: `test-results/${test.info().project.name}-meal-plan.png`, fullPage: true });
		await page.goto('/einstellungen');
		await settled();
		await page.getByRole('button', { name: de.language, exact: true }).click();
		await page.getByRole('button', { name: de.language_en, exact: true }).click();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await expect(page.getByText(en.language, { exact: true })).toBeVisible();
		await settled();
		await page.reload();
		await expect(page.locator('html')).toHaveAttribute('lang', 'en');
		await settled();
		expect(errors).toEqual([]);
	} finally {
		if (container) docker('rm', '-f', container);
		docker('volume', 'rm', volume);
	}
});
