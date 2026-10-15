import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: './tests/browser',
	timeout: 180_000,
	expect: { timeout: 30_000 },
	workers: 1,
	fullyParallel: false,
	forbidOnly: Boolean(process.env.CI),
	retries: 0,
	reporter: [['list'], ['html', { open: 'never' }]],
	use: { baseURL: 'http://127.0.0.1:3100', viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Europe/Moscow', actionTimeout: 15_000, navigationTimeout: 30_000, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
	projects: [{ name: 'chromium', use: { browserName: 'chromium' } }, { name: 'webkit', use: { browserName: 'webkit' } }]
});
