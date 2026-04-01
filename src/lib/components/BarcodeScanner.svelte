<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	// Minimale Typen für die native BarcodeDetector API (Chrome/Android)
	interface NativeBarcodeDetector {
		detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>;
	}
	interface NativeBarcodeDetectorStatic {
		new(options?: { formats?: string[] }): NativeBarcodeDetector;
		getSupportedFormats(): Promise<string[]>;
	}

	let { onFound, onClose }: {
		onFound: (name: string) => void;
		onClose: () => void;
	} = $props();

	type ScanPhase = 'requesting' | 'scanning' | 'loading' | 'feedback' | 'not_found' | 'denied' | 'error';

	let phase = $state<ScanPhase>('requesting');
	let feedbackText = $state('');
	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let isOnline = $state(typeof navigator !== 'undefined' ? navigator.onLine : true);

	$effect(() => {
		function setOnline() { isOnline = true; }
		function setOffline() { isOnline = false; }
		window.addEventListener('online', setOnline);
		window.addEventListener('offline', setOffline);
		return () => {
			window.removeEventListener('online', setOnline);
			window.removeEventListener('offline', setOffline);
		};
	});

	// Kamera-Setup
	$effect(() => {
		let cancelled = false;

		async function start() {
			try {
				const mediaStream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }
				});
				if (cancelled) { mediaStream.getTracks().forEach(t => t.stop()); return; }
				stream = mediaStream;
				phase = 'scanning';
			} catch (err) {
				if (cancelled) return;
				phase = (err as Error).name === 'NotAllowedError' ? 'denied' : 'error';
			}
		}

		void start();
		return () => { cancelled = true; stopCamera(); };
	});

	// Stream → Video verbinden
	$effect(() => {
		if (!videoEl || !stream) return;
		videoEl.srcObject = stream;
		videoEl.play().catch(() => {});
	});

	// Scan-Loop: native BarcodeDetector → ZBar-WASM Fallback
	$effect(() => {
		if (phase !== 'scanning' || !videoEl || !stream) return;

		let active = true;
		let rafId = 0;
		let frameScanning = false;
		let lastScanTime = 0;
		const SCAN_INTERVAL = 150; // ms zwischen Scans

		let scanFrame: (() => Promise<string | null>) | null = null;

		async function init() {
			// Priorität 1: Native BarcodeDetector (Chrome/Android, hardware-beschleunigt)
			if ('BarcodeDetector' in window) {
				try {
					const BD = (window as unknown as { BarcodeDetector: NativeBarcodeDetectorStatic }).BarcodeDetector;
					const supported = await BD.getSupportedFormats();
					const wanted = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];
					const formats = wanted.filter(f => supported.includes(f));
					const detector = new BD({ formats: formats.length ? formats : ['ean_13', 'ean_8'] });
					scanFrame = async () => {
						if (!videoEl || videoEl.readyState < 2) return null;
						const results = await detector.detect(videoEl);
						return results[0]?.rawValue ?? null;
					};
				} catch {
					// Weiter zu ZBar
				}
			}

			// Priorität 2: ZBar-WASM (iOS, Firefox, Fallback)
			if (!scanFrame) {
				const canvas = document.createElement('canvas');
				const ctx = canvas.getContext('2d')!;
				const { scanImageData } = await import('@undecaf/zbar-wasm');
				scanFrame = async () => {
					if (!videoEl || videoEl.readyState < 2) return null;
					const w = videoEl.videoWidth;
					const h = videoEl.videoHeight;
					if (!w || !h) return null;
					if (canvas.width !== w) canvas.width = w;
					if (canvas.height !== h) canvas.height = h;
					ctx.drawImage(videoEl, 0, 0, w, h);
					const imageData = ctx.getImageData(0, 0, w, h);
					const symbols = await scanImageData(imageData);
					return symbols[0]?.decode() ?? null;
				};
			}

			if (active) rafId = requestAnimationFrame(loop);
		}

		function loop(timestamp: number) {
			if (!active) return;
			rafId = requestAnimationFrame(loop);
			if (frameScanning || timestamp - lastScanTime < SCAN_INTERVAL || !scanFrame) return;
			frameScanning = true;
			lastScanTime = timestamp;
			scanFrame().then(result => {
				frameScanning = false;
				if (result && active) {
					active = false;
					void handleBarcode(result);
				}
			}).catch(() => { frameScanning = false; });
		}

		void init();

		return () => {
			active = false;
			cancelAnimationFrame(rafId);
		};
	});

	function stopCamera() {
		stream?.getTracks().forEach(t => t.stop());
		stream = null;
	}

	async function handleBarcode(code: string) {
		phase = 'loading';
		try {
			const res = await fetch(`/api/barcode/${encodeURIComponent(code)}`);
			const data = await res.json();
			if (data.name) {
				onFound(data.name);
				feedbackText = data.name;
				phase = 'feedback';
				setTimeout(() => { phase = 'scanning'; }, 1500);
			} else {
				phase = 'not_found';
				setTimeout(() => { phase = 'scanning'; }, 2000);
			}
		} catch {
			if (!navigator.onLine) {
				phase = 'scanning';
			} else {
				phase = 'not_found';
				setTimeout(() => { phase = 'scanning'; }, 2000);
			}
		}
	}

	function handleClose() {
		stopCamera();
		onClose();
	}
</script>

<!-- Full-screen Overlay -->
<div class="fixed inset-0 z-[70] bg-black overflow-hidden" style="height: 100dvh">

	<!-- Kamera-Video -->
	{#if phase !== 'denied' && phase !== 'error'}
		<!-- svelte-ignore a11y_media_has_caption -->
		<video
			bind:this={videoEl}
			playsinline
			muted
			class="absolute inset-0 w-full h-full object-cover"
		></video>
	{/if}

	<!-- Gradient -->
	<div class="absolute inset-0 pointer-events-none"
	     style="background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 65%, rgba(0,0,0,0.65) 100%)">
	</div>

	<!-- Offline-Banner -->
	{#if !isOnline}
		<div class="offline-banner absolute top-0 left-0 right-0 z-20 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold"
		     style="background-color: rgba(180, 83, 9, 0.92); color: white; padding-top: max(0.625rem, env(safe-area-inset-top))">
			<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
				<line x1="1" y1="1" x2="23" y2="23"/>
				<path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
				<path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
				<path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
				<path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
				<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
				<line x1="12" y1="20" x2="12.01" y2="20"/>
			</svg>
			{t.barcode_offline}
		</div>
	{/if}

	<!-- Schließen-Button -->
	<button
		onclick={handleClose}
		class="absolute top-12 right-4 z-10 w-10 h-10 rounded-full flex items-center justify-center"
		style="background-color: rgba(0,0,0,0.4); color: white"
		aria-label="Schließen"
	>
		<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
			<line x1="18" y1="6" x2="6" y2="18"/>
			<line x1="6" y1="6" x2="18" y2="18"/>
		</svg>
	</button>

	<!-- Retikel -->
	{#if phase === 'scanning' || phase === 'loading' || phase === 'feedback' || phase === 'not_found'}
		<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
			<div class="relative" style="width: 76%; aspect-ratio: 2 / 1">
				<div class="absolute top-0 left-0 w-8 h-8 border-t-2 border-l-2 border-white rounded-tl-md"></div>
				<div class="absolute top-0 right-0 w-8 h-8 border-t-2 border-r-2 border-white rounded-tr-md"></div>
				<div class="absolute bottom-0 left-0 w-8 h-8 border-b-2 border-l-2 border-white rounded-bl-md"></div>
				<div class="absolute bottom-0 right-0 w-8 h-8 border-b-2 border-r-2 border-white rounded-br-md"></div>
				{#if phase === 'scanning'}
					<div class="scan-line absolute left-2 right-2 h-px opacity-70"
					     style="background: linear-gradient(to right, transparent, white, transparent)"></div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Status unten -->
	<div class="absolute bottom-0 left-0 right-0 flex flex-col items-center pb-16 px-6 gap-3">

		{#if phase === 'requesting'}
			<div class="w-8 h-8 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>

		{:else if phase === 'scanning'}
			<p class="text-white text-sm font-medium opacity-80">{t.barcode_scan}</p>

		{:else if phase === 'loading'}
			<div class="w-6 h-6 rounded-full border-2 border-white/30 border-t-white animate-spin"></div>

		{:else if phase === 'feedback'}
			<div class="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
			     style="background-color: rgba(34, 197, 94, 0.9); color: white">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
				{feedbackText} {t.barcode_added}
			</div>

		{:else if phase === 'not_found'}
			<div class="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold"
			     style="background-color: rgba(239, 68, 68, 0.9); color: white">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
					<circle cx="12" cy="12" r="10"/>
					<line x1="12" y1="8" x2="12" y2="12"/>
					<line x1="12" y1="16" x2="12.01" y2="16"/>
				</svg>
				{t.barcode_not_found}
			</div>

		{:else if phase === 'denied'}
			<div class="absolute inset-0 flex items-center justify-center p-6">
				<div class="w-full max-w-xs rounded-3xl p-6 text-center space-y-4"
				     style="background-color: var(--color-surface-low)">
					<div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
					     style="background-color: color-mix(in srgb, var(--color-error, #ef4444) 15%, transparent)">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-error, #ef4444)" stroke-width="2" stroke-linecap="round">
							<circle cx="12" cy="12" r="10"/>
							<line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
						</svg>
					</div>
					<p class="text-sm" style="color: var(--color-on-surface)">{t.barcode_camera_denied}</p>
					<button onclick={handleClose} class="w-full h-11 rounded-full text-sm font-semibold"
					        style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)">
						{t.close}
					</button>
				</div>
			</div>

		{:else if phase === 'error'}
			<div class="absolute inset-0 flex items-center justify-center p-6">
				<div class="w-full max-w-xs rounded-3xl p-6 text-center space-y-4"
				     style="background-color: var(--color-surface-low)">
					<div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto"
					     style="background-color: color-mix(in srgb, var(--color-on-surface) 10%, transparent)">
						<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
							<rect x="3" y="4" width="18" height="12" rx="2"/>
							<line x1="2" y1="20" x2="22" y2="20"/>
						</svg>
					</div>
					<p class="text-sm" style="color: var(--color-on-surface)">{t.barcode_unsupported}</p>
					<button onclick={handleClose} class="w-full h-11 rounded-full text-sm font-semibold"
					        style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)">
						{t.close}
					</button>
				</div>
			</div>

		{/if}
	</div>
</div>

<style>
	.scan-line {
		top: 50%;
		animation: scanMove 2s ease-in-out infinite;
	}

	@keyframes scanMove {
		0%   { top: 15%; }
		50%  { top: 85%; }
		100% { top: 15%; }
	}

	.offline-banner {
		animation: slideDown 0.3s ease-out;
	}

	@keyframes slideDown {
		from { transform: translateY(-100%); opacity: 0; }
		to   { transform: translateY(0);    opacity: 1; }
	}
</style>
