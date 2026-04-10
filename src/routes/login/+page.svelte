<script lang="ts">
	import { goto } from '$app/navigation';
	import { t } from '$lib/i18n.svelte';

	import { onMount } from 'svelte';

	let { data } = $props();

	// svelte-ignore state_referenced_locally
	let username = $state(data.prefillUsername);
	let showHttpWarning = $state(false);

	onMount(() => {
		if (
			window.location.protocol === 'http:' &&
			!['localhost', '127.0.0.1'].includes(window.location.hostname)
		) {
			showHttpWarning = true;
		}
	});
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin(e: SubmitEvent) {
		e.preventDefault();
		loading = true;
		error = '';

		const res = await fetch('/api/auth/login', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ username, password })
		});

		if (res.ok) {
			const data = await res.json();
			goto(data.mustChangePassword ? '/einstellungen?mustChange=1' : '/');
		} else {
			const data = await res.json();
			error = data.error ?? t.login_error;
		}
		loading = false;
	}
</script>

{#if showHttpWarning}
<div class="flex items-start gap-3 px-4 py-3"
     style="background-color: rgba(245,158,11,0.15); border-bottom: 1px solid rgba(245,158,11,0.3);"
     role="alert">
	<span style="font-size: 15px; line-height: 1.5; flex: 1; color: #f59e0b;">
		⚠️ You're accessing Groly over HTTP. Offline mode, push notifications, barcode scanner, and PWA installation require HTTPS.
	</span>
	<button
		onclick={() => showHttpWarning = false}
		aria-label="Dismiss"
		style="color: #f59e0b; opacity: 0.7; font-size: 18px; line-height: 1; flex-shrink: 0; padding: 2px 4px;"
	>✕</button>
</div>
{/if}

<div class="min-h-screen flex flex-col items-center justify-center px-6 py-12"
     style="background-color: var(--color-bg)">

	<!-- Logo -->
	<div class="mb-12 text-center">
		<div class="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6"
		     style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim))">
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
				<line x1="3" y1="6" x2="21" y2="6"/>
				<path d="M16 10a4 4 0 0 1-8 0"/>
			</svg>
		</div>
		<h1 class="text-4xl font-bold mb-1" style="color: var(--color-on-surface); font-family: 'Plus Jakarta Sans', sans-serif">Groly</h1>
		<p style="color: var(--color-on-surface-variant)">{t.login_subtitle}</p>
	</div>

	<!-- Login Card -->
	<div class="w-full max-w-sm">
		<form onsubmit={handleLogin} class="space-y-4">

			{#if error}
				<div class="rounded-xl px-4 py-3 text-sm" style="background-color: color-mix(in srgb, var(--color-error) 15%, transparent); color: var(--color-error)">
					{error}
				</div>
			{/if}

			<div class="space-y-3">
				<div class="rounded-xl px-4 py-3.5 flex items-center gap-3"
				     style="background-color: var(--color-surface-container)">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
						<circle cx="12" cy="7" r="4"/>
					</svg>
					<input
						type="text"
						placeholder={t.login_username}
						bind:value={username}
						autocomplete="username"
						autocapitalize="none"
						required
						class="flex-1 bg-transparent outline-none text-base"
						style="color: var(--color-on-surface)"
					/>
				</div>

				<div class="rounded-xl px-4 py-3.5 flex items-center gap-3"
				     style="background-color: var(--color-surface-container)">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
						<path d="M7 11V7a5 5 0 0 1 10 0v4"/>
					</svg>
					<input
						type="password"
						placeholder={t.login_password}
						bind:value={password}
						autocomplete="current-password"
						required
						class="flex-1 bg-transparent outline-none text-base"
						style="color: var(--color-on-surface)"
					/>
				</div>
			</div>

			<button
				type="submit"
				disabled={loading}
				class="w-full rounded-full py-4 font-semibold text-sm transition-opacity active:opacity-75 disabled:opacity-50"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>
				{loading ? '...' : t.login_button}
			</button>
		</form>
	</div>
</div>
