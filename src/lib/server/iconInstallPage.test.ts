import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { APP_ICON_COOKIE, appIconAssets, installLanguage, isIconInstallPage } from '#lib/appIcon';
import { iconInstallPage } from './iconInstallPage';
import de from '../../../messages/de.json';
import en from '../../../messages/en.json';

vi.mock('#lib/auth', () => ({ getSession: vi.fn(() => null) }));
vi.mock('#lib/server/startup', () => ({ init: async () => {}, startupStatus: () => 'ready' }));
import { handle } from '../../hooks.server';
import { GET } from '../../routes/install/[variant]/+server';

function event(path: string, cookies = new Map<string, string>()) {
	return {
		url: new URL(path, 'http://localhost'), request: new Request(new URL(path, 'http://localhost')),
		params: { variant: path.split('/')[2]?.split('?')[0] }, locals: {},
		cookies: { get: (key: string) => cookies.get(key), set: (key: string, value: string) => cookies.set(key, value) }
	};
}

describe('public icon installation', () => {
	it.each(['/install/light', '/install/dark'])('serves %s anonymously with security headers', async path => {
		const e = event(path);
		const response = await handle({ event: e as never, resolve: () => GET(e as never) as Promise<Response> });
		expect(response.status).toBe(200);
		expect(response.headers.get('Cache-Control')).toBe('no-store');
		expect(response.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
		expect(await response.text()).toContain('Add Groly to your home screen');
	});

	it.each(['/install/dark/private', '/install/unknown', '/einstellungen', '/listen/private'])('does not exempt %s from authentication', async path => {
		expect(isIconInstallPage(path)).toBe(false);
		const resolve = vi.fn();
		await expect(handle({ event: event(path) as never, resolve })).rejects.toMatchObject({ status: 302, location: '/login' });
		expect(resolve).not.toHaveBeenCalled();
	});

	it('keeps a startup choice across the login redirect without changing authentication', async () => {
		const cookies = new Map<string, string>();
		await expect(handle({ event: event('/?app-icon=dark', cookies) as never, resolve: vi.fn() })).rejects.toMatchObject({ location: '/login' });
		expect(cookies.get(APP_ICON_COOKIE)).toBe('dark');
		const response = await handle({ event: event('/login', cookies) as never, resolve: async (_event, options) => new Response(
			await options!.transformPageChunk!({ html: '__GROLY_TOUCH_ICON__ __GROLY_ICON_MANIFEST__', done: true }),
			{ headers: { 'Content-Type': 'text/html' } }
		) });
		expect(await response.text()).toBe('/icons/dark/apple-touch-icon.png /manifest-dark.webmanifest');
		await expect(handle({ event: event('/?app-icon=light', cookies) as never, resolve: vi.fn() })).rejects.toMatchObject({ location: '/login' });
		expect(cookies.get(APP_ICON_COOKIE)).toBe('light');
	});

	it('does not change the existing icon preference by viewing the other install page', async () => {
		const cookies = new Map([[APP_ICON_COOKIE, 'light']]);
		await handle({ event: event('/install/dark', cookies) as never, resolve: async () => new Response('guide') });
		expect(cookies.get(APP_ICON_COOKIE)).toBe('light');
	});

	it('renders no user data and rejects unknown variants', async () => {
		const e = { ...event('/install/dark?lang=en'), locals: { user: { username: 'PRIVATE_USERNAME', settings: '{"lang":"de","private":"SECRET"}' } } };
		const html = await (await GET(e as never)).text();
		expect(html).not.toMatch(/PRIVATE_USERNAME|SECRET/);
		expect(html).toContain('<html lang="en">');
		expect(() => GET({ ...e, params: { variant: '<script>' } } as never)).toThrow();
	});

	it.each([
		[null, undefined, 'de-DE,de;q=0.9', 'de'],
		[null, undefined, 'fr-FR,de;q=0.5', 'en'],
		[null, undefined, null, 'en'],
		[null, 'de', 'en-US', 'de'],
		['en', 'de', 'de-DE', 'en'],
		['de', 'en', 'fr-FR', 'de'],
		['es', undefined, 'de', 'en']
	] as const)('resolves explicit %s / app %s / browser %s to %s', (explicit, saved, browser, expected) => {
		expect(installLanguage(explicit, saved, browser)).toBe(expected);
	});

	it('provides every installation message in both languages and uses matching metadata', () => {
		for (const key of Object.keys(en).filter(key => key.startsWith('icon_'))) {
			expect(de[key as keyof typeof de]).toBeTruthy();
		}
		for (const lang of ['de', 'en'] as const) {
			for (const icon of ['light', 'dark'] as const) {
				const html = iconInstallPage(icon, lang, false, false);
				expect(html).toContain(`<html lang="${lang}">`);
				expect(html).toContain(`href="${appIconAssets(icon).manifest}"`);
				expect(html).toContain(`value="/install/${icon}?lang=${lang}"`);
				expect(html).toContain(lang === 'de' ? 'Installationslink kopieren' : 'Copy installation link');
			}
		}
	});

	it('preserves the installed app identity and features in both manifests with real sized icons', () => {
		const baseline = JSON.parse(readFileSync('static/manifest.webmanifest', 'utf8'));
		for (const icon of ['light', 'dark'] as const) {
			const manifest = JSON.parse(readFileSync(`static/manifest-${icon}.webmanifest`, 'utf8'));
			expect(manifest.id).toBe(baseline.id);
			expect(manifest.scope).toBe(baseline.scope);
			expect(manifest.share_target).toEqual(baseline.share_target);
			expect(manifest.start_url).toBe(`/?app-icon=${icon}`);
			for (const image of manifest.icons) {
				const png = readFileSync(`static${image.src}`);
				expect(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`).toBe(image.sizes);
			}
		}
	});
});
