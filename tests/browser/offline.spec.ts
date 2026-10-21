import { test, expect, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

type CachedRow = { id?: string; name?: string; quantityInfo?: string | null; isChecked?: boolean; favorites?: Array<{ name: string; quantityInfo?: string | null }> };
async function rows(page: Page, store: string): Promise<CachedRow[]> {
	return page.evaluate(store => new Promise<CachedRow[]>((resolve, reject) => {
		const open = indexedDB.open('groly');
		open.onerror = () => reject(open.error);
		open.onsuccess = () => {
			const db = open.result;
			const read = db.transaction(store).objectStore(store).getAll();
			read.onsuccess = () => { resolve(read.result); db.close(); };
			read.onerror = () => { reject(read.error); db.close(); };
		};
	}), store);
}

test('offline checks and favorites survive reload; cached and uncached recipes have usable views', async ({ page, context, request, browser }) => {
	const id = `groly-offline-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	let desktop: Awaited<ReturnType<typeof browser.newContext>> | undefined;
	let releaseHomeLists!: () => void;
	const homeListsReady = new Promise<void>(resolve => { releaseHomeLists = resolve; });
	page.on('pageerror', error => errors.push(error.message));
	try {
		// Exercise slow initial loading deliberately. URL/SW readiness does not
		// mean the list catalog has finished loading or been saved in IndexedDB.
		await page.route('**/api/lists', async route => { await homeListsReady; await route.continue(); }, { times: 1 });
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000',
			'--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=offline-bootstrap',
			'-e', 'ADMIN_PASSWORD=Groly-offline-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100',
			'-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page).toHaveURL('http://127.0.0.1:3100/');
		await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
		releaseHomeLists();
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		await expect.poll(async () => (await rows(page, 'lists')).some(row => row.id === 'upgrade-list')).toBe(true);
		// Create a catalog entry whose detail page has never been opened.
		const created = await page.request.post('/api/recipes', { data: { title: 'Uncached recipe', servings: 2, ingredients: [], steps: [] } });
		expect(created.status()).toBe(201);
		const { id: uncachedId } = await created.json();
		await page.goto('/rezepte/upgrade-recipe');
		await expect(page.getByText('Gemüse', { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'recipeDetails')).some(row => row.id === 'upgrade-recipe')).toBe(true);
		await page.getByRole('button', { name: de.a11y_back, exact: true }).click();
		await expect(page.getByText('Uncached recipe', { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'recipes')).some(row => row.id === uncachedId)).toBe(true);
		await page.goto('/listen/upgrade-list');
		await expect(page.getByText('Hafermilch', { exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'userSettings')).some(row => row.favorites?.some((fav: { name: string }) => fav.name === 'Äpfel'))).toBe(true);
		await expect.poll(async () => (await rows(page, 'pendingMutations')).length).toBe(0);
		// A separate client needs the session only. Let it load its own settings
		// from the server, avoiding hidden origin-page navigation while WebKit
		// applies an unrelated copy of the phone's localStorage.
		desktop = await browser.newContext();
		await desktop.addCookies(await context.cookies());
		const desktopPage = await desktop.newPage();
		await desktopPage.goto('http://127.0.0.1:3100/listen/upgrade-list');
		await expect(desktopPage.getByText('Hafermilch', { exact: true })).toBeVisible();
		await context.setOffline(true);
		await page.getByRole('button', { name: de.add, exact: true }).click();
		await page.locator('[data-add-item-name]').fill('Offline checked item');
		await page.locator('[data-add-item-name]').press('Enter');
		await page.getByRole('button', { name: de.close, exact: true }).click();
		await page.getByRole('button', { name: 'Offline checked item', exact: true }).click();
		await expect.poll(async () => (await rows(page, 'items')).find(row => row.name === 'Offline checked item')?.isChecked).toBe(true);
		// Favorites must be read from IndexedDB after the component is recreated.
		await page.reload();
		await expect(page.getByText('Hafermilch', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: de.add, exact: true }).click();
		await page.getByRole('button', { name: de.favorites_panel_toggle, exact: true }).click();
		await page.getByRole('button', { name: /Äpfel/ }).click();
		await expect.poll(async () => (await rows(page, 'items')).some(row => row.name === 'Äpfel' && row.quantityInfo === '500 g')).toBe(true);
		await page.getByRole('button', { name: de.favorites_new, exact: true }).click();
		await page.getByPlaceholder(de.item_name_label, { exact: true }).fill('Offline favorite');
		await page.getByPlaceholder(de.item_name_label, { exact: true }).press('Enter');
		await expect.poll(async () => (await rows(page, 'userSettings')).some(row => row.favorites?.some((fav: { name: string }) => fav.name === 'Offline favorite'))).toBe(true);
		await page.getByRole('button', { name: de.close, exact: true }).last().click();
		await page.locator('.fav-scroll').getByRole('button', { name: /Offline favorite/ }).click({ button: 'right' });
		const favoriteEditor = page.getByRole('dialog', { name: de.favorites_edit, exact: true });
		await favoriteEditor.getByPlaceholder(de.item_name_label, { exact: true }).fill('Edited offline favorite');
		await favoriteEditor.getByPlaceholder(de.item_quantity_placeholder, { exact: true }).fill('2 packs');
		await favoriteEditor.getByRole('button', { name: de.item_save, exact: true }).click();
		await expect(favoriteEditor).toHaveCount(0);
		await expect.poll(async () => (await rows(page, 'userSettings')).some(row => row.favorites?.some(fav => fav.name === 'Edited offline favorite' && fav.quantityInfo === '2 packs'))).toBe(true);
		await page.locator('.fav-scroll').getByRole('button', { name: /Äpfel/ }).click({ button: 'right' });
		await page.getByRole('button', { name: de.favorites_remove_action, exact: true }).click();
		await page.getByRole('dialog', { name: 'Äpfel', exact: true }).getByRole('button', { name: de.favorites_remove_action, exact: true }).click();
		await expect.poll(async () => (await rows(page, 'userSettings')).some(row => row.favorites?.some((fav: { name: string }) => fav.name === 'Äpfel'))).toBe(false);
		await page.getByRole('button', { name: de.close, exact: true }).click();
		await page.getByRole('button', { name: de.items_checked_label, exact: true }).click();
		await expect(page.getByText('Offline checked item', { exact: true })).toBeVisible();
		// Exercise client navigation into a cached recipe, not only a cached HTML reload.
		await page.getByRole('button', { name: de.nav_recipes, exact: true }).click();
		await page.getByText('Gemüsepfanne 🥦', { exact: true }).click();
		await expect(page.getByText('Gemüse', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: `${de.recipe_instructions} (1)`, exact: true }).click();
		await expect(page.getByText('Gemüse anbraten.', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: de.a11y_back, exact: true }).click();
		await expect(page.locator('[data-recipe-card]')).toHaveCount(1);
		await expect(page.locator('[data-recipe-id="upgrade-recipe"] [data-recipe-meta]')).toHaveText('Familie');
		await page.getByText('Uncached recipe', { exact: true }).click();
		await expect(page.locator('[data-offline-unavailable]')).toContainText(de.offline_recipe_message);
		await expect(page.getByRole('heading', { name: de.offline_recipe_title })).toBeVisible();
		const heading = page.getByRole('heading', { name: de.offline_recipe_title });
		expect(await heading.evaluate(el => getComputedStyle(el).fontFamily)).not.toContain('Times');
		await page.evaluate(async () => {
			await Promise.all(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})));
		});
		await page.screenshot({ path: `test-results/${test.info().project.name}-offline-recipe.png`, fullPage: true });
		// Full navigation to a URL with neither cached HTML nor detail data uses the
		// self-contained fallback, including working language and recovery controls.
		await page.goto(`/rezepte/${uncachedId}?cold-offline=1`);
		await expect(page.locator('[data-offline-fallback]')).toBeVisible();
		await page.getByRole('button', { name: 'EN', exact: true }).click();
		await expect(page.getByText(en.offline_page_message, { exact: true })).toBeVisible();
		await page.setViewportSize({ width: 320, height: 568 });
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		for (const scheme of ['light', 'dark'] as const) {
			await page.emulateMedia({ colorScheme: scheme });
			await expect(page.getByRole('button', { name: en.offline_retry, exact: true })).toBeVisible();
			await page.screenshot({ path: `test-results/${test.info().project.name}-offline-${scheme}.png`, fullPage: true });
		}
		await page.getByRole('link', { name: en.offline_home, exact: true }).click();
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		await page.goto(`/rezepte/${uncachedId}?cold-offline=2`);
		await expect(page.locator('[data-offline-fallback]')).toBeVisible();
		await page.getByRole('button', { name: 'EN', exact: true }).click();
		await context.setOffline(false);
		await page.getByRole('button', { name: en.offline_retry, exact: true }).click();
		await expect(page.getByRole('heading', { name: 'Uncached recipe', exact: true })).toBeVisible();
		await expect.poll(async () => (await rows(page, 'pendingMutations')).length).toBe(0);
		const serverItems = await (await page.request.get('/api/lists/upgrade-list/items')).json();
		expect(serverItems.filter((row: { name: string }) => row.name === 'Offline checked item')).toHaveLength(1);
		expect(serverItems.find((row: { name: string }) => row.name === 'Offline checked item').isChecked).toBe(true);
		expect(serverItems.filter((row: { name: string }) => row.name === 'Äpfel')).toHaveLength(1);
		// A second online client receives the checked state through actual SSE.
		await desktopPage.getByRole('button', { name: de.items_checked_label, exact: true }).click();
		await expect(desktopPage.getByText('Offline checked item', { exact: true })).toHaveClass(/line-through/);
		const favorites = await (await page.request.get('/api/favorites')).json();
		expect(favorites.filter((row: { name: string; quantityInfo: string }) => row.name === 'Edited offline favorite' && row.quantityInfo === '2 packs')).toHaveLength(1);
		expect(favorites.some((row: { name: string }) => row.name === 'Offline favorite')).toBe(false);
		expect(favorites.some((row: { name: string }) => row.name === 'Äpfel')).toBe(false);
		expect(errors).toEqual([]);
	} finally {
		releaseHomeLists();
		await desktop?.close();
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});
