<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import ManageSheetShell from '#lib/components/supplements/ManageSheetShell.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import type { AdminUserEntry } from '#lib/adminUsers';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import HamburgerMenu from '#lib/components/HamburgerMenu.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import { t, currentLang } from '#lib/i18n.svelte';

	let { data } = $props();

	// ── Accordion state ──────────────────────────────────────────────────────────
	let usersOpen = $state(page.url.hash === '#benutzer');
	let catalogOpen = $state(false);
	let caffeineDrinksOpen = $state(false);
	let menuOpen = $state(false);

	// Compact editors share the same shell and keep failed requests editable.
	type CaffeineDrinkEntry = { id: string; name: string; defaultMl: number; caffeineMg: number; sortOrder: number; createdAt: number };
	let caffeineDrinks = $state<CaffeineDrinkEntry[]>([]);
	let caffeineLoading = $state(false);
	let caffeineLoadError = $state(false);
	let drinkForm = $state<{ id: string | null; name: string; ml: number | undefined; mg: number | undefined } | null>(null);
	let drinkSaving = $state(false);
	let drinkError = $state('');
	const drinkValid = $derived(!!drinkForm?.name.trim() && Number.isSafeInteger(drinkForm?.ml) && Number(drinkForm?.ml) > 0 && Number.isSafeInteger(drinkForm?.mg) && Number(drinkForm?.mg) >= 0);
	const editorId = $props.id();
	const drinkFormId = editorId + '-drink';
	const userFormId = editorId + '-user';

	async function loadCaffeineDrinks() {
		caffeineLoading = true; caffeineLoadError = false;
		try {
			const response = await fetch('/api/caffeine-drinks');
			if (!response.ok) throw new Error();
			caffeineDrinks = (await response.json()).drinks ?? [];
		} catch { caffeineLoadError = true; }
		finally { caffeineLoading = false; }
	}
	function openDrink(drink: CaffeineDrinkEntry | null = null) {
		drinkError = '';
		drinkForm = { id: drink?.id ?? null, name: drink?.name ?? '', ml: drink?.defaultMl, mg: drink?.caffeineMg };
	}
	function closeDrink() { if (!drinkSaving) drinkForm = null; }
	async function saveDrink(event: SubmitEvent) {
		event.preventDefault();
		if (!drinkForm || !drinkValid || drinkSaving) return;
		drinkSaving = true; drinkError = '';
		const id = drinkForm.id;
		const payload = { name: drinkForm.name.trim(), defaultMl: Number(drinkForm.ml), caffeineMg: Number(drinkForm.mg) };
		try {
			const response = await fetch(id ? `/api/caffeine-drinks/${id}` : '/api/caffeine-drinks', { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
			if (!response.ok) throw new Error();
			if (id) caffeineDrinks = caffeineDrinks.map(drink => drink.id === id ? { ...drink, ...payload } : drink);
			else { const result = await response.json(); caffeineDrinks = [...caffeineDrinks, { id: result.id, ...payload, sortOrder: caffeineDrinks.length, createdAt: Date.now() }]; }
			drinkForm = null;
		} catch { drinkError = t.admin_request_failed; }
		finally { drinkSaving = false; }
	}
	async function deleteDrink() {
		if (!drinkForm?.id || drinkSaving) return;
		drinkSaving = true; drinkError = '';
		const id = drinkForm.id;
		try {
			const response = await fetch(`/api/caffeine-drinks/${id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error();
			caffeineDrinks = caffeineDrinks.filter(drink => drink.id !== id);
			drinkForm = null;
		} catch { drinkError = t.admin_request_failed; }
		finally { drinkSaving = false; }
	}

	let users = $state<AdminUserEntry[]>([]);
	let usersError = $state(false);
	let showCreateForm = $state(false);
	let newUsername = $state('');
	let newRole = $state<'user' | 'admin'>('user');
	let userError = $state('');
	let creating = $state(false);
	function userStatusLabel(user: AdminUserEntry): { text: string; tone: 'active' | 'pending' | 'expired' } {
		if (!user.openInviteType) return { text: t.admin_status_active, tone: 'active' };
		const expired = user.openInviteExpiresAt != null && user.openInviteExpiresAt < Date.now() / 1000;
		return { text: user.openInviteType === 'invite' ? expired ? t.admin_status_invite_expired : t.admin_status_invite_pending : expired ? t.admin_status_reset_expired : t.admin_status_reset_pending, tone: expired ? 'expired' : 'pending' };
	}
	function formatExpiresIn(expiresAt: number): string {
		return `${Math.max(1, Math.ceil((expiresAt - Date.now() / 1000) / 3600))}h`;
	}
	async function loadUsers() {
		usersError = false;
		try {
			const response = await fetch('/api/users');
			if (!response.ok) throw new Error();
			users = await response.json();
		} catch { usersError = true; }
	}
	function closeCreate() { if (!creating) showCreateForm = false; }
	async function createUser(event: SubmitEvent) {
		event.preventDefault();
		if (creating || !newUsername.trim()) return;
		userError = ''; creating = true;
		try {
			const response = await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: newUsername.trim(), role: newRole }) });
			if (!response.ok) { userError = response.status === 409 ? t.admin_username_taken : t.admin_request_failed; return; }
			const result = await response.json();
			showCreateForm = false; newUsername = ''; newRole = 'user';
			await goto(`/einstellungen/admin/benutzer/${result.id}`);
		} catch { userError = t.admin_request_failed; }
		finally { creating = false; }
	}
	function focusDialog(node: HTMLElement) {
		const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		void tick().then(() => { if (node.isConnected) node.focus({ preventScroll: true }); });
		const keydown = (event: KeyboardEvent) => {
			if (event.key === 'Escape') { event.preventDefault(); if (drinkForm) closeDrink(); else closeCreate(); }
			if (event.key !== 'Tab') return;
			const controls = [...node.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]')].filter(element => element.getClientRects().length > 0);
			if (event.shiftKey && (document.activeElement === controls[0] || document.activeElement === node)) { event.preventDefault(); controls.at(-1)?.focus(); }
			else if (!event.shiftKey && document.activeElement === controls.at(-1)) { event.preventDefault(); controls[0]?.focus(); }
		};
		node.addEventListener('keydown', keydown);
		return { destroy() { node.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus({ preventScroll: true }); } };
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
			const pkg = parsePackageLine(line);
			if (pkg) {
				packageSize = pkg.packageSize;
				unit = pkg.unit;
			} else if (!brand) {
				brand = line;
			} else {
				name = name ? `${name} ${line}` : line;
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
	let openBrands = $state<Set<string>>(new Set());
	let catalogSearch = $state('');
	let openBrandsBeforeSearch = $state<Set<string> | null>(null);

	const catalogGrouped = $derived(
		(() => {
			const q = catalogSearch.trim().toLowerCase();
			const filtered = q
				? catalog.filter(e =>
						e.name.toLowerCase().includes(q) ||
						(e.brand ?? '').toLowerCase().includes(q)
					)
				: catalog;
			const groups = new Map<string, CatalogEntry[]>();
			for (const entry of filtered) {
				const brand = entry.brand ?? '—';
				if (!groups.has(brand)) groups.set(brand, []);
				groups.get(brand)!.push(entry);
			}
			return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
		})()
	);

	function onCatalogSearchInput(value: string) {
		const wasEmpty = catalogSearch.trim() === '';
		const isNowEmpty = value.trim() === '';
		catalogSearch = value;
		if (wasEmpty && !isNowEmpty) {
			openBrandsBeforeSearch = new Set(openBrands);
			openBrands = new Set(catalog.map(e => e.brand ?? '—'));
		} else if (!wasEmpty && isNowEmpty) {
			if (openBrandsBeforeSearch !== null) {
				openBrands = openBrandsBeforeSearch;
				openBrandsBeforeSearch = null;
			}
		}
	}

	function toggleBrand(brand: string) {
		const next = new Set(openBrands);
		if (next.has(brand)) next.delete(brand);
		else next.add(brand);
		openBrands = next;
	}

	const SAMPLE_SINGLE = $derived(currentLang() === 'de'
		? `Muster Marke\nVitamin C Komplex\n60 Kapseln\n\nVitamin C, 500, mg\nHagebutten-Extrakt, 200, mg\nBioflavonoide, 50, mg`
		: `Sample Brand\nVitamin C Complex\n60 Capsules\n\nVitamin C, 500, mg\nRosehip Extract, 200, mg\nBioflavonoids, 50, mg`
	);

	const SAMPLE_MULTI = $derived(currentLang() === 'de'
		? `Muster Marke\nVitamin C Komplex\n60 Kapseln\n\nVitamin C, 500, mg\nHagebutten-Extrakt, 200, mg\nBioflavonoide, 50, mg\n\n-----\n\nMuster Marke\nOmega-3 Premium\n90 Kapseln\n\nEPA, 360, mg\nDHA, 240, mg\n\n-----\n\nMuster Marke\nMagnesium Komplex\n120 Tabletten\n\nMagnesium, 300, mg\nVitamin B6, 0.7, mg\nZink, 5, mg`
		: `Sample Brand\nVitamin C Complex\n60 Capsules\n\nVitamin C, 500, mg\nRosehip Extract, 200, mg\nBioflavonoids, 50, mg\n\n-----\n\nSample Brand\nOmega-3 Premium\n90 Capsules\n\nEPA, 360, mg\nDHA, 240, mg\n\n-----\n\nSample Brand\nMagnesium Complex\n120 Tablets\n\nMagnesium, 300, mg\nVitamin B6, 0.7, mg\nZinc, 5, mg`
	);

	let catalogForm = $state<{
		id: string | null; text: string;
	} | null>(null);

	function entryToText(entry: CatalogEntry): string {
		const header = productHeaderToText(entry);
		const nutrients = nutrientsToText(entry.nutrients);
		return nutrients ? `${header}\n\n${nutrients}` : header;
	}

	function parseCombinedText(text: string): { header: ReturnType<typeof parseProductHeader>; nutrients: CatalogNutrient[] } {
		const blankLine = text.search(/\n\s*\n/);
		const headerText = blankLine >= 0 ? text.slice(0, blankLine) : text;
		const nutrientsText = blankLine >= 0 ? text.slice(blankLine).trim() : '';
		return { header: parseProductHeader(headerText), nutrients: parseNutrients(nutrientsText) };
	}
	let catalogError = $state('');
	let catalogSuccess = $state('');
	let catalogSaving = $state(false);
	let catalogSaveOk = $state(false);
	let parseUrl = $state('');
	let parsing = $state(false);
	let parseNote = $state('');

	type BulkPreviewItem = { brand: string; name: string; unit: string; packageSize: string; nutrients: CatalogNutrient[]; nutrientsText: string };
	let catalogPreview = $state<BulkPreviewItem[] | null>(null);
	let bulkImporting = $state(false);
	let expandedItems = $state<Set<number>>(new Set());

	async function parseCatalogUrl() {
		if (!catalogForm || !parseUrl.trim()) return;
		parsing = true;
		parseNote = '';
		try {
			const res = await fetch(`/api/supplement-catalog/parse?url=${encodeURIComponent(parseUrl.trim())}`);
			const data = await res.json();
			if (!res.ok) {
				parseNote = data.code === 'invalid_url' ? t.admin_catalog_url_invalid
					: data.code === 'url_not_allowed' ? t.admin_catalog_url_not_allowed
					: data.code === 'page_load_failed' ? t.admin_catalog_page_load_failed
					: t.admin_catalog_parse_error;
				return;
			}
			const lines: string[] = [];
			if (data.brand) lines.push((data.brand as string).toUpperCase());
			if (data.name) lines.push(data.name as string);
			if (data.packageSize != null && data.unit) {
				const displayU = UNIT_DISPLAY[data.unit as string] ?? (data.unit as string);
				lines.push(`${data.packageSize} ${displayU}`);
			}
			const headerPart = lines.join('\n');
			const nutrientsPart = (data.nutrientsText as string) ?? '';
			catalogForm.text = nutrientsPart ? `${headerPart}\n\n${nutrientsPart}` : headerPart;
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
		catalogForm = { id: null, text: '' };
		catalogError = '';
		catalogSuccess = '';
	}

	function openCatalogEdit(entry: CatalogEntry) {
		catalogForm = { id: entry.id, text: entryToText(entry) };
		catalogError = '';
		catalogSuccess = '';
	}

	function closeCatalogForm() {
		catalogForm = null;
		catalogPreview = null;
		catalogError = '';
		catalogSuccess = '';
		parseUrl = '';
		parseNote = '';
	}

	function showPreview() {
		if (!catalogForm) return;
		const blocks = catalogForm.text.split(/\n-{3,}[ \t]*\n/).map(b => b.trim()).filter(b => b.length > 0);
		catalogPreview = blocks.map(block => {
			const { header, nutrients } = parseCombinedText(block);
			const filtered = nutrients.filter(n => !n.name.trim().toLowerCase().startsWith('davon'));
			return {
				brand: header.brand,
				name: header.name,
				unit: header.unit,
				packageSize: header.packageSize != null ? String(header.packageSize) : '',
				nutrients: filtered,
				nutrientsText: filtered.map(n => `${n.name}, ${n.amountPerUnit}, ${n.unit}`).join('\n')
			};
		}).filter(item => item.name.trim().length > 0);
		expandedItems = new Set();
	}

	async function importAll() {
		if (!catalogPreview) return;
		bulkImporting = true;
		try {
			for (const item of catalogPreview) {
				if (!item.name.trim() || !item.unit.trim()) continue;
				await fetch('/api/supplement-catalog', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						name: item.name.trim(),
						unit: item.unit.trim(),
						brand: item.brand || null,
						info: null,
						packageSize: item.packageSize ? Number(item.packageSize) : null,
						nutrients: parseNutrients(item.nutrientsText)
					})
				});
			}
			await loadCatalog();
			closeCatalogForm();
		} finally {
			bulkImporting = false;
		}
	}

	async function saveCatalog() {
		if (!catalogForm) return;
		const { header: parsed, nutrients } = parseCombinedText(catalogForm.text);
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
				nutrients
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
			await loadCatalog();
			if (isNew) {
				catalogForm = { id: null, text: '' };
				parseUrl = '';
				parseNote = '';
				catalogSaveOk = true;
				setTimeout(() => { catalogSaveOk = false; }, 2000);
			} else {
				closeCatalogForm();
			}
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
	});
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.admin_page_title} onMenuOpen={() => menuOpen = true} />

	<div class="admin-content flex-1 overflow-y-auto px-4" style="padding-top: calc(env(safe-area-inset-top) + 6rem)">

	<div class="admin-groups">
		<!-- ── Users Accordion ─────────────────────────────────────────────────── -->
		<div id="benutzer">
			<!-- Header -->
			<button
				aria-expanded={usersOpen}
				onclick={() => usersOpen = !usersOpen}
				class="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70 transition-opacity"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
					<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
				</svg>
				<span class="flex-1 font-semibold text-sm" style="color: var(--color-on-surface)">{t.admin_section_users}</span>
				{#if users.length > 0}
					<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">
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
					<!-- User List -->
					<div class="admin-list user-list">
						{#each users as user (user.id)}
							{@const status = userStatusLabel(user)}
							{@const expiresIn = status.tone === 'pending' && user.openInviteExpiresAt
								? formatExpiresIn(user.openInviteExpiresAt) : ''}
							<a
								href={`/einstellungen/admin/benutzer/${user.id}`}
								class="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-70 transition-opacity"
							>
								<div class="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
								     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
									{user.username[0].toUpperCase()}
								</div>
								<div class="flex-1 min-w-0">
									<div class="user-name-line">
										<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{user.username}</div>
										<span class="user-status text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
										      style="background-color: {status.tone === 'active'
										        ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)'
										        : status.tone === 'pending'
										        ? 'color-mix(in srgb, #C8956C 18%, transparent)'
										        : 'color-mix(in srgb, var(--color-error) 18%, transparent)'};
										        color: {status.tone === 'active' ? 'var(--color-primary)'
										        : status.tone === 'pending' ? '#C8956C' : 'var(--color-error)'}">
											{status.text}{expiresIn ? ` · ${t.admin_status_expires_hours} ${expiresIn}` : ''}
										</span>
									</div>
									<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">
										{user.role === 'admin' ? t.admin_role_admin : t.admin_role_user}
										· {t.nav_lists}: {user.listCount} · {t.admin_user_items}: {user.itemCount} · {t.nav_recipes}: {user.recipeCount}
									</div>
								</div>
								<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
									<polyline points="9 18 15 12 9 6"/>
								</svg>
							</a>
						{/each}
						<button type="button" class="admin-add-row" onclick={() => { userError = ''; showCreateForm = true; }}><span aria-hidden="true">+</span>{t.admin_add_user}</button>
					</div>
					{#if usersError}<div class="admin-load-error"><p role="status">{t.admin_load_failed}</p><button type="button" onclick={loadUsers}>{t.offline_retry}</button></div>{/if}
				</div>
			{/if}
		</div>

		<!-- ── Supplement Catalog Accordion ───────────────────────────────────── -->
		<div>
			<!-- Header -->
			<button
				aria-expanded={catalogOpen}
				onclick={() => { catalogOpen = !catalogOpen; if (catalogOpen) loadCatalog(); }}
				class="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70 transition-opacity"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
					<path d="M4.8 8.4L19.2 8.4A3.6 3.6 0 0 1 19.2 15.6L4.8 15.6A3.6 3.6 0 0 1 4.8 8.4Z" fill="none" stroke-width="1.8" stroke-linejoin="round"/>
					<line x1="12" y1="8.4" x2="12" y2="15.6" stroke-width="0.85" stroke-linecap="round"/>
				</svg>
				<span class="flex-1 font-semibold text-sm" style="color: var(--color-on-surface)">{t.admin_section_supplements}</span>
				{#if catalog.length > 0}
					<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">
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
					<div class="admin-list catalog-tools">
						<button type="button" class="admin-add-row" onclick={openCatalogNew}><span aria-hidden="true">+</span>{t.admin_catalog_add}</button>
						<div class="catalog-search-row">
							<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
							<input type="search" value={catalogSearch} oninput={(event) => onCatalogSearchInput(event.currentTarget.value)} aria-label={t.admin_catalog_search_placeholder} placeholder={t.admin_catalog_search_placeholder} />
						</div>
					</div>
					{#if catalog.length === 0}
						<p class="text-xs text-center py-4" style="color: var(--color-on-surface-variant)">{t.admin_catalog_empty}</p>
					{:else}
						<!-- Flat brand rows -->
						<div>
							<p class="text-xs font-semibold px-1 pb-1.5 pt-0.5" style="color: var(--color-on-surface-variant)">{t.admin_catalog_brands_label}</p>
							{#if catalogGrouped.length === 0}
								<p class="text-xs text-center py-4" style="color: var(--color-on-surface-variant)">{t.admin_catalog_no_results}</p>
							{:else}
							<div class="admin-list admin-brand-list">
							<div>
							{#each catalogGrouped as [brand, entries] (brand)}
								{@const isOpen = openBrands.has(brand)}
								<div class="admin-brand-group">
									<!-- Brand header -->
									<button
										aria-expanded={isOpen}
										onclick={() => toggleBrand(brand)}
										class="w-full flex items-center gap-3 px-4 py-3 text-left active:opacity-70 transition-opacity"
									>
										<span class="flex-1 text-xs font-bold uppercase tracking-wide truncate" style="color: var(--color-on-surface-variant)">{brand}</span>
										<span class="text-xs font-medium shrink-0" style="color: var(--color-on-surface-variant)">
											{entries.length}
										</span>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none"
										     stroke="var(--color-on-surface-variant)" stroke-width="2"
										     stroke-linecap="round" stroke-linejoin="round"
										     style="transform: rotate({isOpen ? '180deg' : '0deg'}); transition: transform 0.2s ease; flex-shrink: 0">
											<polyline points="6 9 12 15 18 9"/>
										</svg>
									</button>
									<!-- Brand entries -->
									{#if isOpen}
										{#each entries as entry, i (entry.id)}
											<button
												onclick={() => openCatalogEdit(entry)}
												class="w-full flex items-center gap-3 px-4 py-2.5 text-left active:opacity-70 transition-opacity"
												style=""
											>
												<div class="flex-1 min-w-0">
													<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{entry.name}</div>
													<div class="text-xs truncate" style="color: var(--color-on-surface-variant)">{entry.unit}</div>
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
									{/if}
								</div>
							{/each}
							</div>
							</div>
							{/if}
						</div>
					{/if}

				</div>
			{/if}
		</div>

		<!-- ── Caffeine Drinks Accordion ──────────────────────────────────────── -->
		<div>
			<button
				aria-expanded={caffeineDrinksOpen}
				onclick={() => { caffeineDrinksOpen = !caffeineDrinksOpen; if (caffeineDrinksOpen) loadCaffeineDrinks(); }}
				class="w-full flex items-center gap-3 px-4 py-4 text-left active:opacity-70 transition-opacity"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C8956C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="shrink-0">
					<path d="M18 8h1a4 4 0 0 1 0 8h-1"/>
					<path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
					<line x1="6" y1="1" x2="6" y2="4"/>
					<line x1="10" y1="1" x2="10" y2="4"/>
					<line x1="14" y1="1" x2="14" y2="4"/>
				</svg>
				<span class="flex-1 font-semibold text-sm" style="color: var(--color-on-surface)">{t.caffeine_admin_drinks_title}</span>
				{#if caffeineDrinks.length > 0}
					<span class="text-xs font-medium" style="color: var(--color-on-surface-variant)">{caffeineDrinks.length}</span>
				{/if}
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
				     style="transform: rotate({caffeineDrinksOpen ? '180deg' : '0deg'}); transition: transform 0.2s ease">
					<polyline points="6 9 12 15 18 9"/>
				</svg>
			</button>

			{#if caffeineDrinksOpen}
				<div class="px-3 pb-3">
					{#if caffeineLoading}<p class="admin-loading" role="status">{t.admin_loading}</p>{/if}
					<div class="admin-list drink-list">
						{#each caffeineDrinks as drink (drink.id)}
							<button type="button" class="drink-row" onclick={() => openDrink(drink)}><span><span class="drink-name">{drink.name}</span><span class="drink-meta">{drink.defaultMl} ml · {drink.caffeineMg} mg</span></span><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg></button>
						{/each}
						<button type="button" class="admin-add-row" onclick={() => openDrink()}><span aria-hidden="true">+</span>{t.caffeine_admin_add}</button>
					</div>
					{#if caffeineLoadError}<div class="admin-load-error"><p role="status">{t.admin_load_failed}</p><button type="button" onclick={loadCaffeineDrinks}>{t.offline_retry}</button></div>{/if}
				</div>
			{/if}
		</div>
	</div>

	</div><!-- end scroll -->
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
<AppBottomNav activeTab="none" />

{#if showCreateForm}
	<div role="dialog" aria-modal="true" aria-label={t.admin_create_user_title} tabindex="-1" use:focusDialog>
		<ManageSheetShell accent="var(--color-primary)" title={t.admin_create_user_title} onclose={closeCreate}>
			{#snippet body()}
				<form id={userFormId} onsubmit={createUser}>
					<p class="admin-sheet-hint">{t.admin_create_user_hint}</p>
					<fieldset disabled={creating} class="manage-settings-surface admin-fields">
						<div class="manage-settings-row"><label class="manage-settings-label" for={userFormId + '-name'}>{t.admin_username_label}</label><input id={userFormId + '-name'} class="manage-settings-input" bind:value={newUsername} required autocomplete="off" autocapitalize="none" /></div>
						<SettingsSelectRow label={t.admin_role_label} value={newRole} options={[{value:'user',label:t.admin_role_user},{value:'admin',label:t.admin_role_admin}]} onchange={(role) => newRole = role as 'user' | 'admin'} />
					</fieldset>
					{#if userError}<p class="admin-form-error" role="alert">{userError}</p>{/if}
				</form>
			{/snippet}
			{#snippet footer()}<button type="button" class="manage-secondary" disabled={creating} onclick={closeCreate}>{t.list_cancel}</button><button type="submit" form={userFormId} class="manage-primary" disabled={creating || !newUsername.trim()}>{creating ? '…' : t.create}</button>{/snippet}
		</ManageSheetShell>
	</div>
{/if}
{#if drinkForm}
	<div role="dialog" aria-modal="true" aria-label={drinkForm.id ? t.caffeine_admin_edit : t.caffeine_admin_add} tabindex="-1" use:focusDialog>
		<ManageSheetShell accent="#C8956C" title={drinkForm.id ? t.caffeine_admin_edit : t.caffeine_admin_add} onclose={closeDrink}>
			{#snippet body()}
				{#if drinkForm}
				<form id={drinkFormId} onsubmit={saveDrink}>
					<fieldset disabled={drinkSaving} class="manage-settings-surface admin-fields">
						<div class="manage-settings-row"><label for={drinkFormId + '-name'} class="manage-settings-label">{t.caffeine_drink_name}</label><input id={drinkFormId + '-name'} class="manage-settings-input" bind:value={drinkForm.name} required autocomplete="off" /></div>
						<div class="manage-settings-row"><label for={drinkFormId + '-ml'} class="manage-settings-label">{t.caffeine_admin_portion}</label><div class="admin-unit-input"><input id={drinkFormId + '-ml'} class="manage-settings-input" type="number" inputmode="numeric" min="1" step="1" required bind:value={drinkForm.ml} /><span class="manage-settings-unit">ml</span></div></div>
						<div class="manage-settings-row"><label for={drinkFormId + '-mg'} class="manage-settings-label">{t.act_caffeine}</label><div class="admin-unit-input"><input id={drinkFormId + '-mg'} class="manage-settings-input" type="number" inputmode="numeric" min="0" step="1" required bind:value={drinkForm.mg} /><span class="manage-settings-unit">mg</span></div></div>
					</fieldset>
					{#if drinkError}<p class="admin-form-error" role="alert">{drinkError}</p>{/if}
					{#if drinkForm.id}<button type="button" class="admin-drink-delete" disabled={drinkSaving} onclick={deleteDrink}>{t.caffeine_admin_delete}</button>{/if}
				</form>
				{/if}
			{/snippet}
			{#snippet footer()}<button type="button" class="manage-secondary" disabled={drinkSaving} onclick={closeDrink}>{t.list_cancel}</button><button type="submit" form={drinkFormId} class="manage-primary" disabled={drinkSaving || !drinkValid}>{drinkSaving ? '…' : t.list_save}</button>{/snippet}
		</ManageSheetShell>
	</div>
{/if}

<!-- ── Catalog Form Bottom Sheet ───────────────────────────────────────────── -->
{#if catalogForm}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-40" style="background-color: rgba(0,0,0,0.6)" onclick={closeCatalogForm}></div>
	<div class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl flex flex-col"
	     style="background-color: var(--modal-bg); max-height: 92vh">

		<!-- Handle + title -->
		<div class="px-6 pt-5 pb-3 shrink-0">
			<div class="flex justify-center mb-3">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<p class="font-semibold text-base" style="color: var(--color-on-surface)">
				{#if catalogPreview}
					{t.admin_catalog_preview_button} · {catalogPreview.length}
				{:else if catalogForm.id}
					{t.admin_catalog_edit_title}
				{:else}
					{t.admin_catalog_new_title}
				{/if}
			</p>
		</div>

		{#if catalogPreview}
			<!-- ── Preview mode ── -->
			<div class="flex-1 overflow-y-auto px-4 space-y-3 pb-2">
				{#each catalogPreview as item, i}
					<div class="rounded-2xl p-4 space-y-2.5" style="background-color: var(--color-surface-container)">
						<!-- Header row: index + nutrient toggle -->
						<div class="flex items-center justify-between">
							<span class="text-[10px] font-semibold uppercase tracking-wide" style="color: var(--color-on-surface-variant); opacity: 0.6">
								#{i + 1}
							</span>
							<button
								onclick={() => {
									const next = new Set(expandedItems);
									if (next.has(i)) next.delete(i); else next.add(i);
									expandedItems = next;
								}}
								class="flex items-center gap-1 px-2 py-0.5 rounded-full active:opacity-60"
								style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)"
							>
								<span class="text-[10px] font-medium">{item.nutrients.length} {t.admin_catalog_nutrient_count}</span>
								<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
								     style="transform: rotate({expandedItems.has(i) ? '180deg' : '0deg'}); transition: transform 0.2s ease">
									<polyline points="6 9 12 15 18 9"/>
								</svg>
							</button>
						</div>
						<!-- Brand -->
						<div class="rounded-lg px-3 py-2" style="background-color: var(--color-surface-low)">
							<p class="text-[10px] mb-0.5" style="color: var(--color-on-surface-variant); opacity: 0.7">Hersteller</p>
							<input
								type="text"
								bind:value={catalogPreview[i].brand}
								class="w-full bg-transparent outline-none text-sm font-medium"
								style="color: var(--color-on-surface); font-size: 16px"
							/>
						</div>
						<!-- Name -->
						<div class="rounded-lg px-3 py-2" style="background-color: var(--color-surface-low)">
							<p class="text-[10px] mb-0.5" style="color: var(--color-on-surface-variant); opacity: 0.7">Name</p>
							<input
								type="text"
								bind:value={catalogPreview[i].name}
								class="w-full bg-transparent outline-none text-sm font-medium"
								style="color: var(--color-on-surface); font-size: 16px"
							/>
						</div>
						<!-- Unit + PackageSize -->
						<div class="flex gap-2">
							<div class="flex-1 rounded-lg px-3 py-2" style="background-color: var(--color-surface-low)">
								<p class="text-[10px] mb-0.5" style="color: var(--color-on-surface-variant); opacity: 0.7">Einheit</p>
								<input
									type="text"
									bind:value={catalogPreview[i].unit}
									class="w-full bg-transparent outline-none text-sm font-medium"
									style="color: var(--color-on-surface); font-size: 16px"
								/>
							</div>
							<div class="w-28 rounded-lg px-3 py-2" style="background-color: var(--color-surface-low)">
								<p class="text-[10px] mb-0.5" style="color: var(--color-on-surface-variant); opacity: 0.7">Packung</p>
								<input
									type="number"
									bind:value={catalogPreview[i].packageSize}
									class="w-full bg-transparent outline-none text-sm font-medium"
									style="color: var(--color-on-surface); font-size: 16px"
								/>
							</div>
						</div>
						<!-- Collapsible nutrients textarea -->
						{#if expandedItems.has(i)}
							<div class="rounded-lg px-3 py-2" style="background-color: var(--color-surface-low)">
								<p class="text-[10px] mb-1" style="color: var(--color-on-surface-variant); opacity: 0.7">{t.admin_catalog_nutrient_count} — Name, Menge, Einheit</p>
								<textarea
									bind:value={catalogPreview[i].nutrientsText}
									rows={Math.min(catalogPreview[i].nutrientsText.split('\n').length + 1, 10)}
									class="w-full bg-transparent outline-none resize-none leading-relaxed"
									style="color: var(--color-on-surface); font-size: 14px; font-family: monospace"
								></textarea>
							</div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Preview action buttons -->
			<div class="px-6 pt-3 pb-6 shrink-0 flex gap-2" style="border-top: 1px solid var(--color-surface-high)">
				<button
					onclick={() => catalogPreview = null}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>
					{t.admin_catalog_back}
				</button>
				<button
					onclick={importAll}
					disabled={bulkImporting || catalogPreview.length === 0}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{#if bulkImporting}
						…
					{:else}
						{t.admin_catalog_import_all}
					{/if}
				</button>
			</div>

		{:else}
			<!-- ── Textarea / edit mode ── -->
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

				<!-- URL parser (only for new entries) -->
				{#if !catalogForm.id}
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
				{/if}

				{#if parseNote}
					<div class="rounded-lg px-3 py-2 text-xs"
					     style="background-color: color-mix(in srgb, var(--color-primary) 10%, transparent); color: var(--color-primary)">
						{parseNote}
					</div>
				{/if}

				<!-- Combined textarea -->
				<div>
					<label for="catalog-text" class="text-xs font-medium mb-1 block" style="color: var(--color-on-surface-variant)">
						{t.admin_catalog_header_label}
					</label>
					<p class="text-[11px] mb-2 leading-relaxed" style="color: var(--color-on-surface-variant); opacity: 0.7">{t.admin_catalog_text_hint}</p>
					<div class="flex gap-2 mb-2 flex-wrap">
						<button
							type="button"
							onclick={() => { if (catalogForm) catalogForm.text = SAMPLE_SINGLE; }}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium active:opacity-60"
							style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							{t.admin_catalog_sample_single}
						</button>
						<button
							type="button"
							onclick={() => { if (catalogForm) catalogForm.text = SAMPLE_MULTI; }}
							class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-medium active:opacity-60"
							style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
						>
							<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
							{t.admin_catalog_sample_multi}
						</button>
					</div>
					<textarea
						id="catalog-text"
						bind:value={catalogForm.text}
						placeholder={t.admin_catalog_text_placeholder}
						rows={10}
						class="w-full px-4 py-3 rounded-xl border-0 outline-none resize-none leading-relaxed"
						style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px; font-family: monospace"
					></textarea>
					{#if catalogForm.text.trim() && catalogForm.id}
						{@const preview = parseCombinedText(catalogForm.text).header}
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
				{#if catalogForm.id}
					<button
						onclick={saveCatalog}
						disabled={catalogSaving || !catalogForm.text.trim()}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50 flex items-center justify-center gap-2"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>
						{#if catalogSaving}
							…
						{:else if catalogSaveOk}
							<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
						{:else}
							{t.supplement_save}
						{/if}
					</button>
				{:else}
					<button
						onclick={showPreview}
						disabled={!catalogForm.text.trim()}
						class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-80 disabled:opacity-50"
						style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
					>
						{t.admin_catalog_preview_button}
					</button>
				{/if}
			</div>
		{/if}
	</div>
{/if}

<style>
	.admin-content { padding-bottom: calc(env(safe-area-inset-bottom) + 6rem); scroll-padding-top: calc(env(safe-area-inset-top) + 6rem); }
	#benutzer { scroll-margin-top: calc(env(safe-area-inset-top) + 6rem); }
	.admin-groups { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.admin-groups > div + div { border-top: 1px solid var(--bubble-container-border); }
	.admin-list { overflow: hidden; border: 0; border-radius: 0; background: transparent; }
	.admin-brand-group + .admin-brand-group, .admin-brand-group > button + button { border-top: 1px solid var(--bubble-container-border); }
	.user-name-line { display: flex; align-items: center; flex-wrap: wrap; gap: 4px 8px; }
	.user-status { max-width: 100%; overflow-wrap: anywhere; }
	.user-list > a + a, .user-list > .admin-add-row, .catalog-search-row, .drink-list > button + button { border-top: 1px solid var(--bubble-container-border); }
	.admin-add-row { display: flex; align-items: center; gap: 12px; width: 100%; min-height: 48px; padding: 10px 16px; font-size: 14px; font-weight: 550; color: var(--color-on-surface); text-align: left; }
	.admin-add-row > span { color: var(--color-primary); font-size: 22px; line-height: 1; }
	.drink-list .admin-add-row > span { color: #C8956C; }
	.catalog-search-row { display: flex; align-items: center; gap: 12px; min-height: 48px; padding: 0 16px; color: var(--color-on-surface-variant); }
	.catalog-search-row svg { flex: none; }
	.catalog-search-row input { width: 100%; min-width: 0; min-height: 48px; outline: none; background: transparent; color: var(--color-on-surface); font-size: 16px; }
	.catalog-search-row:focus-within { background: color-mix(in srgb,var(--color-primary) 6%,transparent); }
	.drink-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 56px; padding: 8px 16px; text-align: left; color: var(--color-on-surface-variant); }
	.drink-row > span { min-width: 0; }
	.drink-row svg { flex: none; }
	.drink-name { display: block; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--color-on-surface); overflow-wrap: anywhere; }
	.drink-meta { display: block; margin-top: 2px; font-size: 12px; line-height: 16px; font-variant-numeric: tabular-nums; }
	.admin-list button:focus-visible, .admin-list a:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
	.admin-list button:active { background: var(--bubble-interactive-bg); }
	.admin-fields { min-width: 0; padding: 0; margin: 0; }
	.admin-fields .manage-settings-row { display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1.4fr); align-items: center; gap: 12px; padding-inline: 16px; }
	.admin-fields :global(.settings-select-row) { padding-inline: 16px; border-top: 1px solid var(--bubble-container-border); }
	.admin-unit-input { display: flex; align-items: center; gap: 8px; }
	.admin-sheet-hint { margin: 0 2px 10px; font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); }
	.admin-form-error { margin: 10px 2px 0; color: var(--color-error); font-size: 12px; line-height: 1.5; }
	.admin-drink-delete { display: block; width: 100%; min-height: 44px; margin-top: 8px; font-size: 14px; font-weight: 600; color: var(--color-error); }
	.admin-load-error, .admin-loading { margin: 12px 4px; font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); }
	.admin-load-error p { margin: 0; }
	.admin-load-error button { min-height: 44px; color: var(--color-primary); font-weight: 600; }
	button:disabled { opacity: 0.5; }
</style>
