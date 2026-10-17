import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { seedUpgradeFixture } from '../../scripts/docker-fixtures.mjs';
import de from '../../messages/de.json' with { type: 'json' };
import en from '../../messages/en.json' with { type: 'json' };

// These error-injection checks require requests to reach Playwright routing.
// WebKit can bypass page routes once a service worker controls the page; the
// separate offline/upgrade specs exercise the real service-worker lifecycle.
test.use({ serviceWorkers: 'block' });

const image = process.env.GROLY_TEST_IMAGE;
test.skip(!image, 'Set GROLY_TEST_IMAGE to a locally built production image');
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', timeout: 120_000 }).trim();

test('cooking stays readable; shopping selections persist and failed additions retry without duplicates', async ({ page, request }) => {
	const id = `groly-shopping-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	let releaseSave = () => {};
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=shopping-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-shopping-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100', '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		const names = ['Hokkaidokürbis', 'Sahne', 'Zwiebeln', 'Kartoffeln', 'Karotten', 'Butter', 'Wasser', 'Salz und Pfeffer', 'Zucker', 'Muskat', 'Petersilie (frisch gehackt, alternativ tiefgekühlt)'];
		const created = await page.request.post('/api/recipes', { data: { title: 'Hokkaido-Kürbissuppe', servings: 6, ingredients: names.map((name, i) => ({ name, amount: i === 0 ? '1' : i === 1 ? '100' : null, unit: i === 0 ? 'kg' : i === 1 ? 'ml' : null })), steps: [{ text: 'Alle Zutaten bereitstellen.' }] } });
		expect(created.status()).toBe(201);
		const recipeId = (await created.json()).id;
		const recipe = await (await page.request.get(`/api/recipes/${recipeId}`)).json();
		const exclusionUrl = `/api/recipes/${recipeId}/exclusions`;
		const ingredientIds = recipe.ingredients.map((ingredient: { id: string }) => ingredient.id);
		expect((await page.request.put(exclusionUrl, { data: { excludedIds: ingredientIds.slice(2) } })).ok()).toBe(true);
		await page.goto(`/rezepte/${recipeId}`);
		const cooking = page.locator('[data-recipe-ingredients]');
		await expect(cooking.locator('li')).toHaveCount(11);
		await expect(cooking.locator('input, button')).toHaveCount(0);
		await expect(cooking.locator('li')).toContainText(names);
		expect(await cooking.locator('li span').evaluateAll(elements => elements.every(element => getComputedStyle(element).textDecorationLine === 'none' && getComputedStyle(element).opacity === '1'))).toBe(true);
		const bag = page.getByRole('button', { name: de.a11y_add_to_list, exact: true });
		await expect(bag).toContainText('2/11');
		await bag.click();
		const dialog = page.getByRole('dialog', { name: de.recipe_shopping_title, exact: true });
		await expect(dialog.getByRole('checkbox')).toHaveCount(11);
		await expect(dialog.getByRole('checkbox', { name: 'Zucker', exact: true })).not.toBeChecked();
		await expect(dialog.getByRole('checkbox', { name: 'Hokkaidokürbis', exact: true })).toBeChecked();
		await expect(dialog.locator('select')).toBeEnabled();
		const displayedNames = () => dialog.getByRole('checkbox').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
		expect(await displayedNames()).toEqual(names);
		await dialog.getByRole('checkbox', { name: names[0], exact: true }).uncheck();
		expect(await displayedNames()).toEqual(names);
		await expect.poll(async () => (await (await page.request.get(exclusionUrl)).json()).excludedIds.length).toBe(10);
		await dialog.getByRole('button', { name: de.close, exact: true }).click();
		await bag.click();
		expect(await displayedNames()).toEqual([names[1], names[0], ...names.slice(2)]);
		await dialog.getByRole('checkbox', { name: names[0], exact: true }).check();
		expect(await displayedNames()).toEqual([names[1], names[0], ...names.slice(2)]);
		await expect.poll(async () => (await (await page.request.get(exclusionUrl)).json()).excludedIds.length).toBe(9);
		await dialog.getByRole('button', { name: de.close, exact: true }).click();
		await bag.click();
		expect(await displayedNames()).toEqual(names);
		const compactRow = await dialog.locator('.shopping-ingredient').first().boundingBox();
		expect(compactRow?.height).toBe(40);
		// All options remain reachable; the footer stays visible on a narrow phone.
		await page.setViewportSize({ width: 320, height: 568 });
		await expect(dialog.getByRole('button', { name: de.close, exact: true })).toBeInViewport();
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		for (const theme of ['light', 'dark']) {
			await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
			await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-shopping-de-${theme}-320.png` });
		}
		await dialog.getByRole('checkbox', { name: names.at(-1)!, exact: true }).scrollIntoViewIfNeeded();
		await expect(dialog.getByRole('button', { name: de.close, exact: true })).toBeInViewport();
		// Hold one save while several newer toggles arrive. The last snapshot must win.
		const held = new Promise<void>(resolve => { releaseSave = resolve; });
		let heldSaves = 0;
		await page.route(`**${exclusionUrl}`, async route => { if (route.request().method() === 'PUT') { heldSaves++; await held; } await route.continue(); }, { times: 1 });
		await dialog.getByRole('checkbox', { name: 'Hokkaidokürbis', exact: true }).uncheck();
		await expect.poll(() => heldSaves).toBe(1);
		await dialog.getByRole('checkbox', { name: 'Sahne', exact: true }).uncheck();
		releaseSave();
		await expect.poll(async () => (await (await page.request.get(exclusionUrl)).json()).excludedIds.length).toBe(11);
		await dialog.getByRole('button', { name: de.close, exact: true }).click();
		await expect(bag).toContainText('0/11');
		await expect(bag).toBeEnabled();
		await page.reload();
		await expect(bag).toContainText('0/11');
		await bag.click();
		// A failed save cannot silently add the wrong selection.
		await page.route(`**${exclusionUrl}`, route => route.request().method() === 'PUT' ? route.fulfill({ status: 503, body: '{}' }) : route.continue(), { times: 1 });
		await dialog.getByRole('checkbox', { name: 'Hokkaidokürbis', exact: true }).check();
		await expect(dialog.getByRole('alert')).toContainText(de.recipe_shopping_save_error);
		await dialog.locator('select').selectOption('upgrade-list');
		await expect(dialog.getByRole('button', { name: de.recipe_shopping_add_one, exact: true })).toBeDisabled();
		await dialog.getByRole('button', { name: de.recipe_shopping_retry, exact: true }).click();
		await expect(dialog.getByRole('alert')).toHaveCount(0);
		await dialog.getByRole('checkbox', { name: 'Sahne', exact: true }).check();
		const add = dialog.getByRole('button', { name: de.recipe_shopping_add_many.replace('{count}', '2'), exact: true });
		await expect(add).toBeEnabled();
		// Simulate a committed POST whose response was lost. Retry must reuse IDs.
		await page.route('**/api/lists/upgrade-list/items', async route => { if (route.request().method() === 'POST') { await route.fetch(); await route.abort(); } else await route.continue(); }, { times: 1 });
		await add.click();
		await expect(dialog.getByRole('alert')).toContainText(de.recipe_shopping_add_error);
		await add.click();
		await expect(page).toHaveURL(/\/listen\/upgrade-list$/);
		const items = await (await page.request.get('/api/lists/upgrade-list/items')).json();
		for (const name of names.slice(0, 2)) expect(items.filter((item: { name: string }) => item.name === name)).toHaveLength(1);
		expect(items.find((item: { name: string }) => item.name === names[0]).quantityInfo).toBe('1 kg');
		expect(items.some((item: { name: string }) => item.name === 'Zucker')).toBe(false);
		await page.goto(`/rezepte/${recipeId}`);
		await expect(bag).toContainText('2/11');
		await expect(cooking.locator('li')).toHaveCount(11);
		// Loading failures must preserve the stored selection and offer recovery.
		await page.route(`**${exclusionUrl}`, route => route.fulfill({ status: 503, body: '{}' }), { times: 1 });
		await page.reload();
		await bag.click();
		await expect(dialog.getByRole('alert')).toContainText(de.recipe_shopping_load_selection_error);
		await expect(dialog.getByRole('checkbox', { name: 'Zucker', exact: true })).toBeDisabled();
		await dialog.getByRole('button', { name: de.recipe_shopping_retry, exact: true }).click();
		await expect(dialog.getByRole('checkbox', { name: 'Zucker', exact: true })).toBeEnabled();
		await expect(dialog.getByRole('checkbox', { name: 'Zucker', exact: true })).not.toBeChecked();
		await dialog.getByRole('button', { name: de.close, exact: true }).click();
		await page.route('**/api/lists', route => route.fulfill({ status: 503, body: '{}' }), { times: 1 });
		await bag.focus();
		await bag.click();
		await expect(dialog.getByRole('alert')).toContainText(de.recipe_shopping_load_error);
		await dialog.getByRole('button', { name: de.recipe_shopping_retry, exact: true }).click();
		await expect(dialog.locator('select')).toBeEnabled();
		await page.keyboard.press('Escape');
		await expect(dialog).toHaveCount(0);
		await expect(bag).toBeFocused();
		// Portion changes must keep exclusions and scale the later shopping quantities.
		for (let i = 0; i < 6; i++) await page.getByRole('button', { name: de.a11y_increase_servings, exact: true }).click();
		await expect.poll(async () => (await (await page.request.get(`/api/recipes/${recipeId}`)).json()).servings).toBe(12);
		// Existing and new lists require an explicit confirmation. English remains compact.
		expect((await page.request.patch('/api/users/me', { data: { settings: { lang: 'en' } } })).ok()).toBe(true);
		await page.reload();
		await page.setViewportSize({ width: 390, height: 844 });
		await page.getByRole('button', { name: en.a11y_add_to_list, exact: true }).click();
		const englishDialog = page.getByRole('dialog', { name: en.recipe_shopping_title, exact: true });
		await englishDialog.locator('select').selectOption('__new__');
		await expect(englishDialog.getByLabel(en.recipe_shopping_list_name, { exact: true })).toHaveValue('Hokkaido-Kürbissuppe');
		await englishDialog.getByLabel(en.recipe_shopping_list_name, { exact: true }).fill('Cooking shopping');
		await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-shopping-en-new-390.png` });
		await englishDialog.getByRole('button', { name: en.recipe_shopping_add_many.replace('{count}', '2'), exact: true }).click();
		await expect(page).toHaveURL(/\/listen\//);
		const lists = (await (await page.request.get('/api/lists')).json()).lists;
		const newList = lists.find((list: { name: string }) => list.name === 'Cooking shopping');
		expect(newList).toBeTruthy();
		const newItems = await (await page.request.get(`/api/lists/${newList.id}/items`)).json();
		expect(newItems).toHaveLength(2);
		expect(newItems.find((item: { name: string }) => item.name === names[0]).quantityInfo).toBe('2 kg');
		expect(errors).toEqual([]);
	} finally {
		releaseSave();
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});

test('one recipe card keeps favorites at the bottom and shows concise metadata in both languages', async ({ page, request }) => {
	const id = `groly-overview-${randomUUID().slice(0, 8)}`;
	const volume = `${id}-data`;
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	try {
		docker('volume', 'create', volume);
		docker('run', '-d', '--platform', 'linux/amd64', '--name', id, '-p', '127.0.0.1:3100:3000', '--mount', `type=volume,src=${volume},dst=/app/data`, '-e', 'ADMIN_USERNAME=overview-bootstrap', '-e', 'ADMIN_PASSWORD=Groly-overview-fixture!', '-e', 'ORIGIN=http://127.0.0.1:3100', '-e', 'VAPID_PUBLIC_KEY=', '-e', 'VAPID_PRIVATE_KEY=', '-e', 'PUBLIC_VAPID_PUBLIC_KEY=', image!);
		await expect.poll(async () => { try { return (await request.get('/api/health')).status(); } catch { return 0; } }).toBe(200);
		execFileSync('docker', ['exec', '-i', id, 'node', '--input-type=module'], { input: `await (${seedUpgradeFixture.toString()})()` });
		await page.goto('/login');
		await page.locator('input[autocomplete="username"]').fill('upgrade-owner');
		await page.locator('input[autocomplete="current-password"]').fill('Groly-upgrade-test-2026!');
		await page.locator('button[type="submit"]').click();
		await expect(page.getByText('Familie 🥦', { exact: true }).first()).toBeVisible();
		async function updateRecipe(recipeId: string, changes: Record<string, unknown>) {
			const recipe = await (await page.request.get(`/api/recipes/${recipeId}`)).json();
			expect((await page.request.put(`/api/recipes/${recipeId}`, { data: { ...recipe, ...changes } })).ok()).toBe(true);
		}
		async function createRecipe(values: Record<string, unknown> & { title: string }) {
			const response = await page.request.post('/api/recipes', { data: { servings: 2, ingredients: [], steps: [], ...values } });
			expect(response.status()).toBe(201);
			const recipeId = (await response.json()).id as string;
			await updateRecipe(recipeId, values);
			return recipeId;
		}
		const onePot = await createRecipe({ title: 'One-Pot-Spätzle mit Hähnchen von Henglein', description: 'lecker', prepTime: 15, cookTime: 30, rating: 4, tags: ['chillig', 'schnell', 'zusätzlich mit einer besonders ausführlichen Beschreibung im Tag'] });
		const chili = await createRecipe({ title: 'Chili con Carne – das beste Rezept', description: 'Importierter Beschreibungstext', cookTime: 45, rating: 3, isFavorite: true });
		const noInfo = await createRecipe({ title: 'Ohne Angaben', description: 'lecker' });
		const ratingOnly = await createRecipe({ title: 'Nur bewertet', rating: 5, isFavorite: true });
		await page.goto('/rezepte');
		const card = page.locator('[data-recipe-card]');
		await expect(card).toHaveCount(1);
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await page.getByRole('button', { name: de.recipes_sort_label, exact: true }).click();
		await page.getByRole('button', { name: de.recipes_sort_title, exact: true }).click();
		const expectedOrder = ['upgrade-recipe', noInfo, onePot, chili, ratingOnly];
		expect(await card.locator('[data-recipe-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-recipe-id')))).toEqual(expectedOrder);
		await expect(card.locator('h3')).toHaveText([de.recipes_favorites]);
		expect(await card.locator('h3').evaluate(heading => {
			const title = heading.parentElement!.querySelector('h2')!;
			const section = getComputedStyle(heading), main = getComputedStyle(title);
			return section.color === main.color && section.fontSize === main.fontSize && section.fontWeight === main.fontWeight;
		})).toBe(true);
		await expect(card).not.toContainText('lecker');
		await expect(card).not.toContainText('Importierter Beschreibungstext');
		await expect(card.locator(`[data-recipe-id="${onePot}"] [data-recipe-meta]`)).toContainText('4 · 45 Min · chillig · schnell');
		await expect(card.locator('[data-recipe-id="upgrade-recipe"] [data-recipe-meta]')).toHaveText('Familie');
		await expect(card.locator(`[data-recipe-id="${ratingOnly}"] [data-recipe-meta]`)).toHaveText('5');
		await expect(card.locator(`[data-recipe-id="${noInfo}"] [data-recipe-meta]`)).toHaveCount(0);
		// Search, tag filtering and the saved sort still operate across both groups.
		await page.getByRole('button', { name: de.a11y_search, exact: true }).click();
		await page.getByPlaceholder(de.recipes_search_placeholder).fill('Chili');
		await expect(card.locator('[data-recipe-id]')).toHaveCount(1);
		await expect(card.locator('h3')).toHaveCount(0);
		await page.getByRole('button', { name: de.a11y_close_search, exact: true }).click();
		await page.getByRole('button', { name: de.a11y_search, exact: true }).click();
		await page.getByRole('button', { name: 'chillig', exact: true }).click();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(1);
		await expect(card.locator(`[data-recipe-id="${onePot}"]`)).toBeVisible();
		await page.getByRole('button', { name: de.a11y_close_search, exact: true }).click();
		for (const [lang, messages] of [['de', de], ['en', en]] as const) {
			expect((await page.request.patch('/api/users/me', { data: { settings: { lang } } })).ok()).toBe(true);
			await page.reload();
			await expect(card.locator('h3')).toHaveText([messages.recipes_favorites]);
			for (const width of [320, 390]) {
				await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
				expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
				const bounds = await card.boundingBox();
				expect(bounds!.y + bounds!.height).toBeGreaterThan((width === 320 ? 568 : 844) - 120);
				const meta = card.locator(`[data-recipe-id="${onePot}"] [data-recipe-meta]`);
				expect(await meta.evaluate(element => element.scrollWidth > element.clientWidth)).toBe(true);
				expect((await meta.boundingBox())!.height).toBeLessThan(20);
				for (const theme of ['light', 'dark']) {
					await page.evaluate(theme => { document.documentElement.dataset.theme = theme; }, theme);
					await page.screenshot({ animations: 'disabled', path: `test-results/${test.info().project.name}-recipes-${lang}-${theme}-${width}.png` });
				}
			}
		}
		// The original description is still present in the detail view.
		await card.locator(`[data-recipe-id="${onePot}"]`).click();
		await expect(page.getByText('lecker', { exact: true })).toBeVisible();
		await page.getByRole('button', { name: en.a11y_back, exact: true }).click();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		for (const recipeId of [chili, ratingOnly]) await updateRecipe(recipeId, { isFavorite: false });
		await page.reload();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await expect(card.locator('h3')).toHaveCount(0);
		for (const recipeId of expectedOrder) await updateRecipe(recipeId, { isFavorite: true });
		await page.reload();
		await expect(card.locator('[data-recipe-id]')).toHaveCount(5);
		await expect(card.locator('h3')).toHaveCount(0);
		for (const recipeId of expectedOrder) expect((await page.request.delete(`/api/recipes/${recipeId}`, { headers: { Origin: 'http://127.0.0.1:3100' } })).ok()).toBe(true);
		await page.reload();
		await expect(card).toHaveCount(0);
		await expect(page.getByText(en.recipes_empty, { exact: true })).toBeVisible();
		expect(errors).toEqual([]);
	} finally {
		docker('rm', '-f', id);
		docker('volume', 'rm', volume);
	}
});
