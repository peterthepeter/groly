<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { validatePassword, getPasswordHint } from '$lib/password';

	let { data } = $props();

	// ── Accordion state ──────────────────────────────────────────────────────────
	let usersOpen = $state(false);
	let catalogOpen = $state(false);
	let menuOpen = $state(false);

	// ── User management ──────────────────────────────────────────────────────────
	type UserEntry = {
		id: string; username: string; role: string;
		createdAt: number; lastLoginAt: number | null;
		listCount: number; itemCount: number; recipeCount: number;
	};

	let users = $state<UserEntry[]>([]);
	let showCreateForm = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let newRole = $state<'user' | 'admin'>('user');
	let userError = $state('');
	let createdCredentials = $state<{ username: string; password: string } | null>(null);
	let copyFeedback = $state(false);
	let canShare = $state(false);
	let editUser = $state<UserEntry | null>(null);
	let editPassword = $state('');
	let editError = $state('');
	let editSuccess = $state('');

	const bootstrapId = $derived(
		users.length > 0 ? [...users].sort((a, b) => a.createdAt - b.createdAt)[0].id : null
	);
	const adminCount = $derived(users.filter(u => u.role === 'admin').length);

	function canDelete(user: UserEntry): boolean {
		if (user.id === data.user?.id) return false;
		if (user.id === bootstrapId) return false;
		if (user.role === 'admin' && adminCount <= 1) return false;
		return true;
	}

	function generatePassword(): string {
		const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
		return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
	}

	function formatLastLogin(ts: number | null): string {
		if (!ts) return 'Noch nie eingeloggt';
		const diff = Math.floor(Date.now() / 1000) - ts;
		if (diff < 60) return 'gerade eben';
		if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`;
		if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`;
		if (diff < 172800) return 'gestern';
		if (diff < 604800) return `vor ${Math.floor(diff / 86400)} Tagen`;
		if (diff < 2592000) return `vor ${Math.floor(diff / 604800)} Wo.`;
		return `vor ${Math.floor(diff / 2592000)} Mon.`;
	}

	async function loadUsers() {
		const res = await fetch('/api/users');
		if (res.ok) users = await res.json();
	}

	async function createUser(e: SubmitEvent) {
		e.preventDefault();
		userError = '';
		const usernameToCreate = newUsername.trim();
		const passwordToCreate = newPassword;
		const res = await fetch('/api/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: usernameToCreate, password: passwordToCreate, role: newRole })
		});
		if (res.ok) {
			createdCredentials = { username: usernameToCreate, password: passwordToCreate };
			newUsername = '';
			newPassword = '';
			newRole = 'user';
			showCreateForm = false;
			loadUsers();
		} else {
			const d = await res.json();
			userError = d.error ?? 'Fehler';
		}
	}

	function buildMessage1(): string {
		if (!createdCredentials) return '';
		const url = `${window.location.origin}/login?u=${encodeURIComponent(createdCredentials.username)}`;
		return `Hallo ${createdCredentials.username},\n\nhier sind deine Groly-Zugangsdaten:\n${url}\n\nBenutzername: ${createdCredentials.username}\nPasswort:`;
	}

	function buildMessage2(): string {
		return createdCredentials?.password ?? '';
	}

	async function copyToClipboard(text: string): Promise<void> {
		if (navigator.clipboard && window.isSecureContext) {
			await navigator.clipboard.writeText(text);
			return;
		}
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.style.cssText = 'position:fixed;opacity:0;pointer-events:none;top:0;left:0';
		document.body.appendChild(textarea);
		textarea.focus();
		textarea.select();
		document.execCommand('copy');
		document.body.removeChild(textarea);
	}

	async function copyCredentials() {
		if (!createdCredentials) return;
		await copyToClipboard(`${buildMessage1()} ${buildMessage2()}`);
		copyFeedback = true;
		setTimeout(() => (copyFeedback = false), 2000);
	}

	async function shareMessage1() {
		const text = buildMessage1();
		if (navigator.share) await navigator.share({ text });
		else await copyToClipboard(text);
	}

	async function shareMessage2() {
		const text = buildMessage2();
		if (navigator.share) await navigator.share({ text });
		else await copyToClipboard(text);
	}

	async function savePassword() {
		if (!editUser) return;
		editError = '';
		const pwError = validatePassword(editPassword);
		if (pwError) { editError = pwError; return; }
		const res = await fetch(`/api/users/${editUser.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: editPassword })
		});
		if (res.ok) {
			editSuccess = t.admin_password_changed;
			editPassword = '';
		} else {
			const d = await res.json();
			editError = d.error ?? 'Fehler';
		}
	}

	async function deleteUser() {
		if (!editUser) return;
		if (!confirm(t.admin_confirm_delete_user)) return;
		const res = await fetch(`/api/users/${editUser.id}`, { method: 'DELETE' });
		if (res.ok) {
			users = users.filter(u => u.id !== editUser!.id);
			editUser = null;
		} else {
			const d = await res.json();
			editError = d.error ?? 'Fehler';
		}
	}

	function openEdit(user: UserEntry) {
		editUser = user;
		editPassword = '';
		editError = '';
		editSuccess = '';
	}

	// ── Supplement Catalog ───────────────────────────────────────────────────────
	type CatalogNutrient = { name: string; amountPerUnit: number; unit: string; sortOrder: number };
	type CatalogEntry = {
		id: string; name: string; unit: string;
		brand: string | null; info: string | null;
		packageSize: number | null; nutrients: CatalogNutrient[];
	};

	const UNIT_MAP: Record<string, string> = {
		kapseln: 'Kapsel', kapsel: 'Kapsel', capsules: 'Kapsel', capsule: 'Kapsel',
		softgels: 'Kapsel', softgel: 'Kapsel',
		tabletten: 'Tablette', tablette: 'Tablette', tablets: 'Tablette', tablet: 'Tablette',
		tbl: 'Tablette', dragees: 'Tablette', dragee: 'Tablette',
		stück: 'Stück', stueck: 'Stück', stk: 'Stück', pieces: 'Stück', piece: 'Stück',
		g: 'g', gramm: 'g', grams: 'g',
		ml: 'ml',
		portionen: 'Portion', portion: 'Portion', portions: 'Portion',
	};

	function isAllCaps(line: string): boolean {
		const t2 = line.trim();
		return t2.length > 0 && t2 === t2.toUpperCase() && /[A-Z]/.test(t2);
	}

	function parsePackageLine(line: string): { packageSize: number; unit: string } | null {
		const match = line.trim().match(/^(\d+(?:[.,]\d+)?)\s+(\S+)$/);
		if (!match) return null;
		const num = parseFloat(match[1].replace(',', '.'));
		const raw = match[2].toLowerCase();
		const unit = UNIT_MAP[raw] ?? match[2];
		return { packageSize: num, unit };
	}

	function parseProductHeader(text: string): { name: string; brand: string; packageSize: number | null; unit: string } {
		const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
		let name = '';
		let brand = '';
		let packageSize: number | null = null;
		let unit = '';
		for (const line of lines) {
			if (isAllCaps(line)) {
				brand = line;
			} else {
				const pkg = parsePackageLine(line);
				if (pkg) {
					packageSize = pkg.packageSize;
					unit = pkg.unit;
				} else {
					name = name ? `${name} ${line}` : line;
				}
			}
		}
		return { name, brand, packageSize, unit };
	}

	const UNIT_DISPLAY: Record<string, string> = {
		Kapsel: 'Kapseln', Tablette: 'Tabletten', Portion: 'Portionen',
	};

	function productHeaderToText(entry: { name: string; brand: string | null; packageSize: number | null; unit: string }): string {
		const lines: string[] = [];
		if (entry.brand) lines.push(entry.brand.toUpperCase());
		if (entry.name) lines.push(entry.name);
		if (entry.packageSize != null && entry.unit) {
			const displayUnit = UNIT_DISPLAY[entry.unit] ?? entry.unit;
			lines.push(`${entry.packageSize} ${displayUnit}`);
		}
		return lines.join('\n');
	}

	let catalog = $state<CatalogEntry[]>([]);
	let catalogForm = $state<{
		id: string | null; headerText: string; nutrientsText: string;
	} | null>(null);
	let catalogError = $state('');
	let catalogSuccess = $state('');
	let catalogSaving = $state(false);
	let parseUrl = $state('');
	let parsing = $state(false);
	let parseNote = $state('');

	async function parseCatalogUrl() {
		if (!catalogForm || !parseUrl.trim()) return;
		parsing = true;
		parseNote = '';
		try {
			const res = await fetch(`/api/supplement-catalog/parse?url=${encodeURIComponent(parseUrl.trim())}`);
			const data = await res.json();
			if (!res.ok) {
				parseNote = data.error ?? t.admin_catalog_parse_error;
				return;
			}
			const lines: string[] = [];
			if (data.brand) lines.push((data.brand as string).toUpperCase());
			if (data.name) lines.push(data.name as string);
			if (data.packageSize != null && data.unit) {
				const displayU = UNIT_DISPLAY[data.unit as string] ?? (data.unit as string);
				lines.push(`${data.packageSize} ${displayU}`);
			}
			catalogForm.headerText = lines.join('\n');
			catalogForm.nutrientsText = (data.nutrientsText as string) ?? '';
			if (data.servingNote) parseNote = data.servingNote as string;
		} catch {
			parseNote = t.admin_catalog_parse_error;
		} finally {
			parsing = false;
		}
	}

	function parseNutrients(text: string): CatalogNutrient[] {
		return text.split('\n')
			.map(line => line.trim())
			.filter(line => line.length > 0)
			.map((line, i) => {
				const parts = line.split(',').map(p => p.trim());
				return { name: parts[0] ?? '', amountPerUnit: parseFloat(parts[1]) || 0, unit: parts[2] ?? '', sortOrder: i };
			})
			.filter(n => n.name);
	}

	function nutrientsToText(nutrients: CatalogNutrient[]): string {
		return nutrients.map(n => `${n.name}, ${n.amountPerUnit}, ${n.unit}`).join('\n');
	}

	async function loadCatalog() {
		const res = await fetch('/api/supplement-catalog');
		if (res.ok) catalog = await res.json();
	}

	function openCatalogNew() {
		catalogForm = { id: null, headerText: '', nutrientsText: '' };
		catalogError = '';
		catalogSuccess = '';
	}

	function openCatalogEdit(entry: CatalogEntry) {
		catalogForm = {
			id: entry.id,
			headerText: productHeaderToText(entry),
			nutrientsText: nutrientsToText(entry.nutrients)
		};
		catalogError = '';
		catalogSuccess = '';
	}

	function closeCatalogForm() {
		catalogForm = null;
		catalogError = '';
		catalogSuccess = '';
		parseUrl = '';
		parseNote = '';
	}

	async function saveCatalog() {
		if (!catalogForm) return;
		const parsed = parseProductHeader(catalogForm.headerText);
		if (!parsed.name.trim()) { catalogError = 'Name erforderlich'; return; }
		if (!parsed.unit.trim()) { catalogError = 'Einheit erforderlich'; return; }

		catalogSaving = true;
		catalogError = '';
		catalogSuccess = '';

		try {
			const body = {
				name: parsed.name.trim(),
				unit: parsed.unit.trim(),
				brand: parsed.brand || null,
				info: null,
				packageSize: parsed.packageSize,
				nutrients: parseNutrients(catalogForm.nutrientsText)
			};

			const isNew = !catalogForm.id;
			const url = isNew ? '/api/supplement-catalog' : `/api/supplement-catalog/${catalogForm.id}`;
			const method = isNew ? 'POST' : 'PUT';
			const res = await fetch(url, {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (res.status === 409) {
				catalogError = t.admin_catalog_duplicate_warning;
				return;
			}
			if (!res.ok) {
				let errMsg = 'Fehler';
				try { const d = await res.json(); errMsg = d.error ?? errMsg; } catch {}
				catalogError = errMsg;
				return;
			}
			catalogSuccess = t.admin_catalog_saved;
			await loadCatalog();
			setTimeout(() => { closeCatalogForm(); }, 1200);
		} catch (e) {
			catalogError = e instanceof Error ? e.message : 'Unbekannter Fehler';
		} finally {
			catalogSaving = false;
		}
	}

	async function deleteCatalogEntry() {
		if (!catalogForm?.id) return;
		if (!confirm(t.admin_catalog_confirm_delete)) return;
		const res = await fetch(`/api/supplement-catalog/${catalogForm.id}`, { method: 'DELETE' });
		if (res.ok) {
			await loadCatalog();
			closeCatalogForm();
		}
	}

	onMount(() => {
		loadUsers();
		loadCatalog();
		canShare = typeof navigator !== 'undefined' && 'share' in navigator;
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.admin_page_title} onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pb-8 px-4 space-y-3" style="padding-top: calc(env(safe-area-inset-top) + 6rem)">

		<!-- ── Users Accordion ─────────────────────────────────────────────────── -->
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
			<!-- Header -->
			<button
				onclick={() => usersOpen = !usersOpen}
				class="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70 transition-opacity"
			>
				<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
				     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent)">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
						<circle cx="9" cy="7" r="4"/>
						<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
						<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
					</svg>
				</div>
				<span class="flex-1 font-semibold text-sm" style="color: var(--color-on-surface)">{t.admin_section_users}</span>
				{#if users.length > 0}
					<span class="text-xs px-2 py-0.5 rounded-full font-medium"
					      style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
						{users.length}
					</span>
				{/if}
				<svg
					width="16" height="16" viewBox="0 0 24 24" fill="none"
					stroke="var(--color-on-surface-variant)" stroke-width="2"
					stroke-linecap="round" stroke-linejoin="round"
					style="transform: rotate({usersOpen ? '180deg' : '0deg'}); transition: transform 0.2s ease"
				>
					<polyline points="6 9 12 15 18 9"/>
				</svg>
			</button>

			<!-- Content -->
			{#if usersOpen}
				<div class="px-3 pb-3 space-y-2">
					<div class="h-px mb-1" style="background-color: var(--color-outline-variant)"></div>

					<!-- User List -->
					<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
						{#each users as user, i (user.id)}
							<button
								onclick={() => openEdit(user)}
								class="w-full flex items-center gap-3 px-4 py-3.5 text-left active:opacity-70 transition-opacity {i > 0 ? 'border-t' : ''}"
								style="border-color: var(--color-outline-variant)"
							>
								<div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
								     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
									{user.username[0].toUpperCase()}
								</div>
								<div class="flex-1 min-w-0">
									<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{user.username}</div>
									<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">
										{user.role === 'admin' ? t.admin_role_admin : t.admin_role_user}
										· {user.listCount} {user.listCount === 1 ? 'Liste' : 'Listen'}, {user.itemCount} Items, {user.recipeCount} {user.recipeCount === 1 ? 'Rezept' : 'Rezepte'}
									</div>
									<div class="text-[10px] truncate" style="color: var(--color-on-surface-variant); opacity: 0.7">
										{formatLastLogin(user.lastLoginAt)}
									</div>
								</div>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="9 18 15 12 9 6"/>
								</svg>
							</button>
						{/each}
					</div>

					<!-- Credentials card after successful creation -->
					{#if createdCredentials}
						<div class="rounded-xl px-4 py-4 space-y-3" style="background-color: var(--color-surface-container)">
							<div class="flex items-center gap-2">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
									<polyline points="22 4 12 14.01 9 11.01"/>
								</svg>
								<span class="text-xs font-semibold" style="color: var(--color-primary)">{t.admin_user_created}</span>
							</div>
							<div class="rounded-lg px-3 py-2.5 space-y-2" style="background-color: var(--color-surface-low)">
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.admin_username_label}</span>
									<span class="text-xs font-mono font-semibold" style="color: var(--color-on-surface)">{createdCredentials.username}</span>
								</div>
								<div class="h-px" style="background-color: var(--color-outline-variant)"></div>
								<div class="flex items-center justify-between gap-2">
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.admin_password_label}</span>
									<span class="text-xs font-mono font-semibold tracking-wider" style="color: var(--color-on-surface)">{createdCredentials.password}</span>
								</div>
							</div>
							<p class="text-[10px] px-1" style="color: var(--color-on-surface-variant)">
								⚠ {t.admin_must_change_hint}
							</p>
							<div class="flex gap-2">
								<button
									onclick={copyCredentials}
									class="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold"
									style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)"
								>
									{#if copyFeedback}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
										{t.admin_copied}
									{:else}
										<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
											<rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
											<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
										</svg>
										{t.admin_copy_credentials}
									{/if}
								</button>
							</div>
							<div class="flex gap-2">
								<button
									onclick={shareMessage1}
									class="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold"
									style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)"
								>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
										<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
									</svg>
									{t.admin_share_msg1}
								</button>
								<button
									onclick={shareMessage2}
									class="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-xs font-semibold"
									style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)"
								>
									<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
										<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
									</svg>
									{t.admin_share_msg2}
								</button>
							</div>
							<button
								onclick={() => { createdCredentials = null; newPassword = generatePassword(); showCreateForm = true; }}
								class="w-full py-2 rounded-full text-xs font-semibold"
								style="background-color: var(--color-surface-low); color: var(--color-on-surface-variant)"
							>
								{t.admin_create_another}
							</button>
						</div>
					{/if}

					<!-- Add User -->
					{#if !showCreateForm && !createdCredentials}
						<button
							onclick={() => { newPassword = generatePassword(); showCreateForm = true; }}
							class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:opacity-70"
							style="background-color: var(--color-surface-container)"
						>
							<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
							     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round">
									<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
							</div>
							<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.admin_add_user}</span>
						</button>
					{:else if showCreateForm}
						<div class="rounded-xl px-4 py-4" style="background-color: var(--color-surface-container)">
							<h3 class="text-xs font-semibold mb-3" style="color: var(--color-on-surface-variant)">{t.admin_add_user}</h3>
							<form onsubmit={createUser} class="space-y-2">
								{#if userError}
									<div class="rounded-lg px-3 py-2 text-xs"
									     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
										{userError}
									</div>
								{/if}
								<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-low)">
									<input type="text" placeholder={t.admin_username_label} bind:value={newUsername} required
									       class="w-full bg-transparent outline-none text-xs" style="color: var(--color-on-surface); font-size: 16px" />
								</div>
								<div>
									<div class="rounded-lg px-3 py-2.5 flex items-center gap-2" style="background-color: var(--color-surface-low)">
										<input type="text" placeholder={t.admin_password_label} bind:value={newPassword} required
										       class="flex-1 bg-transparent outline-none text-xs font-mono" style="color: var(--color-on-surface); font-size: 16px" />
										<button type="button" onclick={() => newPassword = generatePassword()}
										        aria-label="Passwort generieren"
										        class="flex-shrink-0 p-1 rounded-lg active:opacity-60"
										        style="color: var(--color-on-surface-variant)">
											<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
												<polyline points="23 4 23 10 17 10"/>
												<path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
											</svg>
										</button>
									</div>
									<p class="text-[10px] mt-1 px-1" style="color: var(--color-on-surface-variant)">{getPasswordHint(currentLang())}</p>
								</div>
								<div class="rounded-lg px-3 py-2.5 flex items-center gap-3" style="background-color: var(--color-surface-low)">
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{t.admin_role_label}:</span>
									<select bind:value={newRole} class="flex-1 bg-transparent outline-none text-xs" style="color: var(--color-on-surface); font-size: 16px">
										<option value="user">{t.admin_role_user}</option>
										<option value="admin">{t.admin_role_admin}</option>
									</select>
								</div>
								<div class="flex gap-2 pt-1">
									<button type="button" onclick={() => showCreateForm = false}
									        class="flex-1 py-2 rounded-full text-xs font-semibold"
									        style="background-color: var(--color-surface-low); color: var(--color-on-surface-variant)">
										{t.list_cancel}
									</button>
									<button type="submit"
									        class="flex-1 py-2 rounded-full text-xs font-semibold"
									        style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
										{t.create}
									</button>
								</div>
							</form>
						</div>
					{/if}
				</div>
			{/if}
		</div>

		<!-- ── Supplement Catalog Accordion ───────────────────────────────────── -->
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
			<!-- Header -->
			<button
				onclick={() => { catalogOpen = !catalogOpen; if (catalogOpen) loadCatalog(); }}
				class="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70 transition-opacity"
			>
				<div class="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
				     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent)">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
						<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
					</svg>
				</div>
				<span class="flex-1 font-semibold text-sm" style="color: var(--color-on-surface)">{t.admin_section_supplements}</span>
				{#if catalog.length > 0}
					<span class="text-xs px-2 py-0.5 rounded-full font-medium"
					      style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
						{catalog.length}
					</span>
				{/if}
				<svg
					width="16" height="16" viewBox="0 0 24 24" fill="none"
					stroke="var(--color-on-surface-variant)" stroke-width="2"
					stroke-linecap="round" stroke-linejoin="round"
					style="transform: rotate({catalogOpen ? '180deg' : '0deg'}); transition: transform 0.2s ease"
				>
					<polyline points="6 9 12 15 18 9"/>
				</svg>
			</button>

			<!-- Content -->
			{#if catalogOpen}
				<div class="px-3 pb-3 space-y-2">
					<div class="h-px mb-1" style="background-color: var(--color-outline-variant)"></div>

					<!-- Catalog list -->
					{#if catalog.length === 0}
						<p class="text-xs text-center py-4" style="color: var(--color-on-surface-variant)">{t.admin_catalog_empty}</p>
					{:else}
						<div class="rounded-xl overflow-hidden" style="background-color: var(--color-surface-container)">
							{#each catalog as entry, i (entry.id)}
								<button
									onclick={() => openCatalogEdit(entry)}
									class="w-full flex items-center gap-3 px-4 py-3.5 text-left active:opacity-70 transition-opacity {i > 0 ? 'border-t' : ''}"
									style="border-color: var(--color-outline-variant)"
								>
									<div class="flex-1 min-w-0">
										<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.name}</div>
										{#if entry.brand}
											<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{entry.brand} · {entry.unit}</div>
										{:else}
											<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{entry.unit}</div>
										{/if}
									</div>
									{#if entry.nutrients.length > 0}
										<span class="text-[10px] px-2 py-0.5 rounded-full shrink-0"
										      style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)">
											{entry.nutrients.length} {t.admin_catalog_nutrient_count}
										</span>
									{/if}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
										<polyline points="9 18 15 12 9 6"/>
									</svg>
								</button>
							{/each}
						</div>
					{/if}

					<!-- Add button -->
					{#if !catalogForm}
						<button
							onclick={openCatalogNew}
							class="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:opacity-70"
							style="background-color: var(--color-surface-container)"
						>
							<div class="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
							     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
								<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round">
									<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
								</svg>
							</div>
							<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.admin_catalog_add}</span>
						</button>
					{/if}
				</div>
			{/if}
		</div>

	</div><!-- end scroll -->
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- ── Edit User Bottom Sheet ──────────────────────────────────────────────── -->
{#if editUser}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={() => editUser = null}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl px-6 pb-8 pt-4"
	     style="background-color: var(--color-surface-low)">
		<div class="flex justify-center mb-4">
			<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
		</div>
		<div class="flex items-center gap-3 mb-5">
			<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold"
			     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
				{editUser.username[0].toUpperCase()}
			</div>
			<div>
				<div class="font-bold" style="color: var(--color-on-surface)">{editUser.username}</div>
				<div class="text-xs" style="color: var(--color-on-surface-variant)">{editUser.role === 'admin' ? t.admin_role_admin : t.admin_role_user}</div>
			</div>
		</div>
		{#if editError}
			<div class="rounded-lg px-3 py-2 text-xs mb-2"
			     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
				{editError}
			</div>
		{/if}
		{#if editSuccess}
			<div class="rounded-lg px-3 py-2 text-xs mb-2"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				{editSuccess}
			</div>
		{/if}
		<div class="mb-3">
			<div class="rounded-lg px-3 py-2.5" style="background-color: var(--color-surface-container)">
				<input
					type="password"
					placeholder={t.admin_new_password_label}
					bind:value={editPassword}
					class="w-full bg-transparent outline-none text-xs"
					style="color: var(--color-on-surface); font-size: 16px"
				/>
			</div>
			<p class="text-[10px] mt-1 px-1" style="color: var(--color-on-surface-variant)">{getPasswordHint(currentLang())}</p>
		</div>
		<div class="flex gap-2">
			{#if canDelete(editUser)}
				<button
					onclick={deleteUser}
					class="px-3 py-2 rounded-full text-xs font-semibold"
					style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
				>
					{t.admin_delete_user}
				</button>
			{/if}
			<button
				onclick={() => editUser = null}
				class="flex-1 py-2 rounded-full text-xs font-semibold"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>
				{t.list_cancel}
			</button>
			<button
				onclick={savePassword}
				disabled={!!validatePassword(editPassword)}
				class="flex-1 py-2 rounded-full text-xs font-semibold disabled:opacity-40"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{t.list_save}
			</button>
		</div>
	</div>
{/if}

<!-- ── Catalog Form Bottom Sheet ───────────────────────────────────────────── -->
{#if catalogForm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={closeCatalogForm}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl flex flex-col"
	     style="background-color: var(--color-surface-low); max-height: 92vh">

		<!-- Handle + title -->
		<div class="px-6 pt-5 pb-3 shrink-0">
			<div class="flex justify-center mb-3">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{catalogForm.id ? t.admin_catalog_edit_title : t.admin_catalog_new_title}
			</p>
		</div>

		<!-- Scrollable form -->
		<div class="flex-1 overflow-y-auto px-6 space-y-3 pb-2">

			{#if catalogError}
				<div class="rounded-lg px-3 py-2 text-xs"
				     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
					{catalogError}
				</div>
			{/if}
			{#if catalogSuccess}
				<div class="rounded-lg px-3 py-2 text-xs"
				     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
					{catalogSuccess}
				</div>
			{/if}

			<!-- URL parser -->
			<div class="flex gap-2">
				<input
					type="url"
					bind:value={parseUrl}
					placeholder={t.admin_catalog_parse_placeholder}
					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); parseCatalogUrl(); } }}
					class="flex-1 px-3 py-2.5 rounded-xl border-0 outline-none min-w-0"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
				/>
				<button
					type="button"
					onclick={parseCatalogUrl}
					disabled={parsing || !parseUrl.trim()}
					class="px-4 py-2.5 rounded-xl text-sm font-semibold shrink-0 active:opacity-70 disabled:opacity-40"
					style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent); color: var(--color-primary)"
				>
					{parsing ? '…' : t.admin_catalog_parse_button}
				</button>
			</div>

			{#if parseNote}
				<div class="rounded-lg px-3 py-2 text-xs"
				     style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)">
					{parseNote}
				</div>
			{/if}

			<!-- Header textarea -->
			<div>
				<label for="catalog-header" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">
					{t.admin_catalog_header_label}
				</label>
				<textarea
					id="catalog-header"
					bind:value={catalogForm.headerText}
					placeholder={"NATURTREU\nGlanzleistung: Coenzym Q10\n90 Kapseln"}
					rows={3}
					class="w-full px-4 py-3 rounded-xl border-0 outline-none resize-none leading-relaxed"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
				></textarea>
				{#if catalogForm.headerText.trim()}
					{@const preview = parseProductHeader(catalogForm.headerText)}
					<div class="mt-1.5 px-1 flex flex-wrap gap-x-3 gap-y-0.5">
						{#if preview.name}
							<span class="text-[11px]" style="color: var(--color-on-surface-variant)">
								<span style="opacity: 0.6">Name:</span> {preview.name}
							</span>
						{/if}
						{#if preview.brand}
							<span class="text-[11px]" style="color: var(--color-on-surface-variant)">
								<span style="opacity: 0.6">Marke:</span> {preview.brand}
							</span>
						{/if}
						{#if preview.unit}
							<span class="text-[11px]" style="color: var(--color-on-surface-variant)">
								<span style="opacity: 0.6">Einheit:</span> {preview.unit}
							</span>
						{/if}
						{#if preview.packageSize != null}
							<span class="text-[11px]" style="color: var(--color-on-surface-variant)">
								<span style="opacity: 0.6">Inhalt:</span> {preview.packageSize}
							</span>
						{/if}
					</div>
				{/if}
			</div>

			<!-- Nutrients textarea -->
			<div>
				<label for="catalog-nutrients" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">
					{t.admin_catalog_nutrients_label}
				</label>
				<textarea
					id="catalog-nutrients"
					bind:value={catalogForm.nutrientsText}
					placeholder={t.admin_catalog_nutrients_placeholder}
					rows={5}
					class="w-full px-4 py-3 rounded-xl border-0 outline-none resize-none leading-relaxed"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; font-family: monospace"
				></textarea>
			</div>

		</div><!-- end scrollable -->

		<!-- Action buttons -->
		<div class="px-6 pt-3 pb-6 shrink-0 flex gap-2" style="border-top: 1px solid var(--color-surface-high)">
			{#if catalogForm.id}
				<button
					onclick={deleteCatalogEntry}
					class="px-3 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-error)"
				>
					{t.admin_catalog_delete}
				</button>
			{/if}
			<button
				onclick={closeCatalogForm}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>
				{t.list_cancel}
			</button>
			<button
				onclick={saveCatalog}
				disabled={catalogSaving || !catalogForm.headerText.trim()}
				class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{catalogSaving ? '…' : t.supplement_save}
			</button>
		</div>

	</div>
{/if}

