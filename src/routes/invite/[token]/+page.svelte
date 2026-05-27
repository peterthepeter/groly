<script lang="ts">
	import { enhance } from '$app/forms';
	import { t, currentLang } from '$lib/i18n.svelte';
	import { getPasswordHint, validatePassword } from '$lib/password';

	let { data, form } = $props();

	let password = $state('');
	let confirm = $state('');
	let submitting = $state(false);

	const clientError = $derived.by(() => {
		if (!password && !confirm) return '';
		if (password && confirm && password !== confirm) return t.invite_password_mismatch;
		if (password) {
			const err = validatePassword(password);
			if (err) return err;
		}
		return '';
	});

	const canSubmit = $derived(
		data.status === 'valid' &&
		password.length > 0 &&
		confirm.length > 0 &&
		!clientError &&
		!submitting
	);

	function formatExpiry(ts: number): string {
		return new Date(ts * 1000).toLocaleString(currentLang() === 'de' ? 'de-DE' : 'en-US', {
			day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
		});
	}

	const serverErrorMessage = $derived.by(() => {
		if (!form?.error) return '';
		if (form.error === 'mismatch') return t.invite_password_mismatch;
		if (form.error === 'invalid') return ('message' in form ? form.message as string : '') || t.invite_password_invalid;
		if (form.error === 'expired') return t.invite_expired;
		if (form.error === 'used') return t.invite_used;
		return t.invite_unknown_error;
	});
</script>

<div class="min-h-screen flex flex-col items-center justify-center px-6 py-12"
     style="background-color: var(--color-bg)">

	<div class="mb-10 text-center">
		<div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
		     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
				<line x1="3" y1="6" x2="21" y2="6"/>
				<path d="M16 10a4 4 0 0 1-8 0"/>
			</svg>
		</div>
		<h1 class="text-4xl font-bold mb-1" style="color: var(--color-on-surface); font-family: 'Plus Jakarta Sans', sans-serif">Groly</h1>
	</div>

	<div class="w-full max-w-sm">
		{#if data.status === 'valid'}
			<div class="mb-6 text-center">
				<p class="text-xl font-semibold mb-1" style="color: var(--color-on-surface)">
					{data.type === 'reset' ? t.invite_reset_title : t.invite_welcome_title}
				</p>
				<p class="text-sm" style="color: var(--color-on-surface-variant)">
					{data.type === 'reset' ? t.invite_reset_subtitle : t.invite_welcome_subtitle}
				</p>
			</div>

			<form method="POST" use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					await update();
					submitting = false;
				};
			}} class="space-y-3">

				{#if serverErrorMessage}
					<div class="rounded-xl px-4 py-3 text-sm"
					     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
						{serverErrorMessage}
					</div>
				{/if}

				<!-- Username (read-only) -->
				<div class="rounded-xl px-4 py-3.5 flex items-center gap-3"
				     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border); opacity: 0.7">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
						<circle cx="12" cy="7" r="4"/>
					</svg>
					<input
						type="text"
						value={data.username}
						readonly
						class="flex-1 bg-transparent outline-none text-base"
						style="color: var(--color-on-surface)"
					/>
				</div>

				<!-- New password -->
				<div class="rounded-xl px-4 py-3.5 flex items-center gap-3"
				     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
					</svg>
					<input
						type="password"
						name="password"
						placeholder={t.invite_new_password}
						bind:value={password}
						autocomplete="new-password"
						required
						class="flex-1 bg-transparent outline-none text-base"
						style="color: var(--color-on-surface)"
					/>
				</div>

				<!-- Confirm -->
				<div class="rounded-xl px-4 py-3.5 flex items-center gap-3"
				     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<polyline points="20 6 9 17 4 12"/>
					</svg>
					<input
						type="password"
						name="confirm"
						placeholder={t.invite_confirm_password}
						bind:value={confirm}
						autocomplete="new-password"
						required
						class="flex-1 bg-transparent outline-none text-base"
						style="color: var(--color-on-surface)"
					/>
				</div>

				<p class="text-xs px-1" style="color: {clientError ? 'var(--color-error)' : 'var(--color-on-surface-variant)'}">
					{clientError || getPasswordHint(currentLang())}
				</p>

				<button
					type="submit"
					disabled={!canSubmit}
					class="w-full py-3.5 rounded-xl font-semibold text-base active:opacity-80 transition-opacity disabled:opacity-40"
					style="background-color: var(--color-primary); color: var(--color-on-primary)"
				>
					{submitting ? '…' : t.invite_set_password}
				</button>

				<p class="text-xs text-center pt-2" style="color: var(--color-on-surface-variant); opacity: 0.7">
					{t.invite_link_expires_at} {formatExpiry(data.expiresAt)}
				</p>
			</form>
		{:else}
			<div class="rounded-2xl px-5 py-6 text-center"
			     style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
				<div class="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
				     style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent)">
					<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--color-error)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<circle cx="12" cy="12" r="10"/>
						<line x1="12" y1="8" x2="12" y2="12"/>
						<line x1="12" y1="16" x2="12.01" y2="16"/>
					</svg>
				</div>
				<p class="text-base font-semibold mb-1" style="color: var(--color-on-surface)">
					{data.status === 'expired' ? t.invite_expired_title : data.status === 'used' ? t.invite_used_title : t.invite_unknown_title}
				</p>
				<p class="text-sm" style="color: var(--color-on-surface-variant)">
					{data.status === 'expired' ? t.invite_expired : data.status === 'used' ? t.invite_used : t.invite_unknown_error}
				</p>
			</div>
		{/if}
	</div>
</div>
