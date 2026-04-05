<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { env as publicEnv } from '$env/dynamic/public';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t, currentLang, setLang } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { CATEGORY_LABELS } from '$lib/categories';
	import { validatePassword, PASSWORD_HINT } from '$lib/password';
	import { shortcuts, type Shortcut, type ShortcutAction } from '$lib/shortcuts.svelte';

	const PUBLIC_VAPID_KEY = publicEnv.PUBLIC_VAPID_PUBLIC_KEY ?? '';

	let { data } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);
	let menuOpen = $state(false);
	let passwordOpen = $state(false);
	let langOpen = $state(false);
	let categorySortOpen = $state(false);
	let layoutOpen = $state(false);
	let pushOpen = $state(false);
	let sharedListsOpen = $state(false);
	let showPushPrompt = $state(false);

	// Push Notifications
	let pushSupported = $state(false);
	let pushPermission = $state<NotificationPermission>('default');
	let pushSubscribed = $state(false);
	let pushLoading = $state(false);
	let pushError = $state('');

	async function initPushState() {
		if (typeof window === 'undefined') return;
		pushSupported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
		if (!pushSupported) return;
		pushPermission = Notification.permission;
		if (pushPermission === 'granted') {
			try {
				const reg = await navigator.serviceWorker.ready;
				const sub = await reg.pushManager.getSubscription();
				pushSubscribed = !!sub;
			} catch { /* ignore on init */ }
		}
	}

	async function subscribePush() {
		pushLoading = true;
		pushError = '';
		if (!PUBLIC_VAPID_KEY) {
			pushError = 'Push-Konfiguration fehlt (PUBLIC_VAPID_PUBLIC_KEY nicht gesetzt).';
			pushLoading = false;
			return;
		}
		try {
			const perm = await Notification.requestPermission();
			pushPermission = perm;
			if (perm !== 'granted') { pushLoading = false; return; }

			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.subscribe({
				userVisibleOnly: true,
				applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
			});
			const json = sub.toJSON();
			await fetch('/api/push/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
			});
			pushSubscribed = true;
		} catch (e) {
			pushError = e instanceof Error ? e.message : String(e);
		}
		pushLoading = false;
	}

	async function unsubscribePush() {
		pushLoading = true;
		pushError = '';
		try {
			const reg = await navigator.serviceWorker.ready;
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				await fetch('/api/push/subscribe', {
					method: 'DELETE',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint: sub.endpoint })
				});
				await sub.unsubscribe();
			}
			pushSubscribed = false;
		} catch (e) {
			pushError = e instanceof Error ? e.message : String(e);
		}
		pushLoading = false;
	}

	function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
		const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
		const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
		const rawData = atob(base64);
		const buffer = new ArrayBuffer(rawData.length);
		const view = new Uint8Array(buffer);
		for (let i = 0; i < rawData.length; i++) view[i] = rawData.charCodeAt(i);
		return view;
	}

	$effect(() => { initPushState(); });
	$effect(() => { if (shortcutsOpen) void loadAllLists(); });

	const mustChange = $derived($page.url.searchParams.get('mustChange') === '1');
	$effect(() => { if (mustChange) passwordOpen = true; });

	type SharedList = { id: string; name: string; ownerUsername: string | null };
	let sharedLists = $state<SharedList[]>([]);

	async function loadSharedLists() {
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) return;
			const json = await res.json();
			const all = json?.lists ?? json;
			sharedLists = all.filter((l: { isOwner: boolean }) => !l.isOwner);
		} catch { /* ignore */ }
	}

	async function leaveList(listId: string) {
		if (!data.user?.id) return;
		const res = await fetch(`/api/lists/${listId}/members/${data.user.id}`, { method: 'DELETE' });
		if (res.ok) sharedLists = sharedLists.filter(l => l.id !== listId);
	}

	// ── Shortcuts ──────────────────────────────────────────────────────────────
	let shortcutsOpen = $state($page.url.searchParams.get('expand') === 'shortcuts');
	let locationOpen = $state($page.url.searchParams.get('expand') === 'location');
	let allLists = $state<{ id: string; name: string }[]>([]);
	let allListsLoaded = $state(false);

	type ShortcutDraft = { name: string; listId: string; action: ShortcutAction };
	let editingId = $state<string | null>(null);   // null = adding new
	let showShortcutForm = $state(false);
	let draft = $state<ShortcutDraft>({ name: '', listId: '', action: 'go' });

	async function loadAllLists() {
		if (allListsLoaded) return;
		try {
			const res = await fetch('/api/lists');
			if (!res.ok) return;
			const json = await res.json();
			const raw = json?.lists ?? json;
			allLists = raw.map((l: { id: string; name: string }) => ({ id: l.id, name: l.name }));
			allListsLoaded = true;
			if (!draft.listId && allLists.length > 0) draft.listId = allLists[0].id;
		} catch { /* ignore */ }
	}

	function openShortcutsSection() {
		shortcutsOpen = !shortcutsOpen;
		if (shortcutsOpen) void loadAllLists();
	}

	// Ensure draft.listId is set once allLists loads (async race condition fix)
	$effect(() => {
		if (showShortcutForm && allLists.length > 0 && !draft.listId) {
			draft.listId = allLists[0].id;
		}
	});

	function startAdd() {
		editingId = null;
		draft = { name: '', listId: allLists[0]?.id ?? '', action: 'go' };
		showShortcutForm = true;
	}

	function startEdit(sc: Shortcut) {
		editingId = sc.id;
		draft = { name: sc.name, listId: sc.listId, action: sc.action };
		showShortcutForm = true;
	}

	function cancelShortcutForm() {
		showShortcutForm = false;
		editingId = null;
	}

	function generateId(): string {
		// crypto.randomUUID() is only available in secure contexts (HTTPS/localhost).
		// Use a simple fallback that works on plain HTTP (local dev via IP).
		if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
			return crypto.randomUUID();
		}
		return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
	}

	function saveShortcut() {
		if (!draft.name.trim() || !draft.listId) return;
		const listName = allLists.find(l => l.id === draft.listId)?.name ?? '';
		if (editingId) {
			shortcuts.update(editingId, { name: draft.name.trim(), listId: draft.listId, listName, action: draft.action });
		} else {
			shortcuts.add({ id: generateId(), name: draft.name.trim(), listId: draft.listId, listName, action: draft.action });
		}
		showShortcutForm = false;
		editingId = null;
	}

	function actionLabel(action: ShortcutAction): string {
		if (currentLang() === 'en') {
			return action === 'scanner' ? 'Scanner' : action === 'add' ? 'Add item' : 'Open';
		}
		return action === 'scanner' ? 'Scanner' : action === 'add' ? 'Artikel hinzufügen' : 'Öffnen';
	}

	$effect(() => { loadSharedLists(); });

	async function acceptPushPrompt() {
		await subscribePush();
		goto('/');
	}

	function dismissPushPrompt() {
		showPushPrompt = false;
		goto('/');
	}

	async function changePassword(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		success = '';

		if (newPassword !== confirmPassword) {
			error = t.settings_passwords_no_match;
			return;
		}
		const pwError = validatePassword(newPassword);
		if (pwError) {
			error = pwError;
			return;
		}

		loading = true;
		const res = await fetch('/api/users/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentPassword, newPassword })
		});

		if (res.ok) {
			success = t.settings_password_success;
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			if (mustChange) {
				if (pushSupported && !pushSubscribed) {
					showPushPrompt = true;
				} else {
					setTimeout(() => goto('/'), 1500);
				}
			}
		} else {
			const data = await res.json();
			error = data.error ?? t.settings_password_error;
		}
		loading = false;
	}
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.settings_title} onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pb-8 px-4" style="padding-top: calc(env(safe-area-inset-top) + 6rem)">
		<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => passwordOpen = !passwordOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">{t.settings_change_password}</h2>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				     style="transform: rotate({passwordOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>

			{#if passwordOpen}
				<div class="px-5 pb-5">
					{#if mustChange}
						<div class="rounded-xl px-4 py-3 mb-3 text-sm"
						     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
							{t.must_change_password}
						</div>
					{/if}
					<form onsubmit={changePassword} class="space-y-3">
						{#if error}
							<div class="rounded-xl px-4 py-3 text-xs"
							     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
								{error}
							</div>
						{/if}
						{#if success}
							<div class="rounded-xl px-4 py-3 text-xs"
							     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
								{success}
							</div>
						{/if}

						<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
							<input type="password" placeholder={t.settings_current_password} bind:value={currentPassword} required
							       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
						</div>
						<div>
							<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
								<input type="password" placeholder={t.settings_new_password} bind:value={newPassword} required
								       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
							</div>
							<p class="text-[11px] mt-1.5 px-1" style="color: var(--color-on-surface-variant)">{PASSWORD_HINT}</p>
						</div>
						<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
							<input type="password" placeholder={t.settings_confirm_password} bind:value={confirmPassword} required
							       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
						</div>

						<button
							type="submit"
							disabled={loading}
							class="w-full py-3.5 rounded-full text-sm font-semibold mt-2 disabled:opacity-50"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
						>
							{loading ? '...' : t.settings_save_password}
						</button>
					</form>
				</div>
			{/if}
		</div>

		<!-- Language Toggle -->
		<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => langOpen = !langOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">{t.language}</h2>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				     style="transform: rotate({langOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>

			{#if langOpen}
				<div class="px-5 pb-5">
					<div class="flex gap-2">
						<button
							onclick={() => setLang('de')}
							class="flex-1 py-3 rounded-full text-sm font-semibold transition-opacity"
							style="background-color: {currentLang() === 'de' ? 'var(--color-primary)' : 'var(--color-surface-container)'}; color: {currentLang() === 'de' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
						>
							{t.language_de}
						</button>
						<button
							onclick={() => setLang('en')}
							class="flex-1 py-3 rounded-full text-sm font-semibold transition-opacity"
							style="background-color: {currentLang() === 'en' ? 'var(--color-primary)' : 'var(--color-surface-container)'}; color: {currentLang() === 'en' ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
						>
							{t.language_en}
						</button>
					</div>
				</div>
			{/if}
		</div>

		<!-- Geteilte Listen (zugeklappt) -->
		<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => sharedListsOpen = !sharedListsOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<span class="text-base font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Shared with me' : 'Geteilte Listen'}
				</span>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)"
				     stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				     style="transform: rotate({sharedListsOpen ? 90 : 0}deg); transition: transform 0.2s">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>
			{#if sharedListsOpen}
				<div class="px-5 pb-5">
					{#if sharedLists.length === 0}
						<p class="text-sm" style="color: var(--color-on-surface-variant)">
							{currentLang() === 'en' ? 'No lists shared with you.' : 'Keine Listen mit dir geteilt.'}
						</p>
					{:else}
						<div class="space-y-2">
							{#each sharedLists as sl (sl.id)}
								<div class="flex items-center gap-3 rounded-xl px-3 py-2.5"
								     style="background-color: var(--color-surface-container)">
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{sl.name}</div>
										{#if sl.ownerUsername}
											<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{sl.ownerUsername}</div>
										{/if}
									</div>
									<button
										onclick={() => leaveList(sl.id)}
										class="text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0"
										style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
									>
										{currentLang() === 'en' ? 'Leave' : 'Verlassen'}
									</button>
								</div>
							{/each}
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Listen-Ansicht -->
		<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => layoutOpen = !layoutOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">{t.settings_layout_section}</h2>
				<div class="flex items-center gap-3">
					<!-- Toggle — auch im eingeklappten Zustand sichtbar -->
					<div
						role="switch"
						aria-checked={userSettings.itemLayout === 'list'}
						onclick={(e) => { e.stopPropagation(); userSettings.itemLayout = userSettings.itemLayout === 'list' ? 'grid' : 'list'; }}
						onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); userSettings.itemLayout = userSettings.itemLayout === 'list' ? 'grid' : 'list'; } }}
						tabindex="0"
						class="relative w-12 h-6 rounded-full overflow-hidden transition-colors flex-shrink-0"
						style="background-color: {userSettings.itemLayout === 'list' ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
					>
						{#if userSettings.itemLayout === 'list'}
							<span class="absolute top-0.5 h-5 w-5 rounded-full"
							      style="background-color: white; transform: translateX(1.625rem)"></span>
						{/if}
					</div>
					<!-- Chevron -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({layoutOpen ? 90 : 0}deg); transition: transform 0.2s">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</div>
			</button>

			{#if layoutOpen}
				<div class="px-5 pb-5">
					<p class="text-sm leading-relaxed" style="color: var(--color-on-surface-variant)">{t.settings_layout_list_view_desc}</p>
				</div>
			{/if}
		</div>

		<!-- Kategorie-Sortierung -->
		<div id="kategorien-sortieren" class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => categorySortOpen = !categorySortOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Category sorting' : 'Kategorien sortieren'}
				</h2>
				<div class="flex items-center gap-3">
					<!-- Toggle -->
					<div
						role="switch"
						aria-checked={userSettings.categorySortEnabled}
						onclick={(e) => { e.stopPropagation(); userSettings.categorySortEnabled = !userSettings.categorySortEnabled; }}
						onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); userSettings.categorySortEnabled = !userSettings.categorySortEnabled; } }}
						tabindex="0"
						class="relative w-12 h-6 rounded-full overflow-hidden transition-colors flex-shrink-0"
						style="background-color: {userSettings.categorySortEnabled ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
					>
						{#if userSettings.categorySortEnabled}
							<span class="absolute top-0.5 h-5 w-5 rounded-full"
							      style="background-color: white; transform: translateX(1.625rem)"></span>
						{/if}
					</div>
					<!-- Chevron -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({categorySortOpen ? 90 : 0}deg); transition: transform 0.2s">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</div>
			</button>

			{#if categorySortOpen && userSettings.categorySortEnabled}
				<div class="px-5 pb-5">
					<p class="text-xs mb-4" style="color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? 'First category appears at the bottom of the grid.'
							: 'Erste Kategorie erscheint unten im Raster.'}
					</p>
					<div class="space-y-1.5">
						{#each userSettings.categoryOrder as key, i}
							<div class="flex items-center gap-3 rounded-xl px-3 py-2.5"
							     style="background-color: var(--color-surface-container)">
								<span class="flex-1 text-sm font-medium" style="color: var(--color-on-surface)">
									{i + 1}. {CATEGORY_LABELS[key]?.[currentLang()] ?? key}
								</span>
								<button
									onclick={() => userSettings.moveUp(i)}
									disabled={i === 0}
									aria-label="Nach oben"
									class="p-1 rounded-lg disabled:opacity-20"
									style="color: var(--color-on-surface-variant)"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="18 15 12 9 6 15"/>
									</svg>
								</button>
								<button
									onclick={() => userSettings.moveDown(i)}
									disabled={i === userSettings.categoryOrder.length - 1}
									aria-label="Nach unten"
									class="p-1 rounded-lg disabled:opacity-20"
									style="color: var(--color-on-surface-variant)"
								>
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="6 9 12 15 18 9"/>
									</svg>
								</button>
							</div>
						{/each}
					</div>
				</div>
			{:else if categorySortOpen && !userSettings.categorySortEnabled}
				<div class="px-5 pb-5">
					<p class="text-xs" style="color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? 'Enable the toggle above to configure category order.'
							: 'Aktiviere den Schalter oben, um die Kategoriereihenfolge festzulegen.'}
					</p>
				</div>
			{/if}
		</div>

		<!-- Schnellzugriff (Shortcuts) -->
		<div id="schnellzugriff" class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={openShortcutsSection}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Quick access' : 'Schnellzugriff'}
				</h2>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				     style="transform: rotate({shortcutsOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</button>

			{#if shortcutsOpen}
				<div class="px-5 pb-5">
					<p class="text-xs mb-4" style="color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? 'Long-press the + button to access up to 4 shortcuts.'
							: 'Lange auf den + Button drücken um bis zu 4 Schnellzugriffe zu öffnen.'}
					</p>

					<!-- Existing shortcuts -->
					{#if shortcuts.list.length > 0}
						<div class="space-y-2 mb-3">
							{#each shortcuts.list as sc (sc.id)}
								<div class="flex items-center gap-2 rounded-xl px-3 py-2.5"
								     style="background-color: var(--color-surface-container)">
									<!-- Action icon -->
									<div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
									     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent)">
										{#if sc.action === 'scanner'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<path d="M3 9V6a2 2 0 0 1 2-2h2"/>
												<path d="M3 15v3a2 2 0 0 0 2 2h2"/>
												<path d="M21 9V6a2 2 0 0 0-2-2h-2"/>
												<path d="M21 15v3a2 2 0 0 1-2 2h-2"/>
												<line x1="10" y1="9" x2="10" y2="15"/>
												<line x1="13" y1="9" x2="13" y2="15"/>
												<line x1="16" y1="9" x2="16" y2="15"/>
											</svg>
										{:else if sc.action === 'add'}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round">
												<line x1="12" y1="5" x2="12" y2="19"/>
												<line x1="5" y1="12" x2="19" y2="12"/>
											</svg>
										{:else}
											<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="9 18 15 12 9 6"/>
											</svg>
										{/if}
									</div>
									<!-- Info -->
									<div class="flex-1 min-w-0">
										<div class="text-sm font-medium truncate" style="color: var(--color-on-surface)">{sc.name}</div>
										<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">
											{sc.listName} · {actionLabel(sc.action)}
										</div>
									</div>
									<!-- Edit -->
									<button
										onclick={() => startEdit(sc)}
										class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60"
										style="color: var(--color-on-surface-variant)"
										aria-label="Bearbeiten"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
											<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
										</svg>
									</button>
									<!-- Delete -->
									<button
										onclick={() => shortcuts.remove(sc.id)}
										class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 active:opacity-60"
										style="color: var(--color-error)"
										aria-label="Löschen"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
											<line x1="18" y1="6" x2="6" y2="18"/>
											<line x1="6" y1="6" x2="18" y2="18"/>
										</svg>
									</button>
								</div>
							{/each}
						</div>
					{/if}

					<!-- Shortcut edit/add form -->
					{#if showShortcutForm}
						<div class="rounded-xl px-4 py-4 mb-3 space-y-3"
						     style="background-color: var(--color-surface-container)">
							<!-- Name -->
							<input
								type="text"
								placeholder={currentLang() === 'en' ? 'Shortcut name' : 'Name des Schnellzugriffs'}
								bind:value={draft.name}
								class="w-full rounded-xl px-4 py-3 text-base outline-none"
								style="background-color: var(--color-surface-card); color: var(--color-on-surface)"
							/>

							<!-- List picker -->
							{#if allLists.length > 0}
								<div class="rounded-xl px-4 py-3" style="background-color: var(--color-surface-card)">
									<select
										bind:value={draft.listId}
										class="w-full bg-transparent outline-none text-sm"
										style="color: var(--color-on-surface)"
									>
										{#each allLists as l (l.id)}
											<option value={l.id}>{l.name}</option>
										{/each}
									</select>
								</div>
							{/if}

							<!-- Action picker -->
							<div class="flex gap-2">
								{#each (['go', 'add', 'scanner'] as ShortcutAction[]) as action}
									<button
										onclick={() => draft.action = action}
										class="flex-1 py-2.5 rounded-full text-xs font-semibold transition-colors"
										style="background-color: {draft.action === action ? 'var(--color-primary)' : 'var(--color-surface-card)'}; color: {draft.action === action ? 'var(--color-on-primary)' : 'var(--color-on-surface-variant)'}"
									>
										{actionLabel(action)}
									</button>
								{/each}
							</div>

							<!-- Save / Cancel -->
							<div class="flex gap-2">
								<button
									onclick={cancelShortcutForm}
									class="flex-1 py-3 rounded-full text-sm font-semibold"
									style="background-color: var(--color-surface-high); color: var(--color-on-surface-variant)"
								>
									{t.list_cancel}
								</button>
								<button
									onclick={saveShortcut}
									disabled={!draft.name.trim() || !draft.listId}
									class="flex-1 py-3 rounded-full text-sm font-semibold disabled:opacity-40"
									style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
								>
									{t.list_save}
								</button>
							</div>
						</div>
					{:else if shortcuts.list.length < 4}
						<button
							onclick={startAdd}
							class="w-full py-3 rounded-full text-sm font-semibold flex items-center justify-center gap-2"
							style="background-color: var(--color-surface-container); color: var(--color-primary)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
								<line x1="12" y1="5" x2="12" y2="19"/>
								<line x1="5" y1="12" x2="19" y2="12"/>
							</svg>
							{currentLang() === 'en' ? 'Add shortcut' : 'Schnellzugriff hinzufügen'}
						</button>
					{/if}
				</div>
			{/if}
		</div>

		<!-- Standorterkennung -->
		<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
			<button
				onclick={() => locationOpen = !locationOpen}
				class="w-full flex items-center justify-between px-5 py-5"
			>
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Location detection' : 'Standorterkennung'}
				</h2>
				<div class="flex items-center gap-3">
					<!-- Toggle -->
					<div
						role="switch"
						aria-checked={userSettings.locationNavEnabled}
						onclick={(e) => { e.stopPropagation(); userSettings.locationNavEnabled = !userSettings.locationNavEnabled; }}
						onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.stopPropagation(); userSettings.locationNavEnabled = !userSettings.locationNavEnabled; } }}
						tabindex="0"
						class="relative w-12 h-6 rounded-full overflow-hidden transition-colors flex-shrink-0"
						style="background-color: {userSettings.locationNavEnabled ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
					>
						{#if userSettings.locationNavEnabled}
							<span class="absolute top-0.5 h-5 w-5 rounded-full"
							      style="background-color: white; transform: translateX(1.625rem)"></span>
						{/if}
					</div>
					<!-- Chevron -->
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
					     style="transform: rotate({locationOpen ? 90 : 0}deg); transition: transform 0.2s">
						<polyline points="9 18 15 12 9 6"/>
					</svg>
				</div>
			</button>

			{#if locationOpen}
				<div class="px-5 pb-5">
					<p class="text-xs mb-3 leading-relaxed" style="color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? 'Automatically opens a list when you open the app at a saved location (within 100 m). Works when resuming from background too.'
							: 'Öffnet eine Liste automatisch, wenn du die App an einem gespeicherten Standort öffnest (innerhalb von 100 m). Funktioniert auch beim Wechsel aus dem Hintergrund.'}
					</p>
					<div class="rounded-xl px-4 py-3 text-xs leading-relaxed mb-2"
					     style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? '🔒 Your GPS location never leaves your device. Only the search query is sent to OpenStreetMap once during setup — not linked to your identity.'
							: '🔒 Dein GPS-Standort verlässt nie dein Gerät. Nur der Suchbegriff wird einmalig beim Einrichten an OpenStreetMap gesendet – ohne Verbindung zu deiner Identität.'}
					</div>
					<p class="text-xs px-1" style="color: var(--color-on-surface-variant)">
						{currentLang() === 'en'
							? 'Set a location per list: long-press a list → Edit.'
							: 'Standort pro Liste: langer Druck auf eine Liste → Bearbeiten.'}
					</p>
				</div>
			{/if}
		</div>

		<!-- Push Notifications -->
		{#if pushSupported}
			<div class="rounded-2xl mb-3 overflow-hidden" style="background-color: var(--color-surface-card)">
				<button
					onclick={() => pushOpen = !pushOpen}
					class="w-full flex items-center justify-between px-5 py-5"
				>
					<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
						{currentLang() === 'en' ? 'Push Notifications' : 'Push-Benachrichtigungen'}
					</h2>
					<div class="flex items-center gap-3">
						{#if pushPermission === 'denied'}
							<span class="text-xs" style="color: var(--color-error)">
								{currentLang() === 'en' ? 'Blocked' : 'Blockiert'}
							</span>
						{:else}
							<div
								role="switch"
								aria-checked={pushSubscribed}
								aria-disabled={pushLoading}
								onclick={(e) => { e.stopPropagation(); if (!pushLoading) pushSubscribed ? unsubscribePush() : subscribePush(); }}
								onkeydown={(e) => { if ((e.key === ' ' || e.key === 'Enter') && !pushLoading) { e.stopPropagation(); pushSubscribed ? unsubscribePush() : subscribePush(); } }}
								tabindex="0"
								class="relative w-12 h-6 rounded-full overflow-hidden transition-colors flex-shrink-0"
								style="background-color: {pushSubscribed ? 'var(--color-primary)' : 'var(--color-surface-container)'}; opacity: {pushLoading ? 0.5 : 1}"
							>
								{#if pushSubscribed}
									<span class="absolute top-0.5 h-5 w-5 rounded-full"
									      style="background-color: white; transform: translateX(1.625rem)"></span>
								{/if}
							</div>
						{/if}
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						     style="transform: rotate({pushOpen ? 90 : 0}deg); transition: transform 0.2s">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</div>
				</button>

				{#if pushOpen}
					<div class="px-5 pb-5">
						<p class="text-sm leading-relaxed" style="color: var(--color-on-surface-variant)">
							{currentLang() === 'en'
								? 'Receive notifications when other users add or change items in a shared list.'
								: 'Erhalte Benachrichtigungen, wenn andere Nutzer Items in einer geteilten Liste hinzufügen oder ändern.'}
						</p>
						{#if pushError}
							<p class="text-xs mt-3" style="color: var(--color-error)">{pushError}</p>
						{/if}
					</div>
				{/if}
			</div>
		{/if}

		{#if data.user?.role === 'admin'}
			<a href="/einstellungen/users"
			   class="flex items-center gap-4 px-4 py-4 rounded-2xl mt-3 transition-colors active:opacity-70"
			   style="background-color: var(--color-surface-card)">
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<line x1="23" y1="11" x2="17" y2="11"/>
					<line x1="20" y1="8" x2="20" y2="14"/>
				</svg>
				<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.admin_users_title}</span>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</a>
		{/if}
	</div>
</div>

{#if showPushPrompt}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={dismissPushPrompt}></div>

	<!-- Sheet -->
	<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
	     style="background-color: var(--color-surface-low)">
		<div class="flex justify-center mb-5">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>

		<div class="flex flex-col items-center text-center mb-6">
			<div class="mb-4 p-3 rounded-2xl" style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent)">
				<svg width="32" height="32" viewBox="0 0 24 24" fill="none"
				     stroke="var(--color-primary)" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
					<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
					<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
				</svg>
			</div>
			<h2 class="text-lg font-bold mb-2" style="color: var(--color-on-surface)">Push-Benachrichtigungen</h2>
			<p class="text-sm leading-relaxed" style="color: var(--color-on-surface-variant)">
				Bleib auf dem Laufenden wenn Mitglieder Artikel hinzufügen.
			</p>
		</div>

		<div class="flex gap-3">
			<button
				onclick={dismissPushPrompt}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>
				Später
			</button>
			<button
				onclick={acceptPushPrompt}
				disabled={pushLoading}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-50"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{pushLoading ? '...' : 'Aktivieren'}
			</button>
		</div>
	</div>
{/if}

<HamburgerMenu bind:open={menuOpen} user={data.user} />
