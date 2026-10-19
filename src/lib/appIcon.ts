import { languageFromAcceptLanguage, languageFromBrowserLanguage } from './language';

export type AppIcon = 'light' | 'dark';
export const APP_ICON_COOKIE = 'groly_icon';

export function isAppIcon(value: unknown): value is AppIcon {
	return value === 'light' || value === 'dark';
}

export function appIconAssets(icon: AppIcon) {
	const directory = icon === 'dark' ? '/icons/dark' : '/icons';
	return {
		preview: `${directory}/icon-512.png`,
		touch: `${directory}/apple-touch-icon.png`,
		manifest: `/manifest-${icon}.webmanifest`
	};
}

export function installPath(icon: AppIcon, lang: 'de' | 'en') {
	return `/install/${icon}?lang=${lang}`;
}

export function installLanguage(explicit: string | null, saved: unknown, acceptLanguage: string | null) {
	if (explicit !== null) return languageFromBrowserLanguage(explicit);
	if (typeof saved === 'string') return languageFromBrowserLanguage(saved);
	return languageFromAcceptLanguage(acceptLanguage);
}

// Only these two public documents are exempt from page authentication.
export function isIconInstallPage(path: string) {
	return path === '/install/light' || path === '/install/dark';
}
