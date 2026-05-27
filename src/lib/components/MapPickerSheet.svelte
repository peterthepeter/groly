<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { t } from '$lib/i18n.svelte';

	let {
		open = $bindable<boolean>(false),
		initialLat = null as number | null,
		initialLng = null as number | null,
		initialName = null as string | null,
		onConfirm
	}: {
		open: boolean;
		initialLat?: number | null;
		initialLng?: number | null;
		initialName?: string | null;
		onConfirm: (lat: number, lng: number, displayName: string) => void;
	} = $props();

	let mapEl = $state<HTMLDivElement | null>(null);
	let map: any = null;
	let L: any = null;
	let lReady = $state(false);
	let marker: any = null;
	let resolvedAddress = $state('');
	let resolving = $state(false);
	let pickedLat = $state<number | null>(null);
	let pickedLng = $state<number | null>(null);
	let geocodeTimer: ReturnType<typeof setTimeout> | null = null;

	// Primary color for the pin icon (matches app primary)
	const PIN_COLOR = '#2E7D32';

	onMount(async () => {
		const mod = await import('leaflet');
		L = mod.default ?? mod;
		lReady = true;
	});

	$effect(() => {
		if (open && lReady && mapEl && !map) {
			initMap();
		}
		if (!open) {
			destroyMap();
		}
	});

	function makePinIcon() {
		return L.divIcon({
			html: `<svg width="32" height="48" viewBox="0 0 32 48" fill="none" style="filter:drop-shadow(0 2px 4px rgba(0,0,0,0.35))">
				<path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 32 16 32S32 28 32 16C32 7.163 24.837 0 16 0z" fill="${PIN_COLOR}"/>
				<circle cx="16" cy="16" r="7" fill="white"/>
			</svg>`,
			className: '',
			iconSize: [32, 48],
			iconAnchor: [16, 48]
		});
	}

	async function initMap() {
		const lat = initialLat ?? 51.1657;
		const lng = initialLng ?? 10.4515;
		const zoom = initialLat ? 16 : 6;

		map = L.map(mapEl, { zoomControl: false, attributionControl: false }).setView([lat, lng], zoom);

		L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
			maxZoom: 19
		}).addTo(map);

		L.control.zoom({ position: 'bottomright' }).addTo(map);
		L.control.attribution({
			position: 'bottomleft',
			prefix: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>'
		}).addTo(map);

		// Place existing pin immediately when editing — preserve the previous
		// human-readable address so a confirm without tapping the map doesn't
		// overwrite locationName with the raw lat,lng fallback.
		if (initialLat && initialLng) {
			placePin(initialLat, initialLng, false);
			if (initialName) resolvedAddress = initialName;
		}

		map.on('click', (e: any) => {
			placePin(e.latlng.lat, e.latlng.lng, true);
		});

		// Fly to GPS in background — only when no initial coords
		if (!initialLat) {
			flyToGps();
		}
	}

	async function flyToGps() {
		if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
		try {
			const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
				navigator.geolocation.getCurrentPosition(resolve, reject, {
					timeout: 10000,
					maximumAge: 60000,
					enableHighAccuracy: false
				})
			);
			if (map) {
				map.flyTo([pos.coords.latitude, pos.coords.longitude], 14, { animate: true, duration: 1 });
			}
		} catch { /* ignore — user stays at default */ }
	}

	function placePin(lat: number, lng: number, geocode: boolean) {
		if (marker) marker.remove();
		marker = L.marker([lat, lng], { icon: makePinIcon() }).addTo(map);
		pickedLat = lat;
		pickedLng = lng;
		if (geocode) {
			scheduleGeocode(lat, lng);
		}
	}

	function destroyMap() {
		if (geocodeTimer) { clearTimeout(geocodeTimer); geocodeTimer = null; }
		if (map) { map.remove(); map = null; }
		marker = null;
		pickedLat = null;
		pickedLng = null;
		resolvedAddress = '';
		resolving = false;
	}

	function scheduleGeocode(lat: number, lng: number) {
		if (geocodeTimer) clearTimeout(geocodeTimer);
		resolving = true;
		resolvedAddress = '';
		geocodeTimer = setTimeout(async () => {
			try {
				const res = await fetch(`/api/geocode?lat=${lat}&lng=${lng}`);
				if (res.ok) {
					const data = await res.json();
					resolvedAddress = data.display_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
				}
			} catch { /* ignore */ }
			resolving = false;
		}, 600);
	}

	function confirm() {
		if (pickedLat === null || pickedLng === null) return;
		onConfirm(pickedLat, pickedLng, resolvedAddress || `${pickedLat.toFixed(5)}, ${pickedLng.toFixed(5)}`);
		open = false;
	}

	onDestroy(destroyMap);
</script>

{#if open}
	<div class="fixed inset-0 z-[80] flex flex-col" style="background-color: var(--color-surface)">

		<!-- Header -->
		<div
			class="flex items-center gap-3 px-4 flex-shrink-0"
			style="padding-top: calc(env(safe-area-inset-top) + 0.75rem); padding-bottom: 0.75rem; background-color: var(--color-surface)"
		>
			<button
				onclick={() => open = false}
				class="w-9 h-9 flex items-center justify-center rounded-full active:opacity-60"
				style="background-color: var(--bubble-interactive-bg); border: 1px solid var(--bubble-interactive-border); color: var(--color-on-surface)"
				aria-label="Abbrechen"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
			<p class="text-base font-semibold" style="color: var(--color-on-surface)">{t.map_picker_title}</p>
		</div>

		<!-- Map (tap to place pin) -->
		<div class="relative flex-1 overflow-hidden">
			<div bind:this={mapEl} class="absolute inset-0"></div>
		</div>

		<!-- Bottom panel -->
		<div
			class="flex-shrink-0 px-4 pt-3"
			style="padding-bottom: calc(env(safe-area-inset-bottom) + 1rem); background-color: var(--color-surface)"
		>
			<!-- Address / hint -->
			<div
				class="rounded-xl px-3 py-2.5 mb-3 min-h-[44px] flex items-center gap-2"
				style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)"
			>
				{#if resolving}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-on-surface-variant); animation: spin 1s linear infinite; flex-shrink:0">
						<path d="M21 12a9 9 0 1 1-6.219-8.56"/>
					</svg>
					<span class="text-sm" style="color: var(--color-on-surface-variant)">…</span>
				{:else if resolvedAddress}
					<span class="text-sm leading-relaxed" style="color: var(--color-on-surface)">{resolvedAddress}</span>
				{:else}
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--color-on-surface-variant); flex-shrink:0">
						<circle cx="12" cy="10" r="3"/><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
					</svg>
					<span class="text-sm" style="color: var(--color-on-surface-variant)">{t.map_picker_hint}</span>
				{/if}
			</div>

			<!-- Confirm -->
			<button
				onclick={confirm}
				disabled={pickedLat === null}
				class="w-full py-3.5 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-40 transition-opacity"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{t.map_picker_confirm}
			</button>
		</div>
	</div>
{/if}
