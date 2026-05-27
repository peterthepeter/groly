<script lang="ts">
	import { untrack } from 'svelte';
	import { t } from '$lib/i18n.svelte';
	import { todayKey, tsToDateKey } from '$lib/dates';
	import type { ReportSections } from '$lib/pdfExport';

	type Period = '7' | '30' | '90' | 'current' | 'custom';

	let {
		open = $bindable(false),
		currentRange,
		defaultName = '',
		onConfirm
	}: {
		open: boolean;
		currentRange: { from: number; to: number };
		defaultName?: string;
		onConfirm: (opts: {
			from: number;
			to: number;
			name: string;
			sections: ReportSections;
		}) => void | Promise<void>;
	} = $props();

	function isoToTs(date: string, endOfDay = false): number {
		const d = new Date(date + (endOfDay ? 'T23:59:59' : 'T00:00:00'));
		return d.getTime();
	}

	let period = $state<Period>('30');
	let customFrom = $state(untrack(() => tsToDateKey(currentRange.from || Date.now() - 30 * 86_400_000)));
	let customTo = $state(untrack(() => tsToDateKey(currentRange.to || Date.now())));
	let name = $state(untrack(() => defaultName));
	let sections = $state<ReportSections>({
		supplements: true,
		dailyOverview: true,
		currentSchedule: true,
		trackers: true,
		mood: true,
		moodDetails: false,
		moodGratitude: false,
		nutrients: true
	});
	let exporting = $state(false);

	// Reset when sheet opens
	$effect(() => {
		if (open) {
			exporting = false;
			if (currentRange.from > 0) customFrom = tsToDateKey(currentRange.from);
			if (currentRange.to > 0) customTo = tsToDateKey(currentRange.to);
		}
	});

	function presetRange(days: number): { from: number; to: number } {
		// Last N days inclusive of today: from = start of (today - N + 1), to = end of today
		const today = new Date();
		today.setHours(0, 0, 0, 0);
		const start = new Date(today);
		start.setDate(start.getDate() - (days - 1));
		const end = new Date(today);
		end.setHours(23, 59, 59, 999);
		return { from: start.getTime(), to: end.getTime() };
	}

	function computeRange(): { from: number; to: number } {
		if (period === '7') return presetRange(7);
		if (period === '30') return presetRange(30);
		if (period === '90') return presetRange(90);
		if (period === 'custom') return { from: isoToTs(customFrom), to: isoToTs(customTo, true) };
		return currentRange; // 'current'
	}

	async function handleExport() {
		if (exporting) return;
		exporting = true;
		try {
			const { from, to } = computeRange();
			await onConfirm({ from, to, name: name.trim(), sections });
			open = false;
		} finally {
			exporting = false;
		}
	}

	const sectionItems = $derived([
		{ key: 'supplements' as const, label: t.export_section_supplements },
		{ key: 'dailyOverview' as const, label: t.export_section_daily_overview },
		{ key: 'currentSchedule' as const, label: t.export_section_current_schedule },
		{ key: 'trackers' as const, label: t.export_section_trackers },
		{ key: 'mood' as const, label: t.export_section_mood },
		{ key: 'moodDetails' as const, label: t.export_section_mood_details, indent: true },
		{ key: 'moodGratitude' as const, label: t.export_section_mood_gratitude, indent: true },
		{ key: 'nutrients' as const, label: t.export_section_nutrients }
	]);
</script>

{#if open}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="fixed inset-0 z-50 flex items-end justify-center" style="background-color: rgba(0,0,0,0.6)"
	     onclick={(e) => { if (e.target === e.currentTarget && !exporting) open = false; }}>
		<div class="w-full max-w-[430px] rounded-t-3xl px-4 pt-4 flex flex-col"
		     style="background-color: var(--modal-bg); max-height: 90vh; padding-bottom: calc(env(safe-area-inset-bottom) + 1.5rem)">
			<div class="flex justify-center mb-3 flex-shrink-0">
				<div class="w-10 h-1 rounded-full" style="background-color: var(--color-surface-high)"></div>
			</div>
			<h2 class="text-lg font-bold mb-4 px-2 flex-shrink-0" style="color: var(--color-on-surface)">{t.export_title}</h2>

			<div class="flex-1 overflow-y-auto space-y-5 px-1">
				<!-- Zeitraum -->
				<div>
					<p class="text-xs font-semibold mb-2 uppercase tracking-wider" style="color: var(--color-on-surface-variant)">{t.export_period_label}</p>
					<div class="space-y-1.5">
						{#each [['7', t.export_preset_7], ['30', t.export_preset_30], ['90', t.export_preset_90], ['current', t.export_preset_current], ['custom', t.export_preset_custom]] as [val, label]}
							<button
								onclick={() => period = val as Period}
								class="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl active:opacity-70 text-left"
								style="background-color: {period === val ? 'color-mix(in srgb, var(--color-primary) 14%, var(--color-surface-container))' : 'var(--color-surface-container)'}; outline: {period === val ? '1.5px solid color-mix(in srgb, var(--color-primary) 50%, transparent)' : 'none'}"
							>
								<span class="rounded-full flex items-center justify-center" style="width: 16px; height: 16px; background-color: {period === val ? 'var(--color-primary)' : 'transparent'}; border: 1.5px solid {period === val ? 'var(--color-primary)' : 'var(--color-outline)'}">
									{#if period === val}
										<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									{/if}
								</span>
								<span class="text-sm font-medium" style="color: var(--color-on-surface)">{label}</span>
							</button>
						{/each}
					</div>
					{#if period === 'custom'}
						<div class="grid grid-cols-2 gap-2 mt-2">
							<div class="rounded-xl px-3 py-2" style="background-color: var(--color-surface-container)">
								<p class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-on-surface-variant)">{t.export_from}</p>
								<input type="date" bind:value={customFrom} max={customTo} class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface); font-size: 16px"/>
							</div>
							<div class="rounded-xl px-3 py-2" style="background-color: var(--color-surface-container)">
								<p class="text-[10px] uppercase tracking-wider mb-1" style="color: var(--color-on-surface-variant)">{t.export_to}</p>
								<input type="date" bind:value={customTo} min={customFrom} max={todayKey()} class="w-full bg-transparent outline-none text-sm" style="color: var(--color-on-surface); font-size: 16px"/>
							</div>
						</div>
					{/if}
				</div>

				<!-- Name -->
				<div>
					<p class="text-xs font-semibold mb-2 uppercase tracking-wider" style="color: var(--color-on-surface-variant)">{t.export_name_label}</p>
					<div class="rounded-xl px-3 py-2.5" style="background-color: var(--color-surface-container)">
						<input
							type="text"
							bind:value={name}
							placeholder={t.export_name_hint}
							class="w-full bg-transparent outline-none"
							style="color: var(--color-on-surface); font-size: 16px"
						/>
					</div>
				</div>

				<!-- Sections -->
				<div>
					<p class="text-xs font-semibold mb-2 uppercase tracking-wider" style="color: var(--color-on-surface-variant)">{t.export_sections_label}</p>
					<div class="rounded-2xl overflow-hidden" style="background-color: var(--bubble-container-bg); border: 1px solid var(--bubble-container-border)">
						{#each sectionItems as item}
							{@const indented = 'indent' in item && item.indent}
							{@const disabled = indented && !sections.mood}
							<button
								onclick={() => { if (!disabled) sections = { ...sections, [item.key]: !sections[item.key] }; }}
								disabled={disabled}
								class="w-full flex items-center gap-3 py-2.5 active:opacity-70 text-left disabled:opacity-40"
								style="padding-left: {indented ? '2.5rem' : '1rem'}; padding-right: 1rem"
							>
								<span class="rounded-md flex items-center justify-center flex-shrink-0" style="width: 18px; height: 18px; background-color: {sections[item.key] ? 'var(--color-primary)' : 'transparent'}; border: 1.5px solid {sections[item.key] ? 'var(--color-primary)' : 'var(--color-outline)'}">
									{#if sections[item.key]}
										<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--color-on-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
									{/if}
								</span>
								<span class="text-sm" style="color: var(--color-on-surface)">{item.label}</span>
							</button>
						{/each}
					</div>
				</div>
			</div>

			<!-- Actions -->
			<div class="flex gap-2 pt-4 flex-shrink-0">
				<button
					onclick={() => { if (!exporting) open = false; }}
					disabled={exporting}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70 disabled:opacity-40"
					style="background-color: var(--color-surface-container); color: var(--color-on-surface-variant)"
				>{t.export_cancel}</button>
				<button
					onclick={handleExport}
					disabled={exporting}
					class="flex-1 py-3 rounded-2xl text-sm font-semibold active:opacity-70 disabled:opacity-40"
					style="background: linear-gradient(135deg, var(--color-primary), var(--color-primary-dim)); color: var(--color-on-primary)"
				>{exporting ? '…' : t.export_button}</button>
			</div>
		</div>
	</div>
{/if}
