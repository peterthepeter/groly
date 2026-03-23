<script lang="ts">
	import { onMount } from 'svelte';
	import AppHeader from '$lib/components/AppHeader.svelte';
	import HamburgerMenu from '$lib/components/HamburgerMenu.svelte';
	import { t } from '$lib/i18n.svelte';
	import { validatePassword, PASSWORD_HINT } from '$lib/password';

	let { data } = $props();

	type UserEntry = { id: string; username: string; role: string; createdAt: number; lastLoginAt: number | null; listCount: number; itemCount: number };

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

	let users = $state<UserEntry[]>([]);
	let menuOpen = $state(false);
	let showCreateForm = $state(false);
	let newUsername = $state('');
	let newPassword = $state('');
	let newRole = $state<'user' | 'admin'>('user');
	let error = $state('');
	let success = $state('');

	// Edit modal state
	let editUser = $state<UserEntry | null>(null);
	let editPassword = $state('');
	let editError = $state('');
	let editSuccess = $state('');

	const bootstrapId = $derived(
		users.length > 0 ? [...users].sort((a, b) => a.createdAt - b.createdAt)[0].id : null
	);
	const adminCount = $derived(users.filter(u => u.role === 'admin').length);

	function canDelete(user: UserEntry): boolean {
		if (user.id === data.user?.id) return false; // cannot delete self
		if (user.id === bootstrapId) return false; // cannot delete bootstrap
		if (user.role === 'admin' && adminCount <= 1) return false; // last admin
		return true;
	}

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
			success = t.admin_user_created;
			newUsername = '';
			newPassword = '';
			newRole = 'user';
			showCreateForm = false;
			loadUsers();
		} else {
			const d = await res.json();
			error = d.error ?? 'Fehler';
		}
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

	onMount(loadUsers);
</script>

<div class="h-screen flex flex-col overflow-hidden" style="background-color: var(--color-bg)">
	<AppHeader title={t.admin_users_title} onMenuOpen={() => menuOpen = true} />

	<div class="flex-1 overflow-y-auto pb-8 px-4 space-y-3" style="padding-top: calc(env(safe-area-inset-top) + 6rem)">
		{#if success}
			<div class="rounded-xl px-4 py-3 text-sm"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				{success}
			</div>
		{/if}

		<!-- User List -->
		<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
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
							· {user.listCount} {user.listCount === 1 ? 'Liste' : 'Listen'}, {user.itemCount} Items
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

		<!-- Add User -->
		{#if !showCreateForm}
			<button
				onclick={() => showCreateForm = true}
				class="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-left active:opacity-70"
				style="background-color: var(--color-surface-card)"
			>
				<div class="w-9 h-9 rounded-full flex items-center justify-center"
				     style="background-color: color-mix(in srgb, var(--color-primary) 15%, transparent)">
					<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2.5" stroke-linecap="round">
						<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
					</svg>
				</div>
				<span class="text-sm font-medium" style="color: var(--color-on-surface)">{t.admin_add_user}</span>
			</button>
		{:else}
			<div class="rounded-2xl p-5" style="background-color: var(--color-surface-card)">
				<h3 class="text-sm font-bold mb-4" style="color: var(--color-on-surface)">{t.admin_add_user}</h3>
				<form onsubmit={createUser} class="space-y-3">
					{#if error}
						<div class="rounded-xl px-4 py-3 text-sm"
						     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
							{error}
						</div>
					{/if}
					<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
						<input type="text" placeholder={t.admin_username_label} bind:value={newUsername} required
						       class="w-full bg-transparent outline-none text-base" style="color: var(--color-on-surface)" />
					</div>
					<div>
						<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
							<input type="password" placeholder={t.admin_password_label} bind:value={newPassword} required
							       class="w-full bg-transparent outline-none text-base" style="color: var(--color-on-surface)" />
						</div>
						<p class="text-[11px] mt-1.5 px-1" style="color: var(--color-on-surface-variant)">{PASSWORD_HINT}</p>
					</div>
					<div class="rounded-xl px-4 py-3.5 flex items-center gap-3" style="background-color: var(--color-surface-container)">
						<span class="text-sm" style="color: var(--color-on-surface-variant)">{t.admin_role_label}:</span>
						<select bind:value={newRole} class="flex-1 bg-transparent outline-none text-base" style="color: var(--color-on-surface)">
							<option value="user">{t.admin_role_user}</option>
							<option value="admin">{t.admin_role_admin}</option>
						</select>
					</div>
					<div class="flex gap-3 pt-1">
						<button type="button" onclick={() => showCreateForm = false}
						        class="flex-1 py-3.5 rounded-full text-sm font-semibold"
						        style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)">
							{t.list_cancel}
						</button>
						<button type="submit"
						        class="flex-1 py-3.5 rounded-full text-sm font-semibold"
						        style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
							{t.create}
						</button>
					</div>
				</form>
			</div>
		{/if}
	</div>
</div>

<HamburgerMenu bind:open={menuOpen} user={data.user} />

<!-- Edit User Bottom Sheet -->
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
			<div class="rounded-xl px-4 py-3 text-sm mb-3"
			     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
				{editError}
			</div>
		{/if}
		{#if editSuccess}
			<div class="rounded-xl px-4 py-3 text-sm mb-3"
			     style="background-color: color-mix(in srgb, var(--color-primary) 12%, transparent); color: var(--color-primary)">
				{editSuccess}
			</div>
		{/if}

		<!-- Password change -->
		<div class="mb-3">
			<div class="rounded-xl px-4 py-3.5" style="background-color: var(--color-surface-container)">
				<input
					type="password"
					placeholder={t.admin_new_password_label}
					bind:value={editPassword}
					class="w-full bg-transparent outline-none text-base"
					style="color: var(--color-on-surface)"
				/>
			</div>
			<p class="text-[11px] mt-1.5 px-1" style="color: var(--color-on-surface-variant)">{PASSWORD_HINT}</p>
		</div>

		<div class="flex gap-3">
			{#if canDelete(editUser)}
				<button
					onclick={deleteUser}
					class="px-4 py-3.5 rounded-full text-sm font-semibold"
					style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)"
				>
					{t.admin_delete_user}
				</button>
			{/if}
			<button
				onclick={() => editUser = null}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>
				{t.list_cancel}
			</button>
			<button
				onclick={savePassword}
				disabled={!!validatePassword(editPassword)}
				class="flex-1 py-3.5 rounded-full text-sm font-semibold disabled:opacity-40"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{t.list_save}
			</button>
		</div>
	</div>
{/if}
