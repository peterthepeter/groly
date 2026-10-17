import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to the production candidate');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

test('logout and account switching isolate cached data while preserving the original offline queue', async ({ page, request }) => {
	const name = `groly-accounts-${randomUUID().slice(0, 8)}`;
	const volume = `${name}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	async function login(username: string) {
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill(username);
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
	}
	const queued = () => page.evaluate(() => new Promise<Array<{ userId?: string }>>((resolve, reject) => {
		const open = indexedDB.open('groly');
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const query = db.transaction('pendingMutations').objectStore('pendingMutations').getAll();
			query.onsuccess = () => { resolve(query.result); db.close(); };
			query.onerror = () => { reject(query.error); db.close(); };
		};
	}));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', name, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`,
			'-e', 'ADMIN_USERNAME=accounts-bootstrap', '-e', 'ADMIN_PASSWORD=Accounts-fixture123!', '-e', 'ORIGIN=http://127.0.0.1:3100',
			'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', name, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await login('upgrade-owner');
		const listResponse = await page.request.post('/api/lists', { data: { name: 'Alice private list' } });
		expect(listResponse.status()).toBe(201);
		const listId = (await listResponse.json()).id;
		// Page routing cannot intercept fetches handled by an active service worker.
		// Reject in the page before the request reaches the worker, across navigations.
		await page.addInitScript(({ listId }) => {
			const originalFetch = window.fetch.bind(window);
			window.fetch = (input, init) => {
				const url = new URL(input instanceof Request ? input.url : String(input), location.href);
				const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
				if ((localStorage.getItem('groly_test_block_item') === '1' && method === 'POST' && url.pathname === `/api/lists/${listId}/items`)
					|| (localStorage.getItem('groly_test_block_recipes') === '1' && method === 'GET' && url.pathname === '/api/recipes')) {
					return Promise.reject(new TypeError('Simulated offline request'));
				}
				return originalFetch(input, init);
			};
		}, { listId });
		const recipeResponse = await page.request.post('/api/recipes', { data: { title: 'Alice private recipe', servings: 2, ingredients: [], steps: [] } });
		expect(recipeResponse.status()).toBe(201);
		await page.goto('/rezepte');
		await expect(page.getByText('Alice private recipe', { exact: true })).toBeVisible();
		await page.goto('/');
		await expect(page.getByText('Alice private list', { exact: true })).toBeVisible();
		await page.goto(`/listen/${listId}`);
		await page.evaluate(() => localStorage.setItem('groly_test_block_item', '1'));
		await page.getByRole('button', { name: de.add, exact: true }).click();
		await page.locator('[data-add-item-name]').fill('Alice pending item');
		await page.locator('[data-add-item-name]').press('Enter');
		await expect.poll(async () => (await queued()).some(row => row.userId === 'upgrade-owner')).toBe(true);
		await page.goto('/einstellungen');
		await page.getByRole('button', { name: de.menu_open, exact: true }).click();
		await page.getByRole('button', { name: de.nav_logout, exact: true }).click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/login');
		await login('upgrade-member');
		await expect(page.getByText('Alice private list', { exact: true })).toHaveCount(0);
		await page.evaluate(() => localStorage.setItem('groly_test_block_recipes', '1'));
		await page.goto('/rezepte');
		await expect(page.locator('.animate-spin')).toHaveCount(0);
		await expect(page.getByText('Alice private recipe', { exact: true })).toHaveCount(0);
		expect((await queued()).some(row => row.userId === 'upgrade-owner')).toBe(true);
		await page.goto('/einstellungen');
		await page.getByRole('button', { name: /Open menu|Menü öffnen/, exact: true }).click();
		await page.getByRole('button', { name: /Sign out|Abmelden/, exact: true }).click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/login');
		await page.evaluate(() => {
			localStorage.removeItem('groly_test_block_recipes');
			localStorage.removeItem('groly_test_block_item');
		});
		await login('upgrade-owner');
		await expect.poll(async () => {
			const items = await (await page.request.get(`/api/lists/${listId}/items`)).json();
			return items.filter((item: { name: string }) => item.name === 'Alice pending item').length;
		}).toBe(1);
		await expect.poll(async () => (await queued()).length).toBe(0);
		expect(errors).toEqual([]);
	} finally {
		try { docker('rm', '-f', name); } catch { /* Preserve original test failure. */ }
		try { docker('volume', 'rm', volume); } catch { /* Never touch user volumes. */ }
	}
});
