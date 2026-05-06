<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { userSettings } from '$lib/userSettings.svelte';
	import WaterEditLogSheet from './WaterEditLogSheet.svelte';
	import WaterReminderSheet from './WaterReminderSheet.svelte';

	let {
		logs,
		goalMl,
		onlogged,
		ondeleted,
		embedded = false
	}: {
		logs: { id: string; amountMl: number; loggedAt: number }[];
		goalMl: number;
		onlogged: () => void;
		ondeleted: (id: string) => void;
		embedded?: boolean;
	} = $props();

	let expanded = $state(false);
	let saving = $state(false);
	let errorMsg = $state<string | null>(null);
	let showCustomInput = $state(false);
	let customAmount = $state('');
	let editSheet = $state<{ id: string; amountMl: number; time: string } | null>(null);
	let hasReminders = $state(false);
	let reminderSheetOpen = $state(false);

	const totalMl = $derived(logs.reduce((sum, l) => sum + l.amountMl, 0));
	const progressPercent = $derived(Math.min(100, Math.round((totalMl / goalMl) * 100)));

	let animatedPercent = $state(0);
	let isMounted = $state(false);

	onMount(() => {
		requestAnimationFrame(() => requestAnimationFrame(() => {
			animatedPercent = progressPercent;
			isMounted = true;
		}));
	});

	$effect(() => {
		if (isMounted) animatedPercent = progressPercent;
	});
	const sortedLogs = $derived(logs.slice().sort((a, b) => a.loggedAt - b.loggedAt));
	const presets = $derived(userSettings.waterPresets ?? [100, 200]);

	$effect(() => {
		fetch('/api/water-reminders')
			.then(r => r.ok ? r.json() : null)
			.then(d => { if (d?.schedules?.length > 0) hasReminders = true; })
			.catch(() => {});
	});

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function toHHMM(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function openEdit(log: { id: string; amountMl: number; loggedAt: number }) {
		editSheet = { id: log.id, amountMl: log.amountMl, time: toHHMM(log.loggedAt) };
	}

	async function addWater(ml: number) {
		if (saving) return;
		saving = true;
		errorMsg = null;
		try {
			const res = await fetch('/api/water-logs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ amountMl: ml, loggedAt: Date.now() })
			});
			if (!res.ok) throw new Error();
			onlogged();
		} catch {
			errorMsg = t.water_error_offline;
			setTimeout(() => { errorMsg = null; }, 3000);
		}
		saving = false;
	}

	function submitCustom() {
		const ml = Math.round(Number(customAmount));
		if (!ml || ml <= 0) return;
		addWater(ml);
		customAmount = '';
		showCustomInput = false;
	}
</script>

<div class={embedded ? 'flex flex-col px-4 py-2' : 'rounded-2xl px-4 py-3 flex flex-col'} style={embedded ? '' : 'background-color: var(--color-surface-card)'}>

	<!-- Header row: title left, buttons right -->
	<div class="flex items-center gap-2">
		<p class="font-semibold text-sm shrink-0" style="color: var(--color-on-surface)">{t.water_title}</p>
		<!-- Quick-add buttons -->
		<div class="flex gap-1 flex-1 justify-end">
			{#each presets.slice(0, 2) as ml}
				<button
					onclick={() => addWater(ml)}
					disabled={saving}
					class="px-2.5 py-0.5 rounded-xl text-xs font-semibold active:opacity-70 disabled:opacity-50 transition-opacity"
					style="background-color: var(--color-surface-container); color: #60A5FA"
				>+{ml}</button>
			{/each}
			<button
				onclick={() => { showCustomInput = !showCustomInput; customAmount = ''; }}
				disabled={saving}
				class="px-2.5 py-0.5 rounded-xl text-xs font-semibold active:opacity-70 disabled:opacity-50 transition-opacity"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
			>{t.water_custom}</button>
		</div>
		{#if logs.length > 0}
			<button
				onclick={() => expanded = !expanded}
				class="shrink-0 w-7 h-7 flex items-center justify-center active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? t.water_collapse : t.water_expand}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
				     style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
					<polyline points="9 6 15 12 9 18"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Progress row -->
	<div class="mt-0.5">
		<div class="flex items-center gap-1.5 mb-1">
			<p class="text-xs" style="color: #60A5FA">{totalMl} / {goalMl} ml</p>
			{#if hasReminders}
				<button
					onclick={() => reminderSheetOpen = true}
					class="flex items-center justify-center active:opacity-60"
					aria-label="Erinnerungen"
					style="color: #60A5FA"
				>
					<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"/>
					</svg>
				</button>
			{/if}
		</div>
		<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
			<div
				class="h-full rounded-full"
				style="width: {animatedPercent}%; background: linear-gradient(90deg, rgba(96,165,250,0.35), rgba(96,165,250,0.75)); transition: width {isMounted ? '0.3s ease' : '0.9s cubic-bezier(0.25,0.46,0.45,0.94)'}"
			></div>
		</div>
	</div>

	<!-- Custom input -->
	{#if showCustomInput}
		<div class="flex gap-2 mt-2 items-center">
			<input
				type="number"
				inputmode="numeric"
				min="1"
				bind:value={customAmount}
				placeholder={t.water_custom_placeholder}
				class="flex-1 h-9 px-3 rounded-xl border-0 outline-none"
				style="background-color: var(--color-surface-container); color: var(--color-on-surface); font-size: 16px"
				onkeydown={(e) => { if (e.key === 'Enter') submitCustom(); }}
			/>
			<button
				onclick={submitCustom}
				disabled={saving || !customAmount || Number(customAmount) <= 0}
				class="h-9 px-4 rounded-xl text-sm font-semibold active:opacity-70 disabled:opacity-40 shrink-0"
				style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
			>{t.water_add}</button>
		</div>
	{/if}

	<!-- Error message -->
	{#if errorMsg}
		<p class="text-xs mt-1.5 text-center" style="color: var(--color-error)">{errorMsg}</p>
	{/if}

	<!-- Expanded log entries -->
	{#if expanded && sortedLogs.length > 0}
		<div class="mt-2 pt-2 border-t space-y-1.5" style="border-color: var(--color-outline-variant)">
			{#each sortedLogs as log (log.id)}
				<div class="flex items-center justify-between text-xs">
					<span style="color: var(--color-on-surface-variant)">
						<span style="color: #60A5FA">{log.amountMl} ml</span>
						{t.supplement_log_at} {formatTime(log.loggedAt)}
					</span>
					<div class="flex items-center gap-0.5 shrink-0">
						<button
							onclick={() => openEdit(log)}
							class="p-1 rounded active:opacity-50"
							aria-label="Bearbeiten"
							style="color: var(--color-on-surface-variant)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
								<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
							</svg>
						</button>
						<button
							onclick={() => ondeleted(log.id)}
							class="p-1 rounded active:opacity-50"
							aria-label={t.water_log_delete}
							style="color: var(--color-on-surface-variant)"
						>
							<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
								<polyline points="3 6 5 6 21 6"/>
								<path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
								<path d="M10 11v6"/>
								<path d="M14 11v6"/>
								<path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
							</svg>
						</button>
					</div>
				</div>
			{/each}
		</div>
	{/if}
</div>

<WaterEditLogSheet bind:sheet={editSheet} onreload={onlogged} />
<WaterReminderSheet bind:open={reminderSheetOpen} />
