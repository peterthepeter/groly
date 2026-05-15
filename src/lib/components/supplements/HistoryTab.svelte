<script lang="ts">
	import { t, currentLang, nutrients_show_more } from '$lib/i18n.svelte';
	import { displayUnit } from '$lib/units';
	import { userSettings } from '$lib/userSettings.svelte';
	import MoodHistoryView from './MoodHistoryView.svelte';
	import type { CaffeineLog, MeditationLog } from '$lib/db/schema';

	type Log = { id: string; supplementId: string; amount: number; loggedAt: number; note?: string | null };
	type NutrientStat = { total: number; unit: string; name: string };
	type SupplementStat = { name: string; unit: string; total: number };
	type SuppEntry = { id: string; name: string; unit: string; total: number };

	let {
		loading,
		period,
		date,
		nutrients,
		supplementStats,
		logs,
		waterLogs,
		caffeineLogs,
		meditationLogs,
		onMoodReload,
		onEditLog
	}: {
		loading: boolean;
		period: 'day' | 'week' | 'month';
		date: string;
		nutrients: Record<string, NutrientStat>;
		supplementStats: Record<string, SupplementStat>;
		logs: Log[];
		waterLogs: { id: string; amountMl: number; loggedAt: number }[];
		caffeineLogs: CaffeineLog[];
		meditationLogs: MeditationLog[];
		onMoodReload: () => void;
		onEditLog: (log: Log, sup: SuppEntry) => void;
	} = $props();

	const NUTRIENTS_VISIBLE = 10;

	let supplementsCardExpanded = $state(true);
	let nutrientsCardExpanded = $state(true);
	let nutrientsExpanded = $state(false);
	let waterHistoryCardExpanded = $state(false);
	let caffeineHistoryCardExpanded = $state(false);
	let meditationHistoryCardExpanded = $state(false);
	let expandedSuppIds = $state(new Set<string>());

	// Reset per-supplement expand state when period/date changes
	$effect(() => {
		void period;
		void date;
		expandedSuppIds = new Set();
	});

	function formatTime(ts: number): string {
		return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
	}

	function formatNutrientValue(val: number): string {
		if (val >= 1000) return (val / 1000).toFixed(1).replace(/\.0$/, '') + ' g';
		if (val % 1 === 0) return val.toString();
		return val.toFixed(1);
	}

	function toMcg(total: number, unit: string): number {
		const u = unit.toLowerCase();
		if (u === 'g') return total * 1_000_000;
		if (u === 'mg') return total * 1_000;
		return total;
	}

	function toLocalDateKey(ts: number): string {
		const d = new Date(ts);
		return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
	}

	function toggleSupp(id: string) {
		const next = new Set(expandedSuppIds);
		if (next.has(id)) next.delete(id); else next.add(id);
		expandedSuppIds = next;
	}

	const logsBySuppId = $derived.by(() => {
		const map = new Map<string, Log[]>();
		for (const log of logs) {
			if (!map.has(log.supplementId)) map.set(log.supplementId, []);
			map.get(log.supplementId)!.push(log);
		}
		return map;
	});

	const nutrientEntries = $derived(
		Object.entries(nutrients).map(([, val]) => ({
			name: val.name,
			unit: val.unit,
			total: val.total
		})).sort((a, b) => toMcg(b.total, b.unit) - toMcg(a.total, a.unit))
	);
	const nutrientEntriesVisible = $derived(nutrientEntries.slice(0, NUTRIENTS_VISIBLE));
	const nutrientEntriesHidden = $derived(nutrientEntries.slice(NUTRIENTS_VISIBLE));

	const supplementStatEntries = $derived(
		Object.entries(supplementStats)
			.map(([id, val]) => ({ id, ...val }))
			.sort((a, b) => a.name.localeCompare(b.name))
	);

	const waterTotal = $derived(waterLogs.reduce((s, l) => s + l.amountMl, 0));
	const caffeineTotalMg = $derived(caffeineLogs.reduce((s, l) => s + l.caffeineMg, 0));
	const caffeineTotalMl = $derived(caffeineLogs.reduce((s, l) => s + l.amountMl, 0));
	const meditationTotalSeconds = $derived(meditationLogs.reduce((s, l) => s + l.durationSeconds, 0));

	const meditationByDay = $derived.by(() => {
		const map = new Map<string, { totalSeconds: number; sessions: { id: string; durationSeconds: number; loggedAt: number }[] }>();
		for (const log of meditationLogs) {
			const key = toLocalDateKey(log.loggedAt);
			if (!map.has(key)) map.set(key, { totalSeconds: 0, sessions: [] });
			const entry = map.get(key)!;
			entry.totalSeconds += log.durationSeconds;
			entry.sessions.push(log);
		}
		for (const entry of map.values()) entry.sessions.sort((a, b) => a.loggedAt - b.loggedAt);
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	});

	const caffeineByDay = $derived.by(() => {
		const map = new Map<string, { totalMg: number; totalMl: number; drinks: { name: string; mg: number; ml: number }[] }>();
		for (const log of caffeineLogs) {
			const key = toLocalDateKey(log.loggedAt);
			if (!map.has(key)) map.set(key, { totalMg: 0, totalMl: 0, drinks: [] });
			const entry = map.get(key)!;
			entry.totalMg += log.caffeineMg;
			entry.totalMl += log.amountMl;
			entry.drinks.push({ name: log.drinkName, mg: log.caffeineMg, ml: log.amountMl });
		}
		return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
	});
</script>

<div class="px-4 space-y-4">
	{#if loading}
		<div class="flex justify-center py-8">
			<div class="w-6 h-6 rounded-full border-2 animate-spin" style="border-color: var(--color-primary); border-top-color: transparent"></div>
		</div>
	{:else if nutrientEntries.length === 0 && supplementStatEntries.length === 0 && waterTotal === 0 && caffeineTotalMg === 0 && meditationTotalSeconds === 0 && !userSettings.moodTrackerEnabled}
		<div class="py-12 text-center">
			<p class="text-sm" style="color: var(--color-on-surface-variant)">{t.supplement_stats_empty}</p>
		</div>
	{:else if nutrientEntries.length === 0 && supplementStatEntries.length === 0 && waterTotal === 0 && caffeineTotalMg === 0 && meditationTotalSeconds === 0 && userSettings.moodTrackerEnabled}
		<MoodHistoryView onreload={onMoodReload} fixedView={period === 'day' ? 'today' : period} parentDate={date} />
	{:else}
		{#if userSettings.moodTrackerEnabled}
			<MoodHistoryView onreload={onMoodReload} fixedView={period === 'day' ? 'today' : period} parentDate={date} />
		{/if}
		<!-- Supplements taken -->
		{#if supplementStatEntries.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
				<button
					onclick={() => supplementsCardExpanded = !supplementsCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<p class="text-xs font-semibold tracking-wider" style="color: var(--color-primary)">Supplements</p>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({supplementsCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if supplementsCardExpanded}
					<div class="px-4 pb-3 space-y-1">
						{#each supplementStatEntries as sup}
							{@const suppLogs = logsBySuppId.get(sup.id) ?? []}
							{@const expandable = period !== 'month' && suppLogs.length > 0}
							{@const suppExpanded = expandedSuppIds.has(sup.id)}
							<div>
								<div class="flex justify-between items-center text-sm">
									<span style="color: var(--color-on-surface)">{sup.name}</span>
									<div class="flex items-center gap-1.5">
										<span class="font-semibold" style="color: var(--color-primary)">{sup.total} {displayUnit(sup.unit, currentLang())}</span>
										{#if expandable}
											<button
												onclick={() => toggleSupp(sup.id)}
												class="active:opacity-60"
												aria-label={suppExpanded ? 'Einklappen' : 'Aufklappen'}
											>
												<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
												     style="transition: transform 0.2s; transform: rotate({suppExpanded ? '90' : '0'}deg)">
													<polyline points="9 6 15 12 9 18"/>
												</svg>
											</button>
										{/if}
									</div>
								</div>
								{#if expandable && suppExpanded}
									<div class="mt-1.5 space-y-1.5 pt-1.5 border-t" style="border-color: var(--color-outline-variant)">
										{#each suppLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											<div class="flex items-start gap-2 text-xs">
												<div class="flex-1 min-w-0">
													<span class="tabular-nums" style="color: var(--color-on-surface-variant)">
														{#if period === 'week'}
															{new Date(log.loggedAt).toLocaleDateString([], { weekday: 'short', day: 'numeric' })}
														{/if}
														{formatTime(log.loggedAt)} ·
													</span>
													<span class="font-medium" style="color: var(--color-primary)">{log.amount} {displayUnit(sup.unit, currentLang())}</span>
													{#if log.note}
														<span class="italic ml-1" style="color: var(--color-on-surface-variant)">{log.note}</span>
													{/if}
												</div>
												<button
													onclick={() => onEditLog(log, sup)}
													class="shrink-0 p-1 rounded active:opacity-50"
													aria-label="Bearbeiten"
													style="color: var(--color-on-surface-variant)"
												>
													<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
														<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
														<path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
													</svg>
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</div>
		{/if}

		<!-- Nutrients -->
		{#if nutrientEntries.length > 0}
			<div class="rounded-2xl overflow-hidden" style="background-color: var(--color-surface-card)">
				<button
					onclick={() => nutrientsCardExpanded = !nutrientsCardExpanded}
					class="w-full flex items-center justify-between px-4 py-3 active:opacity-60"
				>
					<p class="text-xs font-semibold tracking-wider" style="color: var(--color-primary)">{t.supplement_stats_nutrients}</p>
					<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
					     style="transition: transform 0.2s; transform: rotate({nutrientsCardExpanded ? '90' : '0'}deg)">
						<polyline points="9 6 15 12 9 18"/>
					</svg>
				</button>
				{#if nutrientsCardExpanded}
					<div class="px-4 pb-3 space-y-1">
						{#each nutrientEntriesVisible as entry}
							<div class="flex justify-between items-center text-sm">
								<span style="color: var(--color-on-surface)">{entry.name}</span>
								<span class="font-semibold" style="color: var(--color-primary)">{formatNutrientValue(entry.total)} {entry.unit}</span>
							</div>
						{/each}
						{#if nutrientsExpanded}
							{#each nutrientEntriesHidden as entry}
								<div class="flex justify-between items-center text-sm">
									<span style="color: var(--color-on-surface)">{entry.name}</span>
									<span class="font-semibold" style="color: var(--color-primary)">{formatNutrientValue(entry.total)} {entry.unit}</span>
								</div>
							{/each}
						{/if}
					</div>
					{#if nutrientEntriesHidden.length > 0}
						<button
							onclick={() => nutrientsExpanded = !nutrientsExpanded}
							class="mt-3 w-full text-xs font-medium py-1.5 rounded-xl active:opacity-60 transition-opacity"
							style="color: var(--color-on-surface-variant); background-color: var(--color-surface-container)"
						>
							{nutrientsExpanded ? t.supplement_stats_show_less : nutrients_show_more(nutrientEntriesHidden.length)}
						</button>
					{/if}
				{/if}
			</div>
		{/if}

		{@const visibleHistoryTrackers = [
			userSettings.caffeineTrackerEnabled && caffeineTotalMg > 0 ? 'caffeine' : null,
			userSettings.meditationTrackerEnabled && meditationTotalSeconds > 0 ? 'meditation' : null,
			userSettings.waterTrackerEnabled && period === 'day' && waterTotal > 0 ? 'water' : null,
		].filter(Boolean)}
		{#if visibleHistoryTrackers.length > 0}
			<div class="rounded-2xl px-4 py-3" style="background-color: var(--color-surface-card)">
				<button
					onclick={() => {}}
					class="w-full flex items-center justify-between mb-2 active:opacity-60 cursor-default"
				>
					<p class="text-xs font-semibold tracking-wider" style="color: var(--color-primary)">Tracker</p>
				</button>
				<div class="space-y-2.5">
					<!-- Caffeine -->
					{#if userSettings.caffeineTrackerEnabled && caffeineTotalMg > 0}
						<div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-baseline gap-1.5 min-w-0 flex-1">
									<span class="font-semibold shrink-0" style="color: #C8956C">{t.caffeine_title}</span>
									<span class="text-xs truncate" style="color: var(--color-on-surface-variant)">
										{caffeineTotalMl} ml{period !== 'day' ? ` · ${caffeineLogs.length}×` : ''}
									</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: {caffeineTotalMg > (userSettings.caffeineLimitMg ?? 400) && period === 'day' ? '#EF4444' : '#C8956C'}">
										{caffeineTotalMg}{period === 'day' ? ` / ${userSettings.caffeineLimitMg ?? 400}` : ''} mg
									</span>
									<button onclick={() => caffeineHistoryCardExpanded = !caffeineHistoryCardExpanded} class="active:opacity-60" aria-label={caffeineHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({caffeineHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							{#if caffeineHistoryCardExpanded}
								{#if period === 'day'}
									<div class="space-y-1 mt-1.5">
										{#each caffeineLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">{log.drinkName} · {new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
												<span class="font-semibold" style="color: #C8956C">{log.caffeineMg} mg</span>
											</div>
										{/each}
									</div>
								{:else if period === 'week'}
									<div class="space-y-2 mt-1.5">
										{#each caffeineByDay as [dateKey, dayData]}
											<div>
												<div class="flex justify-between items-center mb-0.5">
													<span class="text-xs font-semibold" style="color: var(--color-on-surface-variant)">
														{new Date(dateKey + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
													</span>
													<span class="text-xs font-semibold" style="color: #C8956C">{dayData.totalMg} mg</span>
												</div>
												<div class="space-y-0.5">
													{#each dayData.drinks as drink}
														<div class="flex justify-between items-center text-xs">
															<span style="color: var(--color-on-surface)">{drink.name} · {drink.ml} ml</span>
															<span style="color: var(--color-on-surface-variant)">{drink.mg} mg</span>
														</div>
													{/each}
												</div>
											</div>
										{/each}
									</div>
								{:else}
									{@const drinkCounts = [...caffeineLogs.reduce((m, l) => (m.set(l.drinkName, (m.get(l.drinkName) ?? 0) + 1), m), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1])}
									<div class="space-y-1 mt-1.5">
										{#each drinkCounts as [name, count]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">{name}</span>
												<span style="color: var(--color-on-surface-variant)">{count}×</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Meditation -->
					{#if userSettings.meditationTrackerEnabled && meditationTotalSeconds > 0}
						<div>
							<div class="flex items-center justify-between text-sm">
								<div class="flex items-baseline gap-1.5 min-w-0 flex-1">
									<span class="font-semibold shrink-0" style="color: #9F7AEA">{t.meditation_title}</span>
									<span class="text-xs" style="color: var(--color-on-surface-variant)">{meditationLogs.length}×</span>
								</div>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: #9F7AEA">{Math.floor(meditationTotalSeconds / 60)} min</span>
									<button onclick={() => meditationHistoryCardExpanded = !meditationHistoryCardExpanded} class="active:opacity-60" aria-label={meditationHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({meditationHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							{#if meditationHistoryCardExpanded}
								{#if period === 'day'}
									<div class="space-y-1 mt-1.5">
										{#each meditationLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
											{@const endTs = log.loggedAt}
											{@const startTs = endTs - log.durationSeconds * 1000}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">
													{new Date(startTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} – {new Date(endTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</span>
												<span class="font-semibold" style="color: #9F7AEA">{Math.round(log.durationSeconds / 60)} min</span>
											</div>
										{/each}
									</div>
								{:else if period === 'week'}
									<div class="space-y-1 mt-1.5">
										{#each meditationByDay as [dateKey, dayData]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">
													{new Date(dateKey + 'T12:00:00').toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
												</span>
												<span class="font-semibold" style="color: #9F7AEA">{Math.floor(dayData.totalSeconds / 60)} min</span>
											</div>
										{/each}
									</div>
								{:else}
									{@const durationCounts = [...meditationLogs.reduce((m, l) => { const min = Math.round(l.durationSeconds / 60); m.set(min, (m.get(min) ?? 0) + 1); return m; }, new Map<number, number>()).entries()].sort((a, b) => b[1] - a[1])}
									<div class="space-y-1 mt-1.5">
										{#each durationCounts as [min, count]}
											<div class="flex justify-between items-center text-xs">
												<span style="color: var(--color-on-surface)">{min} min</span>
												<span style="color: var(--color-on-surface-variant)">{count}×</span>
											</div>
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/if}
					<!-- Water -->
					{#if userSettings.waterTrackerEnabled && period === 'day' && waterTotal > 0}
						<div>
							<div class="flex items-center justify-between text-sm">
								<span class="font-semibold" style="color: #60A5FA">{t.water_title}</span>
								<div class="flex items-center gap-1.5 shrink-0">
									<span class="font-semibold" style="color: #60A5FA">{waterTotal} / {userSettings.waterGoalMl ?? 2500} ml</span>
									<button onclick={() => waterHistoryCardExpanded = !waterHistoryCardExpanded} class="active:opacity-60" aria-label={waterHistoryCardExpanded ? 'Einklappen' : 'Aufklappen'}>
										<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-surface-variant)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
										     style="transition: transform 0.2s; transform: rotate({waterHistoryCardExpanded ? '90' : '0'}deg)">
											<polyline points="9 6 15 12 9 18"/>
										</svg>
									</button>
								</div>
							</div>
							{#if waterHistoryCardExpanded}
								<div class="space-y-1 mt-1.5">
									{#each waterLogs.slice().sort((a, b) => a.loggedAt - b.loggedAt) as log}
										<div class="flex justify-between items-center text-xs">
											<span style="color: var(--color-on-surface)">{new Date(log.loggedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
											<span class="font-semibold" style="color: #60A5FA">{log.amountMl} ml</span>
										</div>
									{/each}
								</div>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}
	{/if}
</div>
