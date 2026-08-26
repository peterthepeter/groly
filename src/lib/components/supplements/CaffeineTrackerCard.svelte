<script lang="ts">
	import { onMount } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { formatTime } from '$lib/dates';
	import type { CaffeineDrink } from '$lib/db/schema';
	import CaffeineEditLogSheet from './CaffeineEditLogSheet.svelte';
	import CaffeineDrinkPickerSheet from './CaffeineDrinkPickerSheet.svelte';
	import CaffeineDrinkPickerContent from './CaffeineDrinkPickerContent.svelte';
	import TrackerTileShell from './TrackerTileShell.svelte';

	let {
		logs,
		limitMg,
		drinks,
		onlogged,
		ondeleted,
		embedded = false,
		tileMode = false,
		expanded = $bindable(false),
		focusMode = false,
		onfocus,
		oncollapse,
		anchorId
	}: {
		logs: { id: string; drinkName: string; amountMl: number; caffeineMg: number; loggedAt: number }[];
		limitMg: number;
		drinks: CaffeineDrink[];
		onlogged: () => void;
		ondeleted: (id: string) => void;
		embedded?: boolean;
		tileMode?: boolean;
		expanded?: boolean;
		focusMode?: boolean;
		onfocus?: () => void;
		oncollapse?: () => void;
		anchorId?: string;
	} = $props();

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

	function openLog() {
		if (onfocus) onfocus();
		else pickerOpen = true;
	}

	function handleFocusLogged() {
		onlogged();
		oncollapse?.();
	}
</script>

{#if tileMode}
	<TrackerTileShell
		{anchorId}
		accent="#C8956C"
		title={t.caffeine_title}
		expandable={!focusMode && logs.length > 0}
		expanded={focusMode || expanded}
		ontoggle={(value) => expanded = value}
		inlineExpansion={focusMode}
		{oncollapse}
		expandLabel={t.caffeine_expand}
		collapseLabel={t.caffeine_collapse}
	>
		{#snippet body()}
			{#if !focusMode}
				<div class="h-7 flex items-center">
					<button onclick={openLog} class="w-full h-7 text-center text-xs font-semibold active:opacity-70 transition-opacity touch-manipulation" style="color: #C8956C">{t.tracker_log_action}</button>
				</div>
			{/if}
			<div class="h-8 pt-1 flex flex-col justify-end">
				<div class="h-[18px] flex items-center gap-1 text-[11px] leading-none tabular-nums min-w-0" style="color: {exceeded ? '#EF4444' : '#C8956C'}">
					<span class="shrink-0">{totalMg} / {limitMg} mg</span>
					<span class="shrink-0">· {logs.length}×</span>
					{#if totalMl > 0}<span class="min-w-0 truncate" style="color: var(--color-on-surface-variant)">· {totalMl} ml</span>{/if}
				</div>
				<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
					<div class="h-full rounded-full" style="width: {animatedPercent}%; background: linear-gradient(90deg, rgba(200,149,108,0.35), rgba(200,149,108,0.75)); transition: width {isMounted ? '0.3s ease' : '0.9s cubic-bezier(0.25,0.46,0.45,0.94)'}"></div>
				</div>
			</div>
		{/snippet}
		{#snippet details()}
			{#if focusMode}
				<CaffeineDrinkPickerContent {drinks} onlogged={handleFocusLogged} />
			{:else}
				{#if exceeded}<p class="text-[10px] mb-1.5" style="color: #EF4444">{t.caffeine_limit_exceeded}</p>{/if}
				<div class="space-y-1.5">
					{#each sortedLogs as log (log.id)}
						<div class="flex items-center justify-between text-xs">
							<span class="min-w-0" style="color: var(--color-on-surface-variant)"><span style="color: #C8956C">{log.drinkName}</span> · {log.amountMl} ml · {log.caffeineMg} mg {t.supplement_log_at} {formatTime(log.loggedAt)}</span>
							<div class="flex items-center gap-0.5 shrink-0">
								<button onclick={() => openEdit(log)} class="p-1 rounded active:opacity-50" aria-label="Bearbeiten" style="color: var(--color-on-surface-variant)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>
								<button onclick={() => ondeleted(log.id)} class="p-1 rounded active:opacity-50" aria-label={t.caffeine_log_delete} style="color: var(--color-on-surface-variant)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>
							</div>
						</div>
					{/each}
				</div>
			{/if}
		{/snippet}
	</TrackerTileShell>
{:else}
<div
	class={embedded ? 'flex flex-col px-4 py-2' : 'rounded-2xl px-4 py-3 flex flex-col'}
	style={embedded ? '' : 'background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)'}
>

	<!-- Shared tile anatomy: fixed header, content, footer. -->
	<div class="flex items-center gap-2">
		<p class="font-semibold text-sm leading-tight shrink-0" style="color: var(--color-on-surface)">{t.caffeine_title}</p>
		{#if logs.length > 0}
			<button
				onclick={() => expanded = !expanded}
				class="shrink-0 w-7 h-7 ml-auto flex items-center justify-center active:opacity-60"
				style="color: var(--color-on-surface-variant)"
				aria-label={expanded ? t.caffeine_collapse : t.caffeine_expand}
			>
				<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
				     style="transition: transform 0.2s; transform: rotate({expanded ? '90' : '0'}deg)">
					<polyline points="9 6 15 12 9 18"/>
				</svg>
			</button>
		{/if}
	</div>
	<div class="flex gap-1 flex-1 justify-end">
		<button
			onclick={() => pickerOpen = true}
			class="px-2 py-0.5 text-xs font-semibold active:opacity-70 transition-opacity"
			style="color: #C8956C"
		>+ {t.caffeine_add}</button>
	</div>

	<!-- Progress row -->
	<div class="mt-0.5">
		<div class="flex items-center gap-1.5 mb-1">
			<p class="text-xs font-semibold" style="color: {exceeded ? '#EF4444' : '#C8956C'}">{totalMg} / {limitMg} mg</p>
			{#if totalMl > 0}<p class="text-xs" style="color: var(--color-on-surface-variant)">· {totalMl} {t.caffeine_today_ml}</p>{/if}
		</div>
		{#if exceeded}
			<p class="text-[10px] mb-0.5" style="color: #EF4444">{t.caffeine_limit_exceeded}</p>
		{/if}
		<div class="h-1.5 rounded-full overflow-hidden" style="background-color: var(--color-surface-container)">
			<div
				class="h-full rounded-full"
				style="width: {animatedPercent}%; background: linear-gradient(90deg, rgba(200,149,108,0.35), rgba(200,149,108,0.75)); transition: width {isMounted ? '0.3s ease' : '0.9s cubic-bezier(0.25,0.46,0.45,0.94)'}"
			></div>
		</div>
	</div>

	<!-- Expanded log entries -->
	{#if expanded && sortedLogs.length > 0}
		<div class="mt-2 pt-2 border-t space-y-1.5" style="border-color: var(--color-outline-variant)">
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
</div>
{/if}

<CaffeineEditLogSheet bind:sheet={editSheet} onreload={onlogged} />
<CaffeineDrinkPickerSheet bind:open={pickerOpen} {drinks} onlogged={onlogged} />
