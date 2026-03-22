<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t, currentLang, setLang } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { CATEGORY_LABELS } from '$lib/categories';

	let { data } = $props();

	let currentPassword = $state('');
	let newPassword = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state('');
	let loading = $state(false);
	let menuOpen = $state(false);

	const mustChange = $derived($page.url.searchParams.get('mustChange') === '1');

	async function changePassword(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		success = '';

		if (newPassword !== confirmPassword) {
			error = t.settings_passwords_no_match;
			return;
		}
		if (newPassword.length < 8) {
			error = t.settings_passwords_no_match;
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
			if (mustChange) setTimeout(() => goto('/'), 1500);
		} else {
			const data = await res.json();
			error = data.error ?? t.settings_password_error;
		}
		loading = false;
	}
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.settings_title} onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pb-8 px-4" style="padding-top: calc(env(safe-area-inset-top) + 6rem)">
		{#if mustChange}
			<div class="rounded-xl px-4 py-3 mb-4 text-sm"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				{t.must_change_password}
			</div>
		{/if}

		<div class="rounded-2xl p-5 mb-3" style="background-color: var(--color-surface-card)">
			<h2 class="text-base font-bold mb-5" style="color: var(--color-on-surface)">{t.settings_change_password}</h2>

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
				<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
					<input type="password" placeholder={t.settings_new_password} bind:value={newPassword} required
					       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
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

		<!-- Language Toggle -->
		<div class="rounded-2xl p-5 mb-3" style="background-color: var(--color-surface-card)">
			<h2 class="text-base font-bold mb-4" style="color: var(--color-on-surface)">{t.language}</h2>
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

		<!-- Kategorie-Sortierung -->
		<div class="rounded-2xl p-5 mb-3" style="background-color: var(--color-surface-card)">
			<div class="flex items-center justify-between mb-4">
				<h2 class="text-base font-bold" style="color: var(--color-on-surface)">
					{currentLang() === 'en' ? 'Category sorting' : 'Kategorien sortieren'}
				</h2>
				<!-- Toggle -->
				<button
					onclick={() => userSettings.categorySortEnabled = !userSettings.categorySortEnabled}
					class="relative w-12 h-6 rounded-full overflow-hidden transition-colors"
					style="background-color: {userSettings.categorySortEnabled ? 'var(--color-primary)' : 'var(--color-surface-container)'}"
				>
					<span class="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
					      style="background-color: white; transform: translateX({userSettings.categorySortEnabled ? '1.625rem' : '0.125rem'})"></span>
				</button>
			</div>

			{#if userSettings.categorySortEnabled}
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
			{/if}
		</div>

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

<HamburgerMenu bind:open={menuOpen} user={data.user} />
