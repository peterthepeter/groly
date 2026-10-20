<script lang="ts">
	import { onMount } from 'svelte';
	import { goto, invalidateAll } from '$app/navigation';
	import AppHeader from '#lib/components/AppHeader.svelte';
	import AppBottomNav from '#lib/components/AppBottomNav.svelte';
	import SettingsSelectRow from '#lib/components/SettingsSelectRow.svelte';
	import AdminInviteLink from '#lib/components/admin/AdminInviteLink.svelte';
	import { t, currentLang } from '#lib/i18n.svelte';
	let { data } = $props();
	const member = $derived(data.member);
	const memberId = $derived(member.id);
	let busy = $state(false);
	let actionError = $state('');
	let success = $state('');
	let nowSeconds = $state(Date.now() / 1000);
	let replacedInviteUrl = $state<string | null>(null);
	const invite = $derived(data.invite && data.invite.inviteUrl !== replacedInviteUrl && data.invite.expiresAt > nowSeconds ? data.invite : null);
	const inviteExpiry = $derived(member.openInviteExpiresAt);
	const inviteExpired = $derived((inviteExpiry ?? 0) <= nowSeconds);
	const status = $derived(!member.openInviteType ? t.admin_status_active : member.openInviteType === 'invite'
		? (inviteExpired ? t.admin_status_invite_expired : t.admin_status_invite_pending)
		: (inviteExpired ? t.admin_status_reset_expired : t.admin_status_reset_pending));
	$effect(() => { void memberId; actionError = ''; success = ''; replacedInviteUrl = null; });
	$effect(() => {
		const expiry = inviteExpiry;
		nowSeconds = Date.now() / 1000;
		if (!expiry || expiry * 1000 <= Date.now()) return;
		const timeout = setTimeout(() => {
			nowSeconds = Date.now() / 1000;
			void invalidateAll().catch(() => {});
		}, Math.min(2_147_483_647, expiry * 1000 - Date.now() + 25));
		return () => clearTimeout(timeout);
	});
	onMount(() => {
		const refresh = () => {
			nowSeconds = Date.now() / 1000;
			void invalidateAll().catch(() => {});
		};
		const onVisible = () => { if (!document.hidden) refresh(); };
		window.addEventListener('focus', refresh);
		document.addEventListener('visibilitychange', onVisible);
		return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', onVisible); };
	});
	function formatDate(time: number | null) {
		return time === null ? t.admin_user_never : new Date(time * 1000).toLocaleDateString(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });
	}
	async function changeRole(role: string) {
		if (busy || !data.canChangeRole || role === member.role) return;
		busy = true; actionError = ''; success = '';
		try {
			const response = await fetch(`/api/users/${member.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role }) });
			if (!response.ok) throw new Error();
			await invalidateAll(); success = t.admin_role_changed;
		} catch { actionError = t.admin_request_failed; }
		finally { busy = false; }
	}
	async function generateInvite() {
		if (busy || data.isBootstrap) return;
		busy = true; actionError = ''; success = '';
		const userId = member.id;
		try {
			const response = await fetch(`/api/users/${userId}/invite`, { method: 'POST' });
			if (!response.ok) throw new Error();
			if (userId !== member.id) return;
			replacedInviteUrl = data.invite?.inviteUrl ?? null;
			await invalidateAll();
		} catch { actionError = t.admin_request_failed; }
		finally { busy = false; }
	}
	async function deleteUser() {
		if (busy || !data.canDelete || !confirm(t.admin_confirm_delete_user)) return;
		busy = true; actionError = ''; success = '';
		try {
			const response = await fetch(`/api/users/${member.id}`, { method: 'DELETE' });
			if (!response.ok) throw new Error();
			await goto('/einstellungen/admin#benutzer');
		} catch { actionError = t.admin_request_failed; }
		finally { busy = false; }
	}
</script>

<div class="h-[100dvh] flex flex-col overflow-hidden" style="background: var(--color-bg)">
	<AppHeader title={member.username} eyebrow={t.admin_section_users} onMenuOpen={() => {}} onBack={() => goto('/einstellungen/admin#benutzer')} />
	<main class="user-content flex-1 overflow-y-auto px-4">
		<section class="user-surface" aria-label={t.admin_user_details}>
			<div class="user-heading"><span class="user-avatar" aria-hidden="true">{member.username[0].toUpperCase()}</span><div><h1>{member.username}</h1><p>{status}</p></div></div>
			<dl class="user-stats"><div><dt>{t.nav_lists}</dt><dd>{member.listCount}</dd></div><div><dt>{t.admin_user_items}</dt><dd>{member.itemCount}</dd></div><div><dt>{t.nav_recipes}</dt><dd>{member.recipeCount}</dd></div></dl>
			<dl class="user-dates"><div><dt>{t.admin_user_created}</dt><dd>{formatDate(member.createdAt)}</dd></div><div><dt>{t.admin_user_last_login}</dt><dd>{formatDate(member.lastLoginAt)}</dd></div></dl>
			{#if actionError}<p class="user-feedback error" role="alert">{actionError}</p>{/if}
			{#if success}<p class="user-feedback" role="status">{success}</p>{/if}
			<div class="user-access" role="group" aria-label={t.admin_user_access}>
				{#if data.canChangeRole}
					<fieldset disabled={busy}><SettingsSelectRow label={t.admin_role_label} value={member.role} options={[{value:'user',label:t.admin_role_user},{value:'admin',label:t.admin_role_admin}]} onchange={changeRole} /></fieldset>
				{:else}<div class="user-row"><span>{t.admin_role_label}</span><span>{member.role === 'admin' ? t.admin_role_admin : t.admin_role_user}</span></div>{/if}
				{#if data.isBootstrap}
					<div class="bootstrap-note"><h2>{t.admin_bootstrap_admin_title}</h2><p>{t.admin_bootstrap_admin_hint}</p></div>
				{:else}
					{#if invite}<AdminInviteLink {invite} embedded />
					{:else if data.legacyInvite && !inviteExpired}<p class="legacy-note">{t.admin_invite_legacy_hint}</p>{/if}
					<button class="user-row user-action" class:secondary={!!invite} type="button" disabled={busy} onclick={generateInvite}><span>{invite ? t.admin_invite_replace : member.openInviteType || !member.lastLoginAt ? t.admin_invite_generate_new : t.admin_reset_password_btn}</span><span aria-hidden="true">{busy ? '…' : '+'}</span></button>
				{/if}
			</div>
			{#if data.canDelete}<button class="user-delete" type="button" disabled={busy} onclick={deleteUser}>{t.admin_delete_user}</button>{/if}
		</section>
	</main>
</div>
<AppBottomNav activeTab="none" />

<style>
	.user-content { padding-top: calc(env(safe-area-inset-top) + 6rem); padding-bottom: calc(env(safe-area-inset-bottom) + 6rem); }
	.user-surface { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.user-heading { display: flex; align-items: center; gap: 12px; padding: 14px 16px; }
	.user-heading > div { min-width: 0; }
	.user-avatar { display: grid; place-items: center; width: 40px; height: 40px; flex: none; border-radius: 50%; background: var(--color-primary); color: var(--color-on-primary); font-weight: 650; }
	h1 { margin: 0; font-size: 16px; font-weight: 650; overflow-wrap: anywhere; color: var(--color-on-surface); }
	.user-heading p { margin: 3px 0 0; font-size: 12px; color: var(--color-on-surface-variant); }
	dl { margin: 0; }
	dt { font-size: 12px; color: var(--color-on-surface-variant); }
	dd { margin: 0; font-size: 14px; color: var(--color-on-surface); }
	.user-stats { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); padding: 0 16px 10px; gap: 12px; }
	.user-stats dd { margin-top: 3px; font-weight: 600; font-variant-numeric: tabular-nums; }
	.user-dates { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; padding: 9px 16px 11px; border-top: 1px solid var(--bubble-container-border); }
	.user-dates dt { font-size: 11px; line-height: 1.4; }
	.user-dates dd { margin-top: 3px; font-size: 12px; line-height: 1.4; font-variant-numeric: tabular-nums; }
	.user-access { border-top: 1px solid var(--bubble-container-border); }

	fieldset { margin: 0; padding: 0; border: 0; min-width: 0; }
	.user-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; min-height: 48px; padding: 10px 16px; font-size: 14px; color: var(--color-on-surface); text-align: left; }
	.user-row span:last-child { color: var(--color-on-surface-variant); }
	.user-action { border-top: 1px solid var(--bubble-container-border); }
	.user-action span:first-child { color: var(--color-primary); font-weight: 600; }
	.user-action.secondary span:first-child { color: var(--color-on-surface-variant); font-weight: 500; }
	.user-access :global(.settings-select-row) { padding-inline: 16px; }
	.bootstrap-note { padding: 14px 20px; border-top: 1px solid var(--bubble-container-border); }
	h2 { margin: 0; font-size: 14px; font-weight: 600; color: var(--color-on-surface); }
	.bootstrap-note p { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); overflow-wrap: anywhere; }
	.user-delete { display: block; width: 100%; min-height: 48px; border-top: 1px solid var(--bubble-container-border); color: var(--color-error); font-size: 14px; font-weight: 600; }
	.user-feedback { margin: 0; padding: 10px 16px; border-top: 1px solid var(--bubble-container-border); font-size: 12px; line-height: 1.5; color: var(--color-primary); }
	.legacy-note { margin: 0; padding: 12px 16px; border-top: 1px solid var(--bubble-container-border); font-size: 12px; line-height: 1.5; color: var(--color-on-surface-variant); }
	.error { color: var(--color-error); }
	button:disabled, fieldset:disabled { opacity: 0.5; }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; border-radius: 10px; }
</style>
