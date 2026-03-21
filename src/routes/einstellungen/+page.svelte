<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';

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
			error = 'Passwörter stimmen nicht überein';
			return;
		}
		if (newPassword.length < 8) {
			error = 'Passwort muss mindestens 8 Zeichen haben';
			return;
		}

		loading = true;
		const res = await fetch('/api/users/me', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentPassword, newPassword })
		});

		if (res.ok) {
			success = 'Passwort erfolgreich geändert';
			currentPassword = '';
			newPassword = '';
			confirmPassword = '';
			if (mustChange) goto('/');
		} else {
			const data = await res.json();
			error = data.error ?? 'Fehler';
		}
		loading = false;
	}
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title="Einstellungen" onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pt-24 pb-8 px-4">
		{#if mustChange}
			<div class="rounded-xl px-4 py-3 mb-4 text-sm"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				Bitte ändere dein Passwort beim ersten Login
			</div>
		{/if}

		<div class="rounded-2xl p-5" style="background-color: var(--color-surface-card)">
			<h2 class="text-base font-bold mb-5" style="color: var(--color-on-surface)">Passwort ändern</h2>

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
					<input type="password" placeholder="Aktuelles Passwort" bind:value={currentPassword} required
					       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
				</div>
				<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
					<input type="password" placeholder="Neues Passwort" bind:value={newPassword} required
					       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
				</div>
				<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
					<input type="password" placeholder="Passwort bestätigen" bind:value={confirmPassword} required
					       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
				</div>

				<button
					type="submit"
					disabled={loading}
					class="w-full py-3.5 rounded-full text-sm font-semibold mt-2 disabled:opacity-50"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>
					{loading ? 'Speichern...' : 'Passwort speichern'}
				</button>
			</form>
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
				<span class="font-medium text-sm" style="color: var(--color-on-surface)">Benutzer verwalten</span>
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-outline)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ml-auto">
					<polyline points="9 18 15 12 9 6"/>
				</svg>
			</a>
		{/if}
	</div>
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
