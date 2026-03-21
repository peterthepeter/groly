<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';

	let { data } = $props();

	type UserEntry = { id: string; username: string; role: string; createdAt: number };

	let users = $state<UserEntry[]>([]);
	let menuOpen = $state(false);
	let showForm = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let newRole = $state<'user' | 'admin'>('user');
	let error = $state('');
	let success = $state('');

	async function loadUsers() {
		const res = await fetch('/api/users');
		if (res.ok) users = await res.json();
	}

	async function createUser(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		const res = await fetch('/api/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username: newUsername.trim(), password: newPassword, role: newRole })
		});
		if (res.ok) {
			success = `Benutzer "${newUsername}" angelegt`;
			newUsername = '';
			newPassword = '';
			newRole = 'user';
			showForm = false;
			loadUsers();
		} else {
			const data = await res.json();
			error = data.error ?? 'Fehler';
		}
	}

	onMount(loadUsers);
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title="Benutzer" onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pt-24 pb-8 px-4 space-y-3">
		{#if success}
			<div class="rounded-xl px-4 py-3 text-xs"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				{success}
			</div>
		{/if}

		<!-- User List -->
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
			{#each users as user, i (user.id)}
				<div class="flex items-center gap-3 px-4 py-3.5 {i > 0 ? 'border-t' : ''}"
				     style="border-color: var(--color-outline-variant)">
					<div class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
					     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
						{user.username[0].toUpperCase()}
					</div>
					<div class="flex-1 min-w-0">
						<div class="text-sm font-semibold truncate" style="color: var(--color-on-surface)">{user.username}</div>
						<div class="text-xs" style="color: var(--color-on-surface-variant)">{user.role === 'admin' ? 'Administrator' : 'Benutzer'}</div>
					</div>
				</div>
			{/each}
		</div>

		<!-- Add User -->
		{#if !showForm}
			<button
				onclick={() => showForm = true}
				class="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left active:opacity-70"
				style="background-color: var(--color-surface-card)"
			>
				<div class="w-9 h-9 rounded-full flex items-center justify-center"
				     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</div>
				<span class="text-sm font-medium" style="color: var(--color-on-surface)">Benutzer anlegen</span>
			</button>
		{:else}
			<div class="rounded-2xl p-5" style="background-color: var(--color-surface-card)">
				<h3 class="text-sm font-bold mb-4" style="color: var(--color-on-surface)">Neuer Benutzer</h3>
				<form onsubmit={createUser} class="space-y-3">
					{#if error}
						<div class="rounded-xl px-4 py-3 text-xs"
						     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
							{error}
						</div>
					{/if}
					<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
						<input type="text" placeholder="Benutzername" bind:value={newUsername} required
						       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
					</div>
					<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
						<input type="password" placeholder="Passwort" bind:value={newPassword} required
						       class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface)" />
					</div>
					<div class="rounded-xl px-4 py-3.5 flex items-center gap-3" style="background-color: var(--color-surface-container)">
						<span class="text-sm" style="color: var(--color-on-surface-variant)">Rolle:</span>
						<select bind:value={newRole} class="flex-1 bg-transparent outline-none text-sm" style="color: var(--color-on-surface)">
							<option value="user">Benutzer</option>
							<option value="admin">Admin</option>
						</select>
					</div>
					<div class="flex gap-3 pt-1">
						<button type="button" onclick={() => showForm = false}
						        class="flex-1 py-3.5 rounded-full text-sm font-semibold"
						        style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
							Abbrechen
						</button>
						<button type="submit"
						        class="flex-1 py-3.5 rounded-full text-sm font-semibold"
						        style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
							Anlegen
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />
