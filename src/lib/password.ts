export const PASSWORD_HINT = 'Mind. 8 Zeichen, 1 Großbuchstabe, 1 Zahl';

export function validatePassword(password: string): string | null {
	if (password.length < 8) return 'Passwort zu kurz (min. 8 Zeichen)';
	if (!/[A-Z]/.test(password)) return 'Passwort benötigt mind. einen Großbuchstaben';
	if (!/[0-9]/.test(password)) return 'Passwort benötigt mind. eine Zahl';
	return null;
}
