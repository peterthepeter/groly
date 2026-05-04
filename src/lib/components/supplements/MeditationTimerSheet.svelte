<script lang="ts">
	import { onDestroy } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import { playMeditationSound, preloadMeditationSounds } from '$lib/audio/meditationAudio';
	import { acquireWakeLock, releaseWakeLock } from '$lib/wakeLock';

	let {
		open = $bindable<boolean>(false),
		durationMinutes = 10,
		onsaved
	}: {
		open: boolean;
		durationMinutes: number;
		onsaved: () => void;
	} = $props();

	type Phase = 'prep' | 'meditation' | 'done';
	let phase = $state<Phase>('prep');
	let totalSeconds = $state(0);
	let startedAt = $state(0);
	let endsAt = $state(0);
	let now = $state(Date.now());
	let intervalId: ReturnType<typeof setInterval> | null = null;
	let onZeroFn: (() => void) | null = null;
	let confirmStop = $state(false);
	let savedFlash = $state(false);

	const CIRCLE_R = 130;
	const CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;
	const remainingSeconds = $derived(Math.max(0, Math.ceil((endsAt - now) / 1000)));
	const elapsedSeconds = $derived(Math.max(0, Math.min(totalSeconds, Math.floor((now - startedAt) / 1000))));
	const progress = $derived(totalSeconds > 0 ? remainingSeconds / totalSeconds : 0);
	const dashOffset = $derived(CIRCUMFERENCE * (1 - progress));

	$effect(() => {
		if (open) {
			start();
			if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisibility);
		} else {
			cleanup();
		}
	});

	function formatTime(seconds: number): string {
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
	}

	function start() {
		// Wake Lock first (still within user-gesture activation window)
		acquireWakeLock();
		preloadMeditationSounds([userSettings.meditationStartSound, userSettings.meditationEndSound]);

		const prep = userSettings.meditationPrepSeconds ?? 20;
		if (prep > 0) {
			phase = 'prep';
			startCountdown(prep, beginMeditation);
		} else {
			beginMeditation();
		}
	}

	function onVisibility() {
		if (typeof document === 'undefined') return;
		if (document.visibilityState === 'visible' && (phase === 'prep' || phase === 'meditation')) {
			// iOS releases the wake lock when the page becomes hidden — reacquire on resume
			acquireWakeLock();
			// Catch up: if endsAt passed during standby, fire onZero immediately
			tick();
		}
	}

	function beginMeditation() {
		phase = 'meditation';
		playMeditationSound(userSettings.meditationStartSound, userSettings.meditationVolume ?? 70);
		startCountdown(durationMinutes * 60, () => finish(true));
	}

	function startCountdown(seconds: number, onZero: () => void) {
		if (intervalId) clearInterval(intervalId);
		totalSeconds = seconds;
		startedAt = Date.now();
		endsAt = startedAt + seconds * 1000;
		now = startedAt;
		onZeroFn = onZero;
		intervalId = setInterval(tick, 250);
	}

	function tick() {
		now = Date.now();
		if (now >= endsAt && onZeroFn) {
			if (intervalId) { clearInterval(intervalId); intervalId = null; }
			const fn = onZeroFn;
			onZeroFn = null;
			fn();
		}
	}

	async function finish(naturalEnd: boolean) {
		if (intervalId) { clearInterval(intervalId); intervalId = null; }
		onZeroFn = null;
		if (naturalEnd) {
			playMeditationSound(userSettings.meditationEndSound, userSettings.meditationVolume ?? 70);
		}
		if (phase === 'meditation') {
			const seconds = naturalEnd ? totalSeconds : elapsedSeconds;
			if (seconds >= 1) {
				try {
					await fetch('/api/meditation-logs', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ durationSeconds: seconds, loggedAt: Date.now() })
					});
					savedFlash = true;
				} catch { /* offline: TODO queue mutation in v2 */ }
			}
		}
		phase = 'done';
		await new Promise(r => setTimeout(r, 1500));
		close();
	}

	function requestStop() {
		if (phase === 'prep') {
			close();
			return;
		}
		confirmStop = true;
	}

	function continueMeditation() {
		confirmStop = false;
	}

	function endMeditation() {
		confirmStop = false;
		finish(false);
	}

	function close() {
		open = false;
		if (savedFlash) onsaved();
	}

	function cleanup() {
		if (intervalId) { clearInterval(intervalId); intervalId = null; }
		if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisibility);
		releaseWakeLock();
		confirmStop = false;
		savedFlash = false;
	}

	onDestroy(cleanup);
</script>

{#if open}
	<div class="fixed inset-0 z-[60] flex items-center justify-center" style="background-color: #000">

		<!-- Top: Close button (during prep, otherwise tap-to-stop) -->
		{#if phase === 'prep'}
			<button
				onclick={requestStop}
				class="absolute right-6 w-10 h-10 flex items-center justify-center rounded-full active:opacity-60"
				style="top: calc(env(safe-area-inset-top) + 0.75rem); color: rgba(255,255,255,0.7); background-color: rgba(255,255,255,0.08)"
				aria-label="Schließen"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
					<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
				</svg>
			</button>
		{/if}

		<!-- Tap area for stop confirmation during meditation -->
		{#if phase === 'meditation' && !confirmStop}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="absolute inset-0" onclick={requestStop}></div>
		{/if}

		<!-- Prep phase -->
		{#if phase === 'prep'}
			<div class="flex flex-col items-center gap-4">
				<p class="text-base tracking-wide uppercase" style="color: rgba(255,255,255,0.5)">{t.meditation_prepare}</p>
				<p class="text-7xl font-light tabular-nums" style="color: rgba(255,255,255,0.95)">{remainingSeconds}</p>
			</div>
		{/if}

		<!-- Meditation phase -->
		{#if phase === 'meditation'}
			<div class="relative flex items-center justify-center pointer-events-none">
				<svg width="320" height="320" viewBox="-160 -160 320 320">
					<circle cx="0" cy="0" r={CIRCLE_R} fill="none" stroke="rgba(159,122,234,0.15)" stroke-width="2"/>
					<circle
						cx="0" cy="0" r={CIRCLE_R}
						fill="none" stroke="#9F7AEA" stroke-width="3"
						stroke-linecap="round"
						stroke-dasharray={CIRCUMFERENCE}
						stroke-dashoffset={dashOffset}
						transform="rotate(-90)"
						style="transition: stroke-dashoffset 1s linear"
					/>
				</svg>
				<div class="absolute text-6xl font-light tabular-nums" style="color: rgba(255,255,255,0.95)">
					{formatTime(remainingSeconds)}
				</div>
			</div>
		{/if}

		<!-- Done flash -->
		{#if phase === 'done'}
			<div class="flex flex-col items-center gap-3">
				<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<polyline points="20 6 9 17 4 12"/>
				</svg>
				<p class="text-lg font-light" style="color: rgba(255,255,255,0.9)">{t.meditation_session_saved}</p>
			</div>
		{/if}

		<!-- Stop confirmation -->
		{#if confirmStop}
			<!-- svelte-ignore a11y_click_events_have_key_events -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div class="absolute inset-0 flex items-center justify-center" style="background-color: rgba(0,0,0,0.8)">
				<div class="rounded-3xl p-6 mx-6 max-w-xs w-full space-y-4" style="background-color: var(--color-surface-low)">
					<p class="font-semibold text-base text-center" style="color: var(--color-on-surface)">{t.meditation_stop_confirm_title}</p>
					<div class="flex flex-col gap-2">
						<button
							onclick={continueMeditation}
							class="py-3 rounded-2xl text-sm font-semibold active:opacity-80"
							style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
						>{t.meditation_stop_confirm_continue}</button>
						<button
							onclick={endMeditation}
							class="py-3 rounded-2xl text-sm font-semibold active:opacity-70"
							style="background-color: var(--color-surface-container); color: var(--color-error)"
						>{t.meditation_stop_confirm_end}</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
{/if}
