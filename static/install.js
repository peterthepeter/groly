// No account data is read or changed by the installation guide.
(() => {
	const input = document.getElementById('install-link');
	input.value = new URL(input.value, location.origin).href;
	input.addEventListener('click', () => input.select());
	const copyStatus = document.getElementById('copy-status');
	document.getElementById('copy-link').addEventListener('click', async () => {
		try {
			await navigator.clipboard.writeText(input.value);
			copyStatus.textContent = copyStatus.dataset.copied;
		} catch {
			input.focus();
			input.select();
			copyStatus.textContent = copyStatus.dataset.failed;
		}
	});

	let prompt = null;
	const installButton = document.getElementById('install-button');
	const installStatus = document.getElementById('install-status');
	const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
	function updateInstallButton() {
		installButton.hidden = !prompt || standalone || document.body.dataset.platform !== 'android';
	}
	for (const button of document.querySelectorAll('[data-platform-button]')) {
		button.addEventListener('click', () => {
			const platform = button.dataset.platformButton;
			document.body.dataset.platform = platform;
			for (const option of document.querySelectorAll('[data-platform-button]')) option.setAttribute('aria-pressed', String(option === button));
			for (const section of document.querySelectorAll('[data-instructions]')) section.hidden = section.dataset.instructions !== platform;
			updateInstallButton();
		});
	}
	window.addEventListener('beforeinstallprompt', event => {
		event.preventDefault();
		prompt = event;
		updateInstallButton();
	});
	window.addEventListener('appinstalled', () => {
		prompt = null;
		updateInstallButton();
		installStatus.textContent = installStatus.dataset.accepted;
	});
	installButton.addEventListener('click', async () => {
		const pending = prompt;
		if (!pending) return;
		prompt = null;
		updateInstallButton();
		try {
			await pending.prompt();
			const { outcome } = await pending.userChoice;
			installStatus.textContent = outcome === 'accepted' ? installStatus.dataset.accepted : installStatus.dataset.cancelled;
		} catch { installStatus.textContent = installStatus.dataset.failed; }
	});
	if (document.body.dataset.production === 'true' && 'serviceWorker' in navigator && window.isSecureContext) {
		navigator.serviceWorker.register('/service-worker.js', { scope: '/' }).catch(() => {
			// Browser-menu installation instructions remain usable.
		});
	}
})();
