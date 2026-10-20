<script lang="ts">
	import { tick } from 'svelte';
	import { goto, snapshot } from '$app/navigation';
	import { page } from '$app/state';
	import * as publicEnv from '$app/env/public';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import AppIconSettings from '#lib/components/AppIconSettings.svelte';
	import SettingsToggleRow from '#lib/components/SettingsToggleRow.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import SettingsGroup from '#lib/components/SettingsGroup.svelte';
	import { t, currentLang, setLang } from '#lib/i18n.svelte';
	import { userSettings } from '#lib/userSettings.svelte';
	import { validatePasswordRule, getPasswordHint } from '#lib/password';
	import { logoutDevice, syncDevicePush } from '#lib/deviceSession';

	const PUBLIC_VAPID_KEY = publicEnv.PUBLIC_VAPID_PUBLIC_KEY ?? '';

	let { data } = $props();

	let openedGroups = $state({ general: false, visibility: false, display: false, shopping: false, notifications: false, account: false });
	snapshot({
		id: 'settings-groups',
		capture: () => ({ ...openedGroups }),
		restore: value => { openedGroups = { ...value }; }
	});
	$effect(() => {
		const hash = page.url.hash;
		const target = hash.slice(1);
		const anchors: Record<string, keyof typeof openedGroups> = {
			'schnellzugriff': 'general', 'general-title': 'general',
			'visibility-title': 'visibility', 'app-icon': 'display', 'display-title': 'display',
			'kategorien-sortieren': 'shopping', 'shopping-lists-title': 'shopping',
			'notifications-location-title': 'notifications', 'account-title': 'account'
		};
		const locationRequested = page.url.searchParams.get('expand') === 'location';
		const group = locationRequested ? 'notifications' : anchors[target];
		if (!group) return;
		openedGroups[group] = true;
		void tick().then(() => {
			if (page.url.hash !== hash) return;
			document.getElementById(locationRequested ? 'notifications-location-title' : target)?.scrollIntoView({ block: 'nearest' });
		});
	});


	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);
	let menuOpen = $state(false);
	let passwordOpen = $state(false);
	let exportOpen = $state(false);
	let exportLogs = $state(true);
	let exportCatalog = $state(true);
	let importFileInput = $state<HTMLInputElement | null>(null);
	let importing = $state(false);
	let importResult = $state<{ imported: number; skipped: string[] } | null>(null);
	let importError = $state(false);

	function parseCsvLine(line: string): string[] {
		const cells: string[] = [];
		let i = 0;
		while (i < line.length) {
			if (line[i] === '"') {
				let val = '';
				i++;
				while (i < line.length) {
					if (line[i] === '"' && line[i + 1] === '"') { val += '"'; i += 2; }
					else if (line[i] === '"') { i++; break; }
					else { val += line[i++]; }
				}
				cells.push(val);
				if (line[i] === ',') i++;
			} else {
				const end = line.indexOf(',', i);
				if (end === -1) { cells.push(line.slice(i)); break; }
				else { cells.push(line.slice(i, end)); i = end + 1; }
			}
		}
		return cells;
	}

	async function handleImport(e: Event) {
		const file = (e.target as HTMLInputElement).files?.[0];
		if (!file) return;
		importing = true;
		importResult = null;
		importError = false;
		try {
			const text = await file.text();
			const clean = text.replace(/^﻿/, '');
			const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
			if (lines.length < 2) { importError = true; return; }
			const header = parseCsvLine(lines[0]);
			const dtIdx = header.indexOf('datetime');
			const suppIdx = header.indexOf('supplement');
			const amountIdx = header.indexOf('amount');
			const noteIdx = header.indexOf('log_note');
			if (dtIdx === -1 || suppIdx === -1 || amountIdx === -1) { importError = true; return; }
			const rows = lines.slice(1).map(line => {
				const cells = parseCsvLine(line);
				const datetime = cells[dtIdx] ?? '';
				const [datePart, timePart] = datetime.split('T');
				const [year, month, day] = (datePart ?? '').split('-').map(Number);
				const [hour, minute, second] = (timePart ?? '00:00:00').split(':').map(Number);
				const loggedAt = (year && month && day)
					? new Date(year, month - 1, day, hour || 0, minute || 0, second || 0).getTime()
					: NaN;
				return {
					loggedAt,
					supplement: cells[suppIdx] ?? '',
					amount: parseFloat(cells[amountIdx] ?? '0'),
					note: noteIdx >= 0 ? (cells[noteIdx] ?? '') : ''
				};
			}).filter(r => !isNaN(r.loggedAt) && r.supplement && r.amount > 0);
			const res = await fetch('/api/supplement-logs/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ rows })
			});
			if (!res.ok) { importError = true; return; }
			importResult = await res.json();
		} catch { importError = true; }
		finally {
			importing = false;
			if (importFileInput) importFileInput.value = '';
		}
	}
	let exportFrom = $state('');
	let exportTo = $state('');
	let exportRangeMode = $state(false);
	let importHelpOpen = $state(false);

	const exportHref = $derived.by(() => {
		const params = new URLSearchParams();
		if (exportLogs) params.set('logs', '1');
		if (exportCatalog) params.set('catalog', '1');
		params.set('tz', Intl.DateTimeFormat().resolvedOptions().timeZone);
		if (exportRangeMode && exportFrom) params.set('fromDate', exportFrom);
		if (exportRangeMode && exportTo) params.set('toDate', exportTo);
		return `/api/supplement-logs/export?${params.toString()}`;
	});
	const exportFilename = $derived(
		exportLogs && exportCatalog ? 'groly-supplements.zip' :
		exportLogs ? 'supplement-logs.csv' :
		'supplement-catalog.csv'
	);
	let wakeLockOpen = $state(false);
	let sharedListsOpen = $state(false);
	let showPushPrompt = $state(false);

	// Push Notifications
	let pushSupported = $state(false);
	let pushPermission = $state<NotificationPermission>('default');
	let pushSubscribed = $state(false);
	let testNotifCooldown = $state(0); // seconds remaining
	let testNotifLoading = $state(false);
	let testNotifError = $state('');
	let cooldownInterval: ReturnType<typeof setInterval> | null = null;

	function startCooldownTimer(seconds: number) {
		testNotifCooldown = seconds;
		if (cooldownInterval) clearInterval(cooldownInterval);
		cooldownInterval = setInterval(() => {
			testNotifCooldown = Math.max(0, testNotifCooldown - 1);
			if (testNotifCooldown === 0 && cooldownInterval) {
				clearInterval(cooldownInterval);
				cooldownInterval = null;
			}
		}, 1000);
	}

	async function sendTestNotification() {
		if (testNotifCooldown > 0 || testNotifLoading) return;
		testNotifLoading = true;
		testNotifError = '';
		try {
			const res = await fetch('/api/push-test', { method: 'POST' });
			const data = await res.json();
			if (res.status === 429) {
				startCooldownTimer(data.remaining ?? 60);
			} else if (res.status === 404 && data.error === 'no_subscription') {
				testNotifError = currentLang() === 'en'
					? 'No active subscription. Please disable and re-enable push notifications.'
					: 'Keine aktive Subscription. Bitte Benachrichtigungen aus- und wieder einschalten.';
			} else if (!res.ok) {
				testNotifError = currentLang() === 'en' ? 'Failed to send.' : 'Senden fehlgeschlagen.';
			} else {
				startCooldownTimer(60);
			}
		} finally {
			testNotifLoading = false;
		}
	}
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
				// Re-register subscription silently — server record may have been deleted
				if (sub) {
					const json = sub.toJSON();
					const reRegister = () => fetch('/api/push/subscribe', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys })
					}).catch(() => {/* best-effort, ignore errors */});
					reRegister();
					window.addEventListener('online', reRegister, { once: true });
				}
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

	const mustChange = false;

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
		const pwRule = validatePasswordRule(newPassword);
		if (pwRule) {
			error = pwRule === 'too_short' ? t.password_too_short
				: pwRule === 'missing_uppercase' ? t.password_missing_uppercase
				: t.password_missing_number;
			return;
		}

		loading = true;
		try {
			const res = await fetch('/api/users/me', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ currentPassword, newPassword })
			});

			if (res.ok) {
				if (data.user?.id) void syncDevicePush(data.user.id);
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
				error = data.code === 'too_short' ? t.password_too_short
					: data.code === 'missing_uppercase' ? t.password_missing_uppercase
					: data.code === 'missing_number' ? t.password_missing_number
					: data.code === 'current_password_wrong' ? t.settings_current_password_wrong
					: data.code === 'same_password' ? t.settings_password_unchanged
					: t.settings_password_error;
			}
		} catch {
			error = t.settings_password_error;
		} finally {
			loading = false;
		}
	}
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={mustChange ? t.settings_change_password : t.settings_title} onMenuOpen={() => { if (!mustChange) menuOpen = true; }} />

	<div class="settings-content flex-1 overflow-y-auto px-4" style="padding-top: calc(env(safe-area-inset-top) + 6rem); padding-bottom: calc(env(safe-area-inset-bottom) + 6rem)">

	{#if mustChange}
		<!-- ── Fokus-Modus: Nur Passwort ändern ───────────────────────── -->
		<div class="rounded-2xl overflow-hidden mb-4 divide-y divide-white/[0.08]" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
			<div class="px-5 pb-5 pt-4">
				<div class="rounded-lg px-3 py-2 mb-4 text-xs"
				     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
					{t.must_change_password}
				</div>
				<form onsubmit={changePassword} class="space-y-2">
					{#if error}
						<div class="rounded-lg px-3 py-2 text-xs"
						     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
							{error}
						</div>
					{/if}
					{#if success}
						<div class="rounded-lg px-3 py-2 text-xs"
						     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
							{success}
						</div>
					{/if}
					<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
						<input type="password" placeholder={t.settings_current_password} bind:value={currentPassword} required
						       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface); font-size: 16px" />
					</div>
					<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
						<input type="password" placeholder={t.settings_new_password} bind:value={newPassword} required
						       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface); font-size: 16px" />
					</div>
					<div>
						<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
							<input type="password" placeholder={t.settings_confirm_password} bind:value={confirmPassword} required
							       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface); font-size: 16px" />
						</div>
						<p class="text-[10px] mt-1 px-1" style="color: var(--color-on-surface-variant)">{getPasswordHint(currentLang())}</p>
					</div>
					<button
						type="submit"
						disabled={loading}
						class="w-full py-2.5 rounded-full text-xs font-semibold mt-1 disabled:opacity-50"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>
						{loading ? '...' : t.settings_save_password}
					</button>
				</form>
			</div>
		</div>
		<div class="text-center mt-6">
			<button
				onclick={async () => { await logoutDevice(); goto('/login'); }}
				class="text-xs active:opacity-60 transition-opacity"
				style="color: var(--color-on-surface-variant)"
			>{t.nav_logout}</button>
		</div>
	{:else}

		<div class="settings-groups">
		<SettingsGroup id="general" label={t.settings_group_general} bind:open={openedGroups.general}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4v5m0 4v7M12 4v9m0 4v3M20 4v1m0 4v11M1 9h6m2 4h6m2-8h6"/></svg>{/snippet}
			<div class="settings-surface">
				<SettingsSelectRow label={t.language} value={currentLang()} options={[{ value: 'de', label: t.language_de }, { value: 'en', label: t.language_en }]} onchange={(value) => setLang(value as 'de' | 'en')}>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>{/snippet}
				</SettingsSelectRow>

				<div id="schnellzugriff">
					<a href="/einstellungen/schnellzugriff" class="settings-quick-access">
						<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="m13 2-10 12h9l-1 8 10-12h-9z" /></svg>
						<span>{t.settings_quick_access}</span>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
					</a>
				</div>

				<!-- Bildschirm anlassen -->
				<div>
					<button
						aria-expanded={wakeLockOpen}
						aria-controls="screen-on-options"
						onclick={() => wakeLockOpen = !wakeLockOpen}
						class="w-full flex items-center justify-between px-5 py-2.5"
					>
						<div class="flex items-center gap-3">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<rect x="2" y="4" width="20" height="14" rx="2" ry="2"/>
								<line x1="8" y1="22" x2="16" y2="22"/>
								<line x1="12" y1="18" x2="12" y2="22"/>
							</svg>
							<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.settings_keep_screen_on}</span>
						</div>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						     style="transform: rotate({wakeLockOpen ? 90 : 0}deg); transition: transform 0.2s">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</button>
					{#if wakeLockOpen}
						<div id="screen-on-options" class="pb-2">
							<p class="px-5 pb-2 text-xs leading-relaxed" style="color: var(--color-on-surface-variant)">{t.settings_keep_screen_on_desc}</p>
							<SettingsToggleRow label={t.settings_group_shopping_lists} checked={userSettings.wakeLockLists} onchange={() => userSettings.wakeLockLists = !userSettings.wakeLockLists} />
							<SettingsToggleRow label={t.settings_recipes_section} checked={userSettings.wakeLockRecipes} onchange={() => userSettings.wakeLockRecipes = !userSettings.wakeLockRecipes} />
							<SettingsToggleRow label={t.meditation_title} checked={userSettings.wakeLockMeditation} onchange={() => userSettings.wakeLockMeditation = !userSettings.wakeLockMeditation} />
						</div>
					{/if}
				</div>
			</div>
		</SettingsGroup>

		<SettingsGroup id="visibility" label={t.settings_group_visibility} bind:open={openedGroups.visibility}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>{/snippet}
			<div class="settings-surface">
				<SettingsToggleRow
					label={t.settings_recipes_section}
					description={t.settings_recipes_tab_desc}
					checked={userSettings.showRecipes}
					onchange={() => { userSettings.showRecipes = !userSettings.showRecipes; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>{/snippet}
				</SettingsToggleRow>

				<SettingsToggleRow
					label={t.settings_supplement_section}
					description={t.settings_supplement_tab_desc}
					checked={userSettings.showSupplementTracker}
					onchange={() => { userSettings.showSupplementTracker = !userSettings.showSupplementTracker; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/><line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/></svg>{/snippet}
				</SettingsToggleRow>

				<SettingsToggleRow
					label={t.settings_show_greeting}
					description={t.settings_greeting_desc}
					checked={userSettings.greetingEnabled}
					onchange={() => { userSettings.greetingEnabled = !userSettings.greetingEnabled; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>{/snippet}
				</SettingsToggleRow>
			</div>
		</SettingsGroup>

		<SettingsGroup id="display" label={t.settings_group_display} bind:open={openedGroups.display}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>{/snippet}
			<div class="settings-surface">
				<SettingsSelectRow label={t.theme} value={userSettings.theme} options={[{ value: 'system', label: t.theme_system }, { value: 'light', label: t.theme_light }, { value: 'dark', label: t.theme_dark }]} onchange={(value) => userSettings.theme = value as typeof userSettings.theme}>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>{/snippet}
				</SettingsSelectRow>
				<SettingsSelectRow label={t.color_scheme} value={userSettings.colorScheme} options={[{ value: 'forest', label: t.color_scheme_forest }, { value: 'classic', label: t.color_scheme_classic }, { value: 'indigo', label: t.color_scheme_indigo }]} onchange={(value) => userSettings.colorScheme = value as typeof userSettings.colorScheme}>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="10.5" r="2.5"/><circle cx="8.5" cy="7.5" r="2.5"/><circle cx="6.5" cy="12.5" r="2.5"/><path d="M12 22a10 10 0 1 1 0-20 5 5 0 0 1 5 5c0 1.5-.5 2.5-1.5 3.5S14 12 14 13.5s.5 2.5 1.5 3.5c1 1 1.5 2 1.5 3.5a2 2 0 0 1-5 1.5z"/></svg>{/snippet}
					{#snippet preview()}<span class="h-3 w-3 rounded-full" style="background: {userSettings.colorScheme === 'forest' ? '#2E7D32' : userSettings.colorScheme === 'classic' ? '#006c54' : '#535CBA'}"></span>{/snippet}
					{#snippet optionPreview(value: string)}<span class="h-3 w-3 rounded-full" style="background: {value === 'forest' ? '#2E7D32' : value === 'classic' ? '#006c54' : '#535CBA'}"></span>{/snippet}
				</SettingsSelectRow>
				<AppIconSettings currentIcon={data.appIcon} />
			</div>
		</SettingsGroup>

		<SettingsGroup id="shopping-lists" label={t.settings_group_shopping_lists} bind:open={openedGroups.shopping}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M9 5V3h6v2m-6 6h6m-6 4h6m-6 4h3"/></svg>{/snippet}
			<div class="settings-surface">
				<SettingsToggleRow
					label={t.settings_layout_section}
					description={t.settings_list_view_summary}
					checked={userSettings.itemLayout === 'list'}
					onchange={() => { userSettings.itemLayout = userSettings.itemLayout === 'list' ? 'grid' : 'list'; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>{/snippet}
				</SettingsToggleRow>

				<div id="kategorien-sortieren">
					<div class="settings-category-header">
						<a class="settings-category-open" href="/einstellungen/kategorien">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>
							<span class="settings-category-label">{t.settings_category_sorting}</span>
							<span class="settings-category-affordance" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6" /></svg></span>
						</a>
						<button type="button" role="switch" aria-checked={userSettings.categorySortEnabled} aria-label={t.settings_category_sorting} class="settings-category-switch" onclick={() => userSettings.categorySortEnabled = !userSettings.categorySortEnabled}>
							<span class="h-5 w-10 rounded-full border" style="border-color: {userSettings.categorySortEnabled ? 'var(--color-primary)' : 'var(--color-outline-variant)'}; background-color: {userSettings.categorySortEnabled ? 'var(--color-primary)' : 'var(--color-surface-container)'}" aria-hidden="true"></span>
						</button>
					</div>
				</div>

				<SettingsToggleRow
					label={t.settings_favorite_indicator}
					description={t.settings_favorite_indicator_desc}
					checked={userSettings.showFavoriteIndicator}
					onchange={() => { userSettings.showFavoriteIndicator = !userSettings.showFavoriteIndicator; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>{/snippet}
				</SettingsToggleRow>

				<SettingsToggleRow
					label={t.settings_show_all_checked_section}
					description={t.settings_checked_items_summary}
					checked={userSettings.showAllCheckedItems}
					onchange={() => { userSettings.showAllCheckedItems = !userSettings.showAllCheckedItems; }}
				>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>{/snippet}
				</SettingsToggleRow>
			</div>
		</SettingsGroup>

		<SettingsGroup id="notifications-location" label={t.settings_group_notifications_location} bind:open={openedGroups.notifications}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M10 21h4"/></svg>{/snippet}
			<div class="settings-surface">

				<SettingsToggleRow label={t.settings_location_detection} infoInitiallyOpen={page.url.searchParams.get('expand') === 'location'} description={t.settings_location_description} checked={userSettings.locationNavEnabled} onchange={() => userSettings.locationNavEnabled = !userSettings.locationNavEnabled}>
					{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>{/snippet}
				</SettingsToggleRow>

				{#if pushSupported}
					<div>
						<SettingsToggleRow label={t.settings_push_notifications} description={t.settings_push_description} checked={pushSubscribed} disabled={pushLoading || pushPermission === 'denied'} onchange={() => { if (!pushLoading) void (pushSubscribed ? unsubscribePush() : subscribePush()); }}>
							{#snippet icon()}<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>{/snippet}
						</SettingsToggleRow>
						{#if pushPermission === 'denied'}<p class="settings-inline-status" style="color: var(--color-error)">{t.settings_push_blocked}</p>{/if}
						<div class="settings-push-actions">
								{#if pushSubscribed}
									<button
										onclick={sendTestNotification}
										disabled={testNotifCooldown > 0 || testNotifLoading}
										class="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium active:opacity-70 disabled:opacity-40 transition-opacity"
										style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
									>
										<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
										</svg>
										{#if testNotifLoading}
											{currentLang() === 'en' ? 'Sending…' : 'Wird gesendet…'}
										{:else if testNotifCooldown > 0}
											{currentLang() === 'en' ? `Wait ${testNotifCooldown}s` : `Warten (${testNotifCooldown}s)`}
										{:else}
											{currentLang() === 'en' ? 'Send test notification' : 'Test-Benachrichtigung senden'}
										{/if}
									</button>
								{/if}
						</div>
						{#if pushError}<p class="settings-inline-status" style="color: var(--color-error)">{pushError}</p>{/if}
						{#if testNotifError}<p class="settings-inline-status" style="color: var(--color-error)">{testNotifError}</p>{/if}
					</div>
				{/if}

				<!-- Geteilte Listen -->
				<div>
					<button
						onclick={() => sharedListsOpen = !sharedListsOpen}
						class="w-full flex items-center justify-between px-5 py-2.5"
					>
						<div class="flex items-center gap-3">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
							<span class="font-medium text-sm" style="color: var(--color-on-surface)">{currentLang() === 'en' ? 'Shared with me' : 'Geteilte Listen'}</span>
						</div>
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
								<div class="settings-shared-lists">
									{#each sharedLists as sl (sl.id)}
										<div class="settings-shared-row flex items-center gap-3 py-2.5">
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
			</div>
		</SettingsGroup>

		<SettingsGroup id="account" label={t.settings_group_account} bind:open={openedGroups.account}>
			{#snippet icon()}<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v2"/></svg>{/snippet}
			<div class="settings-surface">

				<!-- Daten exportieren & importieren -->
				<div>
					<button
						onclick={() => { exportOpen = !exportOpen; importResult = null; importError = false; }}
						class="w-full flex items-center justify-between px-5 py-2.5"
					>
						<div class="flex items-center gap-3">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
							</svg>
							<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.supplement_data_title}</span>
						</div>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						     style="transform: rotate({exportOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</button>
					{#if exportOpen}
						<div class="px-5 pb-4 space-y-4">
							<!-- Export -->
							<div class="space-y-2">
								<p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.supplement_export_title}</p>
								<p class="text-sm leading-relaxed" style="color: var(--color-on-surface-variant)">{t.supplement_export_desc}</p>
								<div class="flex items-center justify-between">
									<span class="text-sm" style="color: var(--color-on-surface)">{t.supplement_export_logs}</span>
									<div
										role="switch"
										aria-checked={exportLogs}
										onclick={() => exportLogs = !exportLogs}
										onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') exportLogs = !exportLogs; }}
										tabindex="0"
										class="relative w-10 h-5 rounded-full overflow-hidden transition-colors flex-shrink-0"
										style="background-color: {exportLogs ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
									>
									</div>
								</div>
								<div class="flex items-center justify-between">
									<span class="text-sm" style="color: var(--color-on-surface)">{t.supplement_export_catalog}</span>
									<div
										role="switch"
										aria-checked={exportCatalog}
										onclick={() => exportCatalog = !exportCatalog}
										onkeydown={(e) => { if (e.key === ' ' || e.key === 'Enter') exportCatalog = !exportCatalog; }}
										tabindex="0"
										class="relative w-10 h-5 rounded-full overflow-hidden transition-colors flex-shrink-0"
										style="background-color: {exportCatalog ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
									>
									</div>
								</div>
								<!-- Zeitraum Toggle -->
								{#if exportLogs}
									<div class="rounded-xl overflow-hidden p-1 flex gap-1" style="background-color: var(--color-surface-container)">
										<button
											onclick={() => exportRangeMode = false}
											class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
											style="background-color: {!exportRangeMode ? 'var(--color-surface-high)' : 'transparent'}; color: {!exportRangeMode ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
										>{currentLang() === 'en' ? 'Complete' : 'Komplett'}</button>
										<button
											onclick={() => exportRangeMode = true}
											class="flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors"
											style="background-color: {exportRangeMode ? 'var(--color-surface-high)' : 'transparent'}; color: {exportRangeMode ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)'}"
										>{currentLang() === 'en' ? 'Date range' : 'Zeitraum'}</button>
									</div>
									{#if exportRangeMode}
										<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
											<div class="flex">
												<div class="flex-1 px-3 py-2 flex flex-col gap-0.5">
													<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{currentLang() === 'en' ? 'From' : 'Von'}</span>
													<input
														type="date"
														bind:value={exportFrom}
														class="border-0 outline-none w-full"
														style="background: transparent; color: var(--color-on-surface); font-size: 16px; padding: 0"
													/>
												</div>
												<div class="flex-1 px-3 py-2 flex flex-col gap-0.5" style="border-left: 1px solid var(--color-surface-high)">
													<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{currentLang() === 'en' ? 'To' : 'Bis'}</span>
													<input
														type="date"
														bind:value={exportTo}
														class="border-0 outline-none w-full"
														style="background: transparent; color: var(--color-on-surface); font-size: 16px; padding: 0"
													/>
												</div>
											</div>
										</div>
									{/if}
								{/if}
								{#if exportLogs || exportCatalog}
									<a
										href={exportHref}
										download={exportFilename}
										class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity"
										style="background-color: var(--color-surface-container); color: var(--color-primary)"
									>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
										</svg>
										{t.supplement_export_btn}
									</a>
								{/if}
							</div>

							<!-- Import -->
							<div class="space-y-3">
								<p class="text-xs font-semibold uppercase tracking-wide" style="color: var(--color-on-surface-variant)">{t.supplement_import_title}</p>

								<!-- Hilfe-Akkordeon -->
								<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
									<button
										onclick={() => importHelpOpen = !importHelpOpen}
										class="w-full flex items-center justify-between px-3 py-2.5 active:opacity-70"
									>
										<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{currentLang() === 'en' ? 'Format & hints' : 'Format & Hinweise'}</span>
										<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
										     style="transform: rotate({importHelpOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
											<polyline points="9 18 15 12 9 6"/>
										</svg>
									</button>
									{#if importHelpOpen}
										<div class="px-3 pb-3 space-y-2">
											<p class="text-xs leading-relaxed" style="color: var(--color-on-surface-variant)">
												{currentLang() === 'en'
													? 'The CSV must have these columns. Times are interpreted in your device timezone. Supplements that don\'t exist in your list will be skipped — create them first.'
													: 'Die CSV muss folgende Spalten haben. Uhrzeiten werden in der Gerätezeitzone interpretiert. Supplements die nicht in deiner Liste existieren werden übersprungen — lege sie vorher an.'}
											</p>
											<div class="rounded-lg px-3 py-2 overflow-x-auto" style="background-color: var(--color-surface-high)">
												<pre class="text-xs" style="color: var(--color-primary); font-family: monospace; white-space: pre">datetime,supplement,brand,amount,unit,log_note
	2026-04-28T07:15:00,Vitamin C,,1000,mg,Mit Frühstück
	2026-04-28T08:00:00,Magnesium,Brand,400,mg,</pre>
											</div>
											<p class="text-xs" style="color: var(--color-on-surface-variant)">
												{currentLang() === 'en'
													? 'brand and log_note are optional.'
													: 'brand und log_note sind optional.'}
											</p>
										</div>
									{/if}
								</div>

								<input
									bind:this={importFileInput}
									type="file"
									accept=".csv"
									onchange={handleImport}
									class="hidden"
								/>
								<button
									onclick={() => importFileInput?.click()}
									disabled={importing}
									class="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold active:opacity-70 transition-opacity disabled:opacity-50"
									style="background-color: var(--color-surface-container); color: var(--color-primary)"
								>
									<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
									</svg>
									{importing ? '…' : t.supplement_import_btn}
								</button>
								{#if importError}
									<p class="text-sm" style="color: var(--color-error)">{t.supplement_import_error}</p>
								{/if}
								{#if importResult}
									<p class="text-sm font-semibold" style="color: var(--color-primary)">{importResult.imported} {importResult.imported === 1 ? 'Eintrag' : 'Einträge'} importiert</p>
									{#if importResult.skipped.length > 0}
										<div>
											<p class="text-xs font-medium mb-1" style="color: var(--color-on-surface-variant)">{t.supplement_import_skipped}</p>
											<p class="text-xs" style="color: var(--color-on-surface-variant)">{importResult.skipped.join(', ')}</p>
										</div>
									{/if}
								{/if}
							</div>
						</div>
					{/if}
				</div>

				<!-- Passwort ändern -->
				<div>
					<button
						onclick={() => passwordOpen = !passwordOpen}
						class="w-full flex items-center justify-between px-5 py-2.5"
					>
						<div class="flex items-center gap-3">
							<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
							<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.settings_change_password}</span>
						</div>
						<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
						     style="transform: rotate({passwordOpen ? 90 : 0}deg); transition: transform 0.2s; flex-shrink: 0">
							<polyline points="9 18 15 12 9 6"/>
						</svg>
					</button>
					{#if passwordOpen}
						<div class="px-5 pb-4">
							{#if mustChange}
								<div class="rounded-lg px-3 py-2 mb-2 text-xs"
								     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
									{t.must_change_password}
								</div>
							{/if}
							<form onsubmit={changePassword} class="space-y-2">
								{#if error}
									<div class="rounded-lg px-3 py-2 text-xs"
									     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
										{error}
									</div>
								{/if}
								{#if success}
									<div class="rounded-lg px-3 py-2 text-xs"
									     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
										{success}
									</div>
								{/if}
								<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
									<input type="password" placeholder={t.settings_current_password} bind:value={currentPassword} required
									       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface)" />
								</div>
								<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
									<input type="password" placeholder={t.settings_new_password} bind:value={newPassword} required
									       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface)" />
								</div>
								<div>
									<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
										<input type="password" placeholder={t.settings_confirm_password} bind:value={confirmPassword} required
										       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface)" />
									</div>
									<p class="text-[10px] mt-1 px-1" style="color: var(--color-on-surface-variant)">{getPasswordHint(currentLang())}</p>
								</div>
								<button
									type="submit"
									disabled={loading}
									class="w-full py-2.5 rounded-full text-xs font-semibold mt-1 disabled:opacity-50"
									style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
								>
									{loading ? '...' : t.settings_save_password}
								</button>
							</form>
						</div>
					{/if}
				</div>


			</div>
		</SettingsGroup>

		</div>
	{/if}<!-- end mustChange else -->

	</div>
</div>

{#if showPushPrompt}
	<!-- Backdrop -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={dismissPushPrompt}></div>

	<!-- Sheet -->
	<div class="fixed left-0 right-0 bottom-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
	     style="background-color: var(--modal-bg)">
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

<AppBottomNav activeTab="none" />

<HamburgerMenu bind:open={menuOpen} user={data.user} />


<style>
	.settings-quick-access { display: flex; align-items: center; gap: 12px; min-height: 44px; padding: 0 20px; font-size: 14px; font-weight: 550; color: var(--color-on-surface); }
	.settings-quick-access span { flex: 1; }
	.settings-quick-access svg { flex: none; }
	.settings-quick-access:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-category-header { display: flex; align-items: center; padding: 0 18px 0 20px; }
	.settings-category-open { display: flex; flex: 1; align-items: center; gap: 12px; min-width: 0; min-height: 44px; text-align: left; font-size: 14px; font-weight: 550; color: var(--color-on-surface); }
	.settings-category-open > svg { flex: none; color: var(--color-on-surface-variant); }
	.settings-category-open:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-category-label { flex: 1; }
	.settings-category-affordance { display: flex; align-items: center; justify-content: center; width: 40px; flex: none; color: var(--color-on-surface-variant); }
	.settings-category-switch { display: flex; align-items: center; justify-content: center; width: 44px; min-height: 44px; flex: none; }
	.settings-shared-row + .settings-shared-row { border-top: 1px solid var(--bubble-container-border); }
	.settings-inline-status { margin: 0; padding: 0 20px 8px; font-size: 12px; line-height: 1.5; }
	.settings-push-actions { padding: 0 20px; }
	.settings-push-actions:has(button) { padding-bottom: 10px; }
	.settings-content { scroll-padding-top: calc(env(safe-area-inset-top) + 6rem); }
	.settings-groups { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.settings-surface {
		overflow: hidden;
		border: 0;
		border-radius: 0;
		background: transparent;
	}
	.settings-surface > :global(* + *) { border-top: 1px solid var(--bubble-container-border); }
	.settings-surface :global(button.w-full) { min-height: 44px; gap: 12px; text-align: left; }
	.settings-surface :global(button > .flex.items-center.gap-3:first-child) { min-width: 0; }
	.settings-surface :global(button > .flex > svg),
	.settings-surface :global(button > svg:first-child) { flex-shrink: 0; stroke: var(--color-on-surface-variant); }
	.settings-surface :global(button:focus-visible) { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 12px; }
	.settings-surface :global([id]) { scroll-margin-top: 12px; }
</style>
