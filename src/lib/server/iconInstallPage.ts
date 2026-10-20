import de from '../../../messages/de.json';
import en from '../../../messages/en.json';
import { appIconAssets, installPath, type AppIcon } from '#lib/appIcon';

function escapeHtml(value: string) {
	return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

// A standalone public document deliberately avoids the authenticated app layout,
// account synchronization, SSE, and any serialization of the current user.
export function iconInstallPage(icon: AppIcon, lang: 'de' | 'en', android: boolean, production: boolean) {
	const copy = lang === 'de' ? de : en;
	const t = (key: keyof typeof en) => escapeHtml(copy[key]);
	const assets = appIconAssets(icon);
	const platform = android ? 'android' : 'ios';
	const steps = (keys: (keyof typeof en)[]) => `<ol>${keys.map(key => `<li>${t(key)}</li>`).join('')}</ol>`;
	return `<!doctype html>
<html lang="${lang}">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
	<meta name="robots" content="noindex">
	<meta name="theme-color" content="#111513" media="(prefers-color-scheme: dark)">
	<meta name="theme-color" content="#f8f9fa" media="(prefers-color-scheme: light)">
	<meta name="mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-capable" content="yes">
	<meta name="apple-mobile-web-app-title" content="Groly">
	<title>${t('icon_install_title')} · Groly</title>
	<link rel="apple-touch-icon" sizes="180x180" href="${assets.touch}">
	<link rel="icon" type="image/png" href="${assets.touch}">
	<link rel="manifest" href="${assets.manifest}">
	<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600&family=Plus+Jakarta+Sans:wght@600;700&display=swap">
	<link rel="stylesheet" href="/install.css">
	<script src="/install.js" defer></script>
</head>
<body data-platform="${platform}" data-production="${production}">
<main>
	<header>
		<a class="brand" href="/">Groly</a>
		<nav aria-label="${t('language')}"><a href="${installPath(icon, 'de')}" lang="de" ${lang === 'de' ? 'aria-current="page"' : ''}>Deutsch</a><a href="${installPath(icon, 'en')}" lang="en" ${lang === 'en' ? 'aria-current="page"' : ''}>English</a></nav>
	</header>
	<section class="intro">
		<img class="preview" src="${assets.preview}" width="96" height="96" alt="">
		<p class="variant">${t(icon === 'dark' ? 'icon_dark' : 'icon_light')}</p>
		<h1>${t('icon_install_title')}</h1>
		<p>${t('icon_install_intro')}</p>
	</section>
	<div class="icon-choices" role="group" aria-label="${t('icon_settings_title')}">
		${(['light', 'dark'] as const).map(choice => `<a class="icon-choice" data-icon-choice href="${installPath(choice, lang)}&amp;platform=${platform}" ${choice === icon ? 'aria-current="true"' : ''}><img src="${appIconAssets(choice).preview}" width="28" height="28" alt=""><span>${t(choice === 'light' ? 'theme_light' : 'theme_dark')}</span></a>`).join('')}
	</div>
	<div class="platforms" role="group" aria-label="${t('icon_platform_label')}">
		<button type="button" data-platform-button="ios" aria-pressed="${!android}">iPhone / iPad</button>
		<button type="button" data-platform-button="android" aria-pressed="${android}">Android</button>
	</div>
	<section data-instructions="ios" ${android ? 'hidden' : ''}>
		${steps(['icon_ios_step1', 'icon_ios_step2', 'icon_ios_step3'])}
	</section>
	<section data-instructions="android" ${!android ? 'hidden' : ''}>
		${steps(['icon_android_step1', 'icon_android_step2', 'icon_android_step3'])}
	</section>
	<p class="account-note">${t('icon_install_account')}</p>
	<footer>
		<p>${t('icon_browser_hint')}</p>
		<button id="install-button" class="primary" type="button" hidden>${t('icon_install_button')}</button>
		<p id="install-status" role="status" data-accepted="${t('icon_install_accepted')}" data-cancelled="${t('icon_install_cancelled')}" data-failed="${t('icon_install_failed')}"></p>
		<label for="install-link">${t('icon_link_label')}</label>
		<input id="install-link" type="url" readonly value="${installPath(icon, lang)}">
		<button id="copy-link" class="secondary" type="button">${t('icon_copy')}</button>
		<p id="copy-status" role="status" data-copied="${t('icon_copied')}" data-failed="${t('icon_copy_failed')}"></p>
		<a class="open-app" href="/">${t('icon_open_groly')}</a>
	</footer>
</main>
</body>
</html>`;
}
