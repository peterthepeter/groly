<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import type { CaffeineDrink } from '$lib/db/schema';
	import CaffeineEditLogSheet from './CaffeineEditLogSheet.svelte';
	import CaffeineDrinkPickerSheet from './CaffeineDrinkPickerSheet.svelte';

	let {
		logs,
		limitMg,
		drinks,
		onlogged,
		ondeleted
	}: {
		logs: { id: string; drinkName: string; amountMl: number; caffeineMg: number; loggedAt: number }[];
		limitMg: number;
		drinks: CaffeineDrink[];
		onlogged: () => void;
		ondeleted: (id: string) => void;
	} = $props();

	let expanded = $state(false);
	let pickerOpen = $state(false);

	type EditSheet = {
		id: string;
		drinkName: string;
		amountMl: number;
		caffeineMg: number;
		defaultMl: number;
		defaultCaffeineMg: number;
		time: string;
	};
	let editSheet = $state<EditSheet | null>(null);

	const totalMg = $derived(logs.reduce((sum, l) => sum + l.caffeineMg, 0));
	const totalMl = $derived(logs.reduce((sum, l) => sum + l.amountMl, 0));
	const exceeded = $derived(totalMg > limitMg);

	// Bar goes from full (0 consumed) to empty (limit consumed)
	const remainingPercent = $derived(Math.max(0, Math.round(((limitMg - totalMg) / limitMg) * 100)));

	let animatedPercent = $state(100);
	let isMounted = $state(false);

	onMount(() => {
		requestAnimationFrame(() => requestAnimationFrame(() => {
			animatedPercent = remainingPercent;
			isMounted = true;
		}));
	});

	$effect(() => {
		if (isMounted) animatedPercent = remainingPercent;
	});

	const sortedLogs = $derived(logs.slice().sort((a, b) => a.loggedAt - b.loggedAt));

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function toHHMM(ts: number): string {
		const d = new Date(ts);
		return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
	}

	function openEdit(log: { id: string; drinkName: string; amountMl: number; caffeineMg: number; loggedAt: number }) {
		const drink = drinks.find(d => d.name === log.drinkName);
		editSheet = {
			id: log.id,
			drinkName: log.drinkName,
			amountMl: log.amountMl,
			caffeineMg: log.caffeineMg,
			defaultMl: drink?.defaultMl ?? log.amountMl,
			defaultCaffeineMg: drink?.caffeineMg ?? log.caffeineMg,
			time: toHHMM(log.loggedAt)
		};
	}
</script>

<div class="rounded-2xl px-4 py-3 flex flex-col" style="background-color: var(--color-surface-card)">

	<!-- Expanded log entries -->
	{#if expanded && sortedLogs.length > 0}
		<div class="mb-3 pb-3 border-b space-y-1.5" style="border-color: var(--color-outline-variant)">
			{#each sortedLogs as log (log.id)}
				<div class="flex items-center justify-between text-xs">
					<span style="color: var(--color-on-surface-variant)">
						<span style="color: #C8956C">{log.drinkName}</span>
						· {log.amountMl} ml · {log.caffeineMg} mg
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
							aria-label={t.caffeine_log_delete}
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

	<!-- Header row -->
	<div class="flex items-center gap-2">
		<p class="font-semibold text-sm shrink-0" style="color: var(--color-on-surface)">
			{t.caffeine_title}{#if logs.length > 0}&nbsp;<span class="font-normal opacity-50">({logs.length}×)</span>{/if}
		</p>
		<div class="flex gap-1 flex-1 justify-end">
			<button
				onclick={() => pickerOpen = true}
				class="px-2.5 py-0.5 rounded-xl text-xs font-semibold active:opacity-70 transition-opacity"
				style="background-color: var(--color-surface-container); color: #C8956C"
			>+ {t.caffeine_add}</button>
		</div>
		{#if logs.length > 0}
			<button
				onclick={() => expanded = !expanded}
				class="shrink-0 w-7 h-7 flex items-center justify-center active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? t.caffeine_collapse : t.caffeine_expand}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
				     style="transition: transform 0.2s; transform: rotate({expanded ? '-90' : '0'}deg)">
					<polyline points="9 6 15 12 9 18"/>
				</svg>
			</button>
		{/if}
	</div>

	<!-- Progress row -->
	<div class="mt-0.5">
		<div class="flex items-center gap-1.5 mb-1">
			<p class="text-xs font-semibold" style="color: {exceeded ? '#EF4444' : '#C8956C'}">
				{totalMg} / {limitMg} mg
			</p>
			{#if totalMl > 0}
				<p class="text-xs" style="color: var(--color-on-surface-variant)">· {totalMl} {t.caffeine_today_ml}</p>
			{/if}
		</div>
		<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
			<div
				class="h-full rounded-full"
				style="width: {animatedPercent}%; background: linear-gradient(90deg, rgba(200,149,108,0.35), rgba(200,149,108,0.75)); transition: width {isMounted ? '0.3s ease' : '0.9s cubic-bezier(0.25,0.46,0.45,0.94)'}"
			></div>
		</div>
		{#if exceeded}
			<p class="text-[10px] mt-0.5" style="color: #EF4444">{t.caffeine_limit_exceeded}</p>
		{/if}
	</div>
</div>

<CaffeineEditLogSheet bind:sheet={editSheet} onreload={onlogged} />
<CaffeineDrinkPickerSheet bind:open={pickerOpen} {drinks} onlogged={onlogged} />
