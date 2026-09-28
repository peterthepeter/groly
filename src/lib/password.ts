export function getPasswordHint(lang: string): string {
	return lang === 'en'
		? 'Min. 8 characters, 1 uppercase letter, 1 number'
		: 'Mind. 8 Zeichen, 1 Großbuchstabe, 1 Zahl';
}

export type PasswordRule = 'too_short' | 'missing_uppercase' | 'missing_number';

export function validatePasswordRule(password: string): PasswordRule | null {
	if (password.length < 8) return 'too_short';
	if (!/[A-Z]/.test(password)) return 'missing_uppercase';
	if (!/[0-9]/.test(password)) return 'missing_number';
	return null;
}

export function validatePassword(password: string): string | null {
	const rule = validatePasswordRule(password);
	if (rule === 'too_short') return 'Passwort zu kurz (min. 8 Zeichen)';
	if (rule === 'missing_uppercase') return 'Passwort benötigt mind. einen Großbuchstaben';
	if (rule === 'missing_number') return 'Passwort benötigt mind. eine Zahl';
	return null;
}
