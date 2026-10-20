<script lang="ts">
	import { t, currentLang } from '#lib/i18n.svelte';
	import type { AdminInvite } from '#lib/adminUsers';
	let { invite, embedded = false }: { invite: AdminInvite; embedded?: boolean } = $props();
	let copied = $state(false);
	let copyError = $state(false);
	let linkInput: HTMLInputElement;
	$effect(() => { void invite.inviteUrl; copied = false; copyError = false; });
	async function copy() {
		copyError = false;
		try {
			const text = `${t.admin_invite_share_text}\n${invite.inviteUrl}`;
			if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(text);
			else {
				linkInput.focus(); linkInput.select();
				if (!document.execCommand('copy')) throw new Error('Clipboard unavailable');
			}
			copied = true;
		} catch { copyError = true; linkInput.focus(); linkInput.select(); }
	}
	async function share() {
		if (!navigator.share) { await copy(); return; }
		try { await navigator.share({ text: `${t.admin_invite_share_text}\n${invite.inviteUrl}` }); }
		catch (error) { if (!(error instanceof DOMException && error.name === 'AbortError')) await copy(); }
	}
</script>

<section class="invite-surface" class:embedded aria-label={invite.type === 'reset' ? t.admin_reset_link_label : t.admin_invite_link_label}>
	<div class="invite-copy">
		<div class="invite-heading"><h2>{invite.type === 'reset' ? t.admin_reset_link_label : t.admin_invite_link_label}</h2><p>{t.admin_invite_active_hint}</p></div>
		<label class="sr-only" for="admin-invite-link">{t.admin_invite_link_label}</label>
		<input id="admin-invite-link" bind:this={linkInput} readonly value={invite.inviteUrl} onclick={(event) => event.currentTarget.select()} />
		<p>{t.admin_invite_expires_at}: {new Date(invite.expiresAt * 1000).toLocaleString(currentLang() === 'de' ? 'de-DE' : 'en-US', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}</p>
		{#if copyError}<p role="status" class="copy-error">{t.admin_invite_copy_error}</p>{/if}
	</div>
	<div class="invite-actions"><button type="button" onclick={copy}>{copied ? t.admin_invite_copied : t.admin_invite_copy}</button><button type="button" onclick={share}>{t.admin_invite_share}</button></div>
</section>

<style>
	.invite-surface { overflow: hidden; border: 1px solid var(--bubble-container-border); border-radius: 16px; background: var(--bubble-container-bg); }
	.invite-surface.embedded { border: 0; border-top: 1px solid var(--bubble-container-border); border-radius: 0; background: transparent; }
	.invite-copy { padding: 10px 16px; }
	.invite-heading { display: flex; align-items: baseline; flex-wrap: wrap; gap: 2px 8px; }
	h2 { margin: 0; font-size: 14px; line-height: 20px; font-weight: 600; color: var(--color-on-surface); }
	p { margin: 4px 0 0; font-size: 11px; line-height: 16px; color: var(--color-on-surface-variant); }
	.invite-heading p { margin: 0; }
	input { width: 100%; height: 28px; min-height: 28px; margin-top: 4px; padding: 0; background: transparent; border: 0; outline: none; color: var(--color-primary); font-size: 16px; line-height: 24px; }
	input:focus-visible { outline: 2px solid var(--color-primary); outline-offset: 2px; border-radius: 4px; }
	.invite-actions { display: grid; grid-template-columns: 1fr 1fr; border-top: 1px solid var(--bubble-container-border); }
	button { min-height: 44px; font-size: 14px; font-weight: 600; color: var(--color-primary); }
	button + button { border-left: 1px solid var(--bubble-container-border); }
	button:focus-visible { outline: 2px solid var(--color-primary); outline-offset: -3px; }
	.copy-error { color: var(--color-error); }
</style>
