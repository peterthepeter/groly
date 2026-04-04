<script lang="ts">
	import { t, currentLang } from '$lib/i18n.svelte';
	import IconPicker from '$lib/components/IconPicker.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { CATEGORY_LABELS, DEFAULT_CATEGORY_ORDER } from '$lib/categories';

	let { list = null, onSave, onDelete = null, onShare = null, onClose, memberCount = 0 }: {
		list?: { id: string; name: string; description: string | null; iconId?: string | null; locationLat?: number | null; locationLng?: number | null; locationName?: string | null } | null;
		onSave: (name: string, description: string, iconId: string | null, shareAfterCreate?: boolean, locationLat?: number | null, locationLng?: number | null, locationName?: string | null) => void;
		onDelete?: (() => void) | null;
		onShare?: (() => void) | null;
		onClose: () => void;
		memberCount?: number;
	} = $props();

	// svelte-ignore state_referenced_locally
	let name = $state(list?.name ?? '');
	// svelte-ignore state_referenced_locally
	let description = $state(list?.description ?? '');
	// svelte-ignore state_referenced_locally
	let selectedIconId = $state<string | null>(list?.iconId ?? 'supermarkt');
	let bottomOffset = $state(0);
	let notificationsEnabled = $state(true);
	let notifLoading = $state(false);
	let shareAfterCreate = $state(false);
	let categorySortOpen = $state(false);

	// Location state
	// svelte-ignore state_referenced_locally
	let locationLat = $state<number | null>(list?.locationLat ?? null);
	// svelte-ignore state_referenced_locally
	let locationLng = $state<number | null>(list?.locationLng ?? null);
	// svelte-ignore state_referenced_locally
	let locationName = $state<string | null>(list?.locationName ?? null);
	let locationQuery = $state('');
	let locationResults = $state<{ display_name: string; lat: string; lon: string }[]>([]);
	let locationSearching = $state(false);
	let locationError = $state('');
	let locationOpen = $state(false);

	const listLocationDisabled = $derived(list?.id ? userSettings.isListLocationDisabled(list.id) : false);

	let locationGpsLoading = $state(false);

	async function searchLocation() {
		if (!locationQuery.trim()) return;
		locationSearching = true;
		locationError = '';
		locationResults = [];
		try {
			const res = await fetch(`/api/geocode?q=${encodeURIComponent(locationQuery.trim())}`);
			const data = await res.json();
			if (Array.isArray(data)) {
				locationResults = data.slice(0, 5);
			} else {
				locationError = currentLang() === 'en' ? 'No results found.' : 'Keine Ergebnisse gefunden.';
			}
		} catch {
			locationError = currentLang() === 'en' ? 'Search failed.' : 'Suche fehlgeschlagen.';
		}
		locationSearching = false;
	}

	async function useCurrentLocation() {
		if (!('geolocation' in navigator)) {
			locationError = currentLang() === 'en' ? 'Geolocation not supported.' : 'Standort nicht verfügbar.';
			return;
		}
		locationGpsLoading = true;
		locationError = '';
		navigator.geolocation.getCurrentPosition(async (pos) => {
			const { latitude, longitude } = pos.coords;
			try {
				const res = await fetch(`/api/geocode?lat=${latitude}&lng=${longitude}`);
				const data = await res.json();
				locationLat = latitude;
				locationLng = longitude;
				locationName = data.display_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
				locationResults = [];
			} catch {
				locationLat = latitude;
				locationLng = longitude;
				locationName = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
			}
			locationGpsLoading = false;
		}, () => {
			locationError = currentLang() === 'en' ? 'Location access denied.' : 'Standortzugriff verweigert.';
			locationGpsLoading = false;
		}, { timeout: 8000, maximumAge: 30000 });
	}

	function selectLocation(result: { display_name: string; lat: string; lon: string }) {
		locationLat = parseFloat(result.lat);
		locationLng = parseFloat(result.lon);
		locationName = result.display_name;
		locationResults = [];
		locationQuery = '';
	}

	function clearLocation() {
		locationLat = null;
		locationLng = null;
		locationName = null;
		locationResults = [];
		locationQuery = '';
	}

	function toggleListLocationDisabled() {
		if (!list?.id) return;
		userSettings.setListLocationDisabled(list.id, !listLocationDisabled);
	}

	const listCatSettings = $derived(list?.id ? userSettings.getListCategorySettings(list.id) : null);

	function enableCustomSort() {
		if (!list?.id) return;
		userSettings.setListCategorySettings(list.id, {
			enabled: userSettings.categorySortEnabled,
			order: [...userSettings.categoryOrder]
		});
	}

	function resetToGlobal() {
		if (!list?.id) return;
		userSettings.clearListCategorySettings(list.id);
	}

	function toggleListSortEnabled() {
		if (!list?.id || !listCatSettings) return;
		userSettings.setListCategorySettings(list.id, { ...listCatSettings, enabled: !listCatSettings.enabled });
	}

	// Notification-Präferenz laden wenn Liste besteht und geteilt ist
	$effect(() => {
		if (list?.id && memberCount > 0) {
			fetch(`/api/lists/${list.id}/notifications`)
				.then(r => r.json())
				.then(d => { notificationsEnabled = d.enabled ?? true; })
				.catch(() => {});
		}
	});

	async function toggleNotifications() {
		if (!list?.id || notifLoading) return;
		notifLoading = true;
		const next = !notificationsEnabled;
		await fetch(`/api/lists/${list.id}/notifications`, {
			method: 'PUT',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ enabled: next })
		}).catch(() => {});
		notificationsEnabled = next;
		notifLoading = false;
	}

	$effect(() => {
		const vv = window.visualViewport;
		if (!vv) return;
		function update() {
			bottomOffset = Math.max(0, window.innerHeight - vv!.height - vv!.offsetTop);
		}
		vv.addEventListener('resize', update);
		vv.addEventListener('scroll', update);
		update();
		return () => {
			vv.removeEventListener('resize', update);
			vv.removeEventListener('scroll', update);
		};
	});

</script>

<!-- Backdrop -->
<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)"
     onclick={onClose}></div>

<!-- Modal -->
<div class="fixed left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
     style="background-color: var(--color-surface-low); bottom: {bottomOffset}px">
	<div class="flex justify-center mb-4">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<div class="flex items-center justify-between mb-5">
		<h2 class="text-lg font-bold" style="color: var(--color-on-surface)">{list ? t.list_edit_title : t.list_create_title}</h2>
		{#if list && onShare}
			<button
				onclick={onShare}
				class="p-2 rounded-xl active:opacity-60"
				style="color: var(--color-primary)"
				aria-label="Liste teilen"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<line x1="19" y1="8" x2="19" y2="14"/>
					<line x1="22" y1="11" x2="16" y2="11"/>
				</svg>
			</button>
		{/if}
	</div>

	<div class="space-y-3 mb-3">
		<!-- Teilen nach Erstellen Toggle (nur beim Erstellen) -->
		{#if !list}
			<button
				type="button"
				onclick={() => shareAfterCreate = !shareAfterCreate}
				class="w-full flex items-center gap-3 px-4 rounded-xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); height: 52px"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
				     stroke={shareAfterCreate ? 'var(--color-primary)' : 'var(--color-outline)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
					<polyline points="16 6 12 2 8 6"/>
					<line x1="12" y1="2" x2="12" y2="15"/>
				</svg>
				<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Share after creating' : 'Nach Erstellen teilen'}
				</span>
				<div class="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
				     style="background-color: {shareAfterCreate ? 'var(--color-primary)' : 'var(--color-surface-high)'}">
					<div class="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
					     style="background-color: white; left: {shareAfterCreate ? '1.25rem' : '0.125rem'}"></div>
				</div>
			</button>
		{/if}

		<!-- Notification Toggle (nur bei geteilten Listen) -->
		{#if list && memberCount > 0}
			<button
				type="button"
				onclick={toggleNotifications}
				disabled={notifLoading}
				class="w-full flex items-center gap-3 px-4 rounded-xl active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); height: 52px"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
				     stroke={notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					{#if notificationsEnabled}
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					{:else}
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
						<line x1="1" y1="1" x2="23" y2="23"/>
					{/if}
				</svg>
				<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">Benachrichtigungen</span>
				<span class="text-xs font-medium" style="color: {notificationsEnabled ? 'var(--color-primary)' : 'var(--color-outline)'}">
					{notificationsEnabled ? 'An' : 'Aus'}
				</span>
			</button>
		{/if}

		<!-- Standorterkennung (nur beim Bearbeiten) -->
		{#if list && userSettings.locationNavEnabled}
			<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
				<!-- Header -->
				<button
					type="button"
					onclick={() => locationOpen = !locationOpen}
					class="w-full flex items-center gap-3 px-4 active:opacity-70 transition-opacity"
					style="height: 52px"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
					     stroke={locationLat !== null ? 'var(--color-primary)' : 'var(--color-outline)'}
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
						<circle cx="12" cy="10" r="3"/>
					</svg>
					<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
						{currentLang() === 'en' ? 'Location' : 'Standort'}
					</span>
					<span class="text-xs font-medium mr-1"
					      style="color: {locationLat !== null ? 'var(--color-primary)' : 'var(--color-outline)'}">
						{locationLat !== null
							? (currentLang() === 'en' ? 'Set' : 'Gesetzt')
							: (currentLang() === 'en' ? 'None' : 'Keiner')}
					</span>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({locationOpen ? 180 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
						<polyline points="6 9 12 15 18 9"/>
					</svg>
				</button>

				{#if locationOpen}
					<div class="px-4 pb-4">
						<!-- Current location display -->
						{#if locationLat !== null && locationName}
							<div class="rounded-xl px-3 py-2.5 mb-3 flex items-start gap-2"
							     style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent)">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
								     stroke="var(--color-primary)" stroke-width="2"
								     stroke-linecap="round" stroke-linejoin="round" class="flex-shrink-0 mt-0.5">
									<polyline points="20 6 9 17 4 12"/>
								</svg>
								<span class="text-xs leading-relaxed flex-1"
								      style="color: var(--color-primary)">{locationName}</span>
								<button type="button" onclick={clearLocation} aria-label="Standort entfernen"
								        class="flex-shrink-0 p-0.5 rounded active:opacity-60"
								        style="color: var(--color-outline)">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"/>
										<line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
								</button>
							</div>
						{:else if locationLat !== null}
							<div class="rounded-xl px-3 py-2 mb-3 flex items-center justify-between"
							     style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent)">
								<span class="text-xs" style="color: var(--color-primary)">
									{locationLat.toFixed(4)}, {locationLng?.toFixed(4)}
								</span>
								<button type="button" onclick={clearLocation} aria-label="Standort entfernen"
								        class="p-0.5 rounded active:opacity-60" style="color: var(--color-outline)">
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
									     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<line x1="18" y1="6" x2="6" y2="18"/>
										<line x1="6" y1="6" x2="18" y2="18"/>
									</svg>
								</button>
							</div>
						{/if}

						<!-- Search input -->
						<div class="flex gap-2 mb-2">
							<div class="flex-1 rounded-xl px-3 flex items-center"
							     style="background-color: var(--color-surface-low); height: 40px">
								<input
									type="text"
									placeholder={currentLang() === 'en' ? 'Search address…' : 'Adresse suchen…'}
									bind:value={locationQuery}
									onkeydown={(e) => e.key === 'Enter' && searchLocation()}
									class="w-full bg-transparent outline-none text-xs"
									style="color: var(--color-on-surface); font-size: 16px"
								/>
							</div>
							<button
								type="button"
								onclick={searchLocation}
								disabled={locationSearching || !locationQuery.trim()}
								class="px-3 rounded-xl text-xs font-semibold disabled:opacity-40 transition-opacity active:opacity-70"
								style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); height: 40px; white-space: nowrap"
							>
								{locationSearching ? '…' : (currentLang() === 'en' ? 'Search' : 'Suchen')}
							</button>
							<!-- GPS Button -->
							<button
								type="button"
								onclick={useCurrentLocation}
								disabled={locationGpsLoading}
								aria-label={currentLang() === 'en' ? 'Use current location' : 'Aktuellen Standort verwenden'}
								class="rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity active:opacity-70 flex-shrink-0"
								style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary); width: 40px; height: 40px"
							>
								{#if locationGpsLoading}
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite">
										<path d="M21 12a9 9 0 1 1-6.219-8.56"/>
									</svg>
								{:else}
									<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="12" cy="12" r="3"/>
										<line x1="12" y1="2" x2="12" y2="5"/>
										<line x1="12" y1="19" x2="12" y2="22"/>
										<line x1="2" y1="12" x2="5" y2="12"/>
										<line x1="19" y1="12" x2="22" y2="12"/>
									</svg>
								{/if}
							</button>
						</div>

						<!-- Error -->
						{#if locationError}
							<p class="text-xs mb-2" style="color: var(--color-error)">{locationError}</p>
						{/if}

						<!-- Results -->
						{#if locationResults.length > 0}
							<div class="space-y-1 mb-2">
								{#each locationResults as result}
									<button
										type="button"
										onclick={() => selectLocation(result)}
										class="w-full text-left rounded-xl px-3 py-2.5 active:opacity-70 transition-opacity"
										style="background-color: var(--color-surface-low)"
									>
										<span class="text-xs leading-relaxed line-clamp-2"
										      style="color: var(--color-on-surface)">{result.display_name}</span>
									</button>
								{/each}
							</div>
						{/if}

						<!-- Auto-open toggle (only when coords set) -->
						{#if locationLat !== null}
							<button
								type="button"
								onclick={toggleListLocationDisabled}
								class="w-full flex items-center gap-3 mt-2 active:opacity-70 transition-opacity"
							>
								<span class="flex-1 text-xs text-left" style="color: var(--color-on-surface-variant)">
									{currentLang() === 'en' ? 'Auto-open this list' : 'Liste automatisch öffnen'}
								</span>
								<div class="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
								     style="background-color: {!listLocationDisabled ? 'var(--color-primary)' : 'var(--color-surface-high)'}">
									<div class="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
									     style="background-color: white; left: {!listLocationDisabled ? '1.25rem' : '0.125rem'}"></div>
								</div>
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Kategorie-Sortierung (nur beim Bearbeiten) -->
		{#if list}
			<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
				<!-- Header / Toggle -->
				<button
					type="button"
					onclick={() => categorySortOpen = !categorySortOpen}
					class="w-full flex items-center gap-3 px-4 active:opacity-70 transition-opacity"
					style="height: 52px"
				>
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none"
					     stroke="var(--color-primary)"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<line x1="8" y1="6" x2="21" y2="6"/>
						<line x1="8" y1="12" x2="21" y2="12"/>
						<line x1="8" y1="18" x2="21" y2="18"/>
						<line x1="3" y1="6" x2="3.01" y2="6"/>
						<line x1="3" y1="12" x2="3.01" y2="12"/>
						<line x1="3" y1="18" x2="3.01" y2="18"/>
					</svg>
					<span class="flex-1 text-sm text-left" style="color: var(--color-on-surface)">
						{currentLang() === 'en' ? 'Category sorting' : 'Kategorien sortieren'}
					</span>
					<span class="text-xs font-medium mr-1" style="color: {listCatSettings ? 'var(--color-primary)' : 'var(--color-outline)'}">
						{listCatSettings
							? (currentLang() === 'en' ? 'Custom' : 'Angepasst')
							: (currentLang() === 'en' ? 'Automatic' : 'Automatisch')}
					</span>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
					     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({categorySortOpen ? 180 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
						<polyline points="6 9 12 15 18 9"/>
					</svg>
				</button>

				{#if categorySortOpen}
					<div class="px-4 pb-4">
						{#if !listCatSettings}
							<!-- Auto mode -->
							<p class="text-xs mb-3" style="color: var(--color-on-surface-variant)">
								{currentLang() === 'en'
									? 'Uses the global setting from preferences.'
									: 'Verwendet die globale Einstellung aus den Einstellungen.'}
							</p>
							<button
								type="button"
								onclick={enableCustomSort}
								class="w-full py-2.5 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
								style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)"
							>
								{currentLang() === 'en' ? 'Customise for this list' : 'Für diese Liste anpassen'}
							</button>
						{:else}
							<!-- Custom mode: enabled toggle -->
							<button
								type="button"
								onclick={toggleListSortEnabled}
								class="w-full flex items-center gap-3 mb-3 active:opacity-70 transition-opacity"
							>
								<span class="flex-1 text-xs text-left" style="color: var(--color-on-surface-variant)">
									{currentLang() === 'en' ? 'Sort by category' : 'Nach Kategorie sortieren'}
								</span>
								<div class="relative w-10 h-6 rounded-full transition-colors flex-shrink-0"
								     style="background-color: {listCatSettings.enabled ? 'var(--color-primary)' : 'var(--color-surface-high)'}">
									<div class="absolute top-0.5 w-5 h-5 rounded-full transition-transform shadow-sm"
									     style="background-color: white; left: {listCatSettings.enabled ? '1.25rem' : '0.125rem'}"></div>
								</div>
							</button>

							{#if listCatSettings.enabled}
								<p class="text-xs mb-2" style="color: var(--color-on-surface-variant)">
									{currentLang() === 'en'
										? 'First category appears at the bottom of the grid.'
										: 'Erste Kategorie erscheint unten im Raster.'}
								</p>
								<!-- Scrollable category list -->
								<div class="space-y-1 mb-3 overflow-y-auto" style="max-height: 220px">
									{#each listCatSettings.order as key, i}
										<div class="flex items-center gap-2 rounded-xl px-3 py-2"
										     style="background-color: var(--color-surface-low)">
											<span class="flex-1 text-xs font-medium" style="color: var(--color-on-surface)">
												{i + 1}. {CATEGORY_LABELS[key]?.[currentLang()] ?? key}
											</span>
											<button
												type="button"
												onclick={() => list && userSettings.moveListCategoryUp(list.id, i)}
												disabled={i === 0}
												aria-label="Nach oben"
												class="p-1 rounded-lg disabled:opacity-20"
												style="color: var(--color-on-surface-variant)"
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
													<polyline points="18 15 12 9 6 15"/>
												</svg>
											</button>
											<button
												type="button"
												onclick={() => list && userSettings.moveListCategoryDown(list.id, i)}
												disabled={i === listCatSettings.order.length - 1}
												aria-label="Nach unten"
												class="p-1 rounded-lg disabled:opacity-20"
												style="color: var(--color-on-surface-variant)"
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
													<polyline points="6 9 12 15 18 9"/>
												</svg>
											</button>
										</div>
									{/each}
								</div>
							{/if}

							<!-- Reset to global -->
							<button
								type="button"
								onclick={resetToGlobal}
								class="w-full py-2 rounded-xl text-xs font-medium active:opacity-70 transition-opacity"
								style="background-color: color-mix(in srgb, var(--color-outline) 12%, transparent); color: var(--color-on-surface-variant)"
							>
								{currentLang() === 'en' ? 'Reset to global setting' : 'Auf globale Einstellung zurücksetzen'}
							</button>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Icon Picker -->
		<IconPicker {selectedIconId} {name} onSelect={(id) => selectedIconId = id} />

		<div class="rounded-xl px-4 flex items-center" style="background-color: var(--color-surface-container); height: 52px">
			<input
				type="text"
				placeholder={t.list_description_placeholder}
				bind:value={description}
				class="w-full bg-transparent outline-none text-base"
				style="color: var(--color-on-surface); font-size: 16px"
			/>
		</div>

		<div class="rounded-xl px-4 flex items-center" style="background-color: var(--color-surface-container); height: 52px">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				placeholder={t.list_name_label}
				bind:value={name}
				autofocus
				onfocus={(e) => { const el = e.target as HTMLInputElement; setTimeout(() => el.setSelectionRange(el.value.length, el.value.length), 0); }}
				class="w-full bg-transparent outline-none text-base font-medium"
				style="color: var(--color-on-surface); font-size: 16px"
			/>
		</div>
	</div>

	<div class="flex gap-3">
		{#if list && onDelete}
			<button
				onclick={() => { if (confirm(t.confirm_delete_list)) { onDelete!(); onClose(); } }}
				class="px-4 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
			>
				{t.list_delete}
			</button>
		{/if}
		<button
			onclick={onClose}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold"
			style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
		>
			{t.list_cancel}
		</button>
		<button
			onclick={() => name.trim() && onSave(name.trim(), description.trim(), selectedIconId, shareAfterCreate, locationLat, locationLng, locationName)}
			disabled={!name.trim()}
			class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
			style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
		>
			{list ? t.list_save : t.create}
		</button>
	</div>
</div>
