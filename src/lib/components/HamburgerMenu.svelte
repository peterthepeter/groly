<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { t } from '$lib/i18n.svelte';

	let { open = $bindable(false), user }: {
		open: boolean;
		user: { username: string; role: string } | null;
	} = $props();

	function close() { open = false; }

	async function logout() {
		await fetch('/api/auth/logout', { method: 'POST' });
		close();
		goto('/login');
	}

	function navigate(path: string) {
		close();
		goto(path);
	}
</script>

<!-- Backdrop -->
{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-50 transition-opacity"
		style="background-color: rgba(0,0,0,0.6)"
		onclick={close}
	></div>
{/if}

<!-- Drawer -->
<div
	class="fixed bottom-0 left-0 right-0 z-50 max-w-[430px] mx-auto rounded-t-3xl transition-transform duration-300"
	style="background-color: var(--color-surface-low); transform: translateY({open ? '0' : '100%'})"
>
	<!-- Handle -->
	<div class="flex justify-center pt-3 pb-1">
		<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
	</div>

	<!-- User Info -->
	{#if user}
		<div class="px-6 py-4 mb-2">
			<div class="flex items-center gap-3">
				<div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
				     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)">
					{user.username[0].toUpperCase()}
				</div>
				<div>
					<div class="font-semibold text-sm" style="color: var(--color-on-surface)">{user.username}</div>
					<div class="text-xs" style="color: var(--color-on-surface-variant)">{user.role === 'admin' ? t.admin_role_admin : t.admin_role_user}</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Menu Items -->
	<nav class="px-4 pb-4 space-y-1">
		<button
			onclick={() => navigate('/')}
			class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors active:opacity-70 text-left"
			style="background-color: {$page.url.pathname === '/' ? 'var(--color-surface-container)' : 'transparent'}"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
				<line x1="3" y1="6" x2="21" y2="6"/>
				<path d="M16 10a4 4 0 0 1-8 0"/>
			</svg>
			<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.nav_lists}</span>
		</button>

		{#if user?.role === 'admin'}
			<button
				onclick={() => navigate('/einstellungen/users')}
				class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors active:opacity-70 text-left"
				style="background-color: {$page.url.pathname === '/einstellungen/users' ? 'var(--color-surface-container)' : 'transparent'}"
			>
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
					<circle cx="9" cy="7" r="4"/>
					<path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
					<path d="M16 3.13a4 4 0 0 1 0 7.75"/>
				</svg>
				<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.nav_users}</span>
			</button>
		{/if}

		<button
			onclick={() => navigate('/einstellungen')}
			class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors active:opacity-70 text-left"
			style="background-color: {$page.url.pathname === '/einstellungen' ? 'var(--color-surface-container)' : 'transparent'}"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="12" cy="12" r="3"/>
				<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
			</svg>
			<span class="font-medium text-sm" style="color: var(--color-on-surface)">{t.nav_settings}</span>
		</button>

		<button
			onclick={logout}
			class="w-full flex items-center gap-4 px-4 py-3.5 rounded-xl transition-colors active:opacity-70 text-left"
		>
			<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
				<polyline points="16 17 21 12 16 7"/>
				<line x1="21" y1="12" x2="9" y2="12"/>
			</svg>
			<span class="font-medium text-sm" style="color: var(--color-error)">{t.nav_logout}</span>
		</button>
	</nav>

	<!-- Safe area padding -->
	<div class="h-safe-bottom h-6"></div>
</div>
