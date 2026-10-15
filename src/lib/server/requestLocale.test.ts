import { describe, expect, it } from 'vitest';
import { withRequestLocale } from './requestLocale';
import { getLocale } from '#lib/paraglide/runtime';
import { login_error } from '#lib/paraglide/messages';

describe('request-isolated translations', () => {
	it('keeps concurrent and nested German/English requests separate across awaits', async () => {
		await Promise.all(Array.from({ length: 20 }, (_, i) => {
			const locale = i % 2 ? 'en' : 'de';
			return withRequestLocale(locale, 'https://groly.example', async () => {
				await new Promise(resolve => setTimeout(resolve, i % 4));
				expect(getLocale()).toBe(locale);
				expect(login_error()).toBe(locale === 'en' ? 'Invalid username or password' : 'Falscher Benutzername oder Passwort');
				withRequestLocale(locale === 'en' ? 'de' : 'en', 'https://groly.example', () => expect(getLocale()).not.toBe(locale));
				expect(getLocale()).toBe(locale);
			});
		}));
	});
});
