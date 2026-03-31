<script lang="ts">
	import { t } from '$lib/i18n.svelte';

	let { onFound, onClose }: {
		onFound: (name: string) => void;
		onClose: () => void;
	} = $props();

	type ScanPhase = 'requesting' | 'scanning' | 'loading' | 'feedback' | 'not_found' | 'denied' | 'error';

	let phase = $state<ScanPhase>('requesting');
	let feedbackText = $state('');
	let videoEl = $state<HTMLVideoElement | null>(null);
	let stream = $state<MediaStream | null>(null);
	let rafId = 0;

	// Detektor-Klasse (nativ oder Polyfill)
	let DetectorClass = $state<typeof BarcodeDetector | null>(null);

	// Kamera-Setup + Polyfill laden
	$effect(() => {
		let cancelled = false;

		async function start() {
			// Nativ verfügbar?
			let Cls: typeof BarcodeDetector;
			if ('BarcodeDetector' in window) {
				Cls = BarcodeDetector;
			} else {
				// Polyfill für iOS < 17 und andere Browser
				try {
					const { BarcodeDetector: PolyDetector, prepareZXingModule } = await import('barcode-detector/ponyfill');
					await prepareZXingModule();
					Cls = PolyDetector as unknown as typeof BarcodeDetector;
				} catch {
					phase = 'error';
					return;
				}
			}

			if (cancelled) return;
			DetectorClass = Cls;

			try {
				const mediaStream = await navigator.mediaDevices.getUserMedia({
					video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }
				});
				if (cancelled) {
					mediaStream.getTracks().forEach(t => t.stop());
					return;
				}
				stream = mediaStream;
				phase = 'scanning';
			} catch (err) {
				if (cancelled) return;
				phase = (err as Error).name === 'NotAllowedError' ? 'denied' : 'error';
			}
		}

		void start();

		return () => {
			cancelled = true;
			stopCamera();
		};
	});

	// Stream → Video verbinden
	$effect(() => {
		if (!videoEl || !stream) return;
		videoEl.srcObject = stream;
		videoEl.play().catch(() => {});
	});

	// Scan-Loop (nur wenn phase === 'scanning' und Detector geladen)
	$effect(() => {
		if (phase !== 'scanning' || !videoEl || !DetectorClass) return;

		const detector = new DetectorClass({
			formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
		});

		let running = true;

		async function tick() {
			if (!running) return;
			if (!videoEl || videoEl.readyState < 2) {
				if (running) rafId = requestAnimationFrame(tick);
				return;
			}
			try {
				const barcodes = await detector.detect(videoEl);
				if (!running) return;
				if (barcodes.length > 0) {
					running = false;
					await handleBarcode(barcodes[0].rawValue);
					return;
				}
			} catch {
				// Frame noch nicht bereit
			}
			if (running) rafId = requestAnimationFrame(tick);
		}

		rafId = requestAnimationFrame(tick);

		return () => {
			running = false;
			cancelAnimationFrame(rafId);
		};
	});

	function stopCamera() {
		cancelAnimationFrame(rafId);
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
			phase = 'not_found';
			setTimeout(() => { phase = 'scanning'; }, 2000);
		}
	}

	function handleClose() {
		stopCamera();
		onClose();
	}
</script>

<!-- Full-screen Overlay — deckt auch Tastatur ab -->
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

	<!-- Gradient für bessere Lesbarkeit -->
	<div class="absolute inset-0 pointer-events-none"
	     style="background: linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 65%, rgba(0,0,0,0.65) 100%)">
	</div>

	<!-- Schließen-Button oben rechts -->
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
</style>
