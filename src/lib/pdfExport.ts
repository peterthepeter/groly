// Client-side PDF export for health/tracker reports.
// Uses pdfmake. Renders via the same trackerStats functions used in the UI,
// so on-screen numbers and exported PDF always match.

/* eslint-disable @typescript-eslint/no-explicit-any */
// pdfmake's strict types make the declarative content tree hard to satisfy without
// scattering casts; we use `any` for the doc tree and rely on pdfmake's runtime validation.
import type { TDocumentDefinitions } from 'pdfmake/interfaces';
import {
	computeAdherence,
	computeTrackerStats,
	eachDayInRange,
	type DateRange,
	type ScheduleLite,
	type SupplementLogLite,
	type SupplementMeta
} from './trackerStats';

export type ReportTemplate = 'supplements' | 'trackers' | 'full';

export type ReportSections = {
	supplements: boolean;
	dailyOverview: boolean;
	currentSchedule: boolean;
	trackers: boolean;
	mood: boolean;
	moodDetails: boolean;
	moodGratitude: boolean;
	nutrients: boolean;
};

export type ReportOptions = {
	template: ReportTemplate;
	range: DateRange;
	lang: 'de' | 'en';
	name?: string;
	sections?: ReportSections;
	// Raw data
	supplements: SupplementMeta[];
	schedules: ScheduleLite[];
	supplementLogs: SupplementLogLite[];
	caffeineLogs: { caffeineMg: number; loggedAt: number }[];
	meditationLogs: { durationSeconds: number; loggedAt: number }[];
	moodLogs: { date: string; mood: number; energy?: number | null; activities?: string[]; note?: string | null; gratitude?: string | null }[];
	moodLabels?: Record<number, string>; // 1→"Very bad", 5→"Great" (i18n strings from caller)
	moodActivityLabels?: Record<string, string>; // tag-key → translated label
	nutrientTotals: { name: string; total: number; unit: string }[];
};

const ALL_SECTIONS: ReportSections = {
	supplements: true,
	dailyOverview: true,
	currentSchedule: true,
	trackers: true,
	mood: true,
	moodDetails: false,
	moodGratitude: false,
	nutrients: true
};

// A4 page = 595pt wide, margins 40 each side → 515pt content. Minus 90pt name column = 425pt for canvas area.
const CANVAS_WIDTH = 415;

const COLORS = {
	primary: '#1B5E20',
	caffeine: '#C8956C',
	meditation: '#9F7AEA',
	mood: '#F472B6',
	muted: '#6B6B6B',
	track: '#E5E5E5',       // unfilled track / bar background
	noTake: '#D0D0D0',      // any day without intake (scheduled or not — single tone for consistency)
	partial: '#7CAA7F',
	text: '#1A1A1A'
};

function formatAxisLabel(dateKey: string, lang: 'de' | 'en'): string {
	// dateKey is YYYY-MM-DD; render as e.g. "1. Mai" or "May 1"
	const d = new Date(dateKey + 'T12:00:00');
	return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { day: 'numeric', month: 'short' });
}

function fmtDate(ts: number, lang: 'de' | 'en'): string {
	return new Date(ts).toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function tx(lang: 'de' | 'en', de: string, en: string): string {
	return lang === 'en' ? en : de;
}

export async function exportReport(opts: ReportOptions): Promise<void> {
	// Lazy-load pdfmake (heavy bundle ~600KB) only when user actually exports
	const pdfMakeMod = await import('pdfmake/build/pdfmake');
	const pdfFontsMod = await import('pdfmake/build/vfs_fonts');
	// Different bundling layouts expose vfs at different keys; handle gracefully.
	const pdfMake = (pdfMakeMod as { default?: unknown }).default ?? pdfMakeMod;
	const vfs =
		(pdfFontsMod as { pdfMake?: { vfs?: Record<string, string> } }).pdfMake?.vfs ??
		(pdfFontsMod as { default?: { pdfMake?: { vfs?: Record<string, string> } } }).default?.pdfMake?.vfs ??
		(pdfFontsMod as { vfs?: Record<string, string> }).vfs;
	if (vfs) {
		(pdfMake as { vfs?: Record<string, string> }).vfs = vfs;
	}

	const doc = buildDocument(opts);
	const fmtFile = (d: number) => new Date(d).toISOString().slice(0, 10);
	const filename = `groly-${opts.template}-${fmtFile(opts.range.from)}_${fmtFile(opts.range.to)}.pdf`;
	(pdfMake as { createPdf: (d: TDocumentDefinitions) => { download: (n: string) => void } })
		.createPdf(doc)
		.download(filename);
}

function buildDocument(opts: ReportOptions): TDocumentDefinitions {
	const { lang, range, template } = opts;
	const periodLabel = `${fmtDate(range.from, lang)} – ${fmtDate(range.to, lang)}`;
	const generatedAt = new Date().toLocaleDateString(lang === 'en' ? 'en-US' : 'de-DE', {
		day: 'numeric', month: 'long', year: 'numeric'
	});

	const titles: Record<ReportTemplate, [string, string]> = {
		supplements: ['Supplements', 'Supplements'],
		trackers: ['Tracker', 'Trackers'],
		full: ['Übersicht', 'Overview']
	};
	const [titleDe, titleEn] = titles[template];
	const sections = opts.sections ?? ALL_SECTIONS;
	const nameLine = opts.name?.trim()
		? `${opts.name.trim()} · ${tx(lang, `Erstellt am ${generatedAt}`, `Generated on ${generatedAt}`)}`
		: tx(lang, `Erstellt am ${generatedAt}`, `Generated on ${generatedAt}`);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const content: any[] = [
		{
			columns: [
				{ text: tx(lang, titleDe, titleEn), style: 'h1' },
				{ text: periodLabel, style: 'periodLabel', alignment: 'right' }
			]
		},
		{ text: nameLine, style: 'subtle', margin: [0, 0, 0, 14] }
	];

	if (sections.supplements) {
		content.push(...buildSupplementsSection(opts, sections));
	}
	if (sections.trackers) {
		content.push(...buildTrackersSection(opts));
	}
	if (sections.mood) {
		content.push(...buildMoodSection(opts, sections.moodDetails, sections.moodGratitude));
	}
	if (sections.nutrients) {
		content.push(...buildNutrientsSection(opts));
	}

	return {
		pageSize: 'A4',
		pageMargins: [40, 40, 40, 40],
		content,
		defaultStyle: { fontSize: 10, color: COLORS.text },
		styles: {
			h1: { fontSize: 18, bold: true, color: COLORS.text },
			h2: { fontSize: 12, bold: true, color: COLORS.text, margin: [0, 14, 0, 6] },
			h3: { fontSize: 10, bold: true, color: COLORS.text, margin: [0, 10, 0, 4] },
			periodLabel: { fontSize: 10, color: COLORS.muted },
			subtle: { fontSize: 9, color: COLORS.muted },
			rowName: { fontSize: 10, color: COLORS.text },
			rowValueMuted: { fontSize: 9, color: COLORS.muted },
			rowValuePrimary: { fontSize: 10, bold: true, color: COLORS.primary }
		}
	};
}

function buildSupplementsSection(opts: ReportOptions, sections: ReportSections): any[] {
	const { lang } = opts;
	const adherence = computeAdherence(opts.supplements, opts.schedules, opts.supplementLogs, opts.range);
	if (adherence.length === 0) {
		return [
			{ text: tx(lang, 'Supplements', 'Supplements'), style: 'h2' },
			{ text: tx(lang, 'Keine Einnahmen in diesem Zeitraum.', 'No intake in this period.'), style: 'subtle' }
		];
	}

	const result: any[] = [{ text: tx(lang, 'Supplements', 'Supplements'), style: 'h2' }];

	// Per-supplement adherence rows: name + quote + bar + pct
	const rows = adherence.map((a) => {
		const denom = a.planned > 0 ? a.planned : a.totalDays;
		const barWidth = 60;
		const filled = Math.round((a.percent / 100) * barWidth);
		return [
			{ text: a.name, style: 'rowName' },
			{ text: `${a.taken}/${denom}`, style: 'rowValueMuted', alignment: 'right' },
			{
				canvas: [
					{ type: 'rect', x: 0, y: 4, w: barWidth, h: 5, color: COLORS.track, r: 2 },
					{ type: 'rect', x: 0, y: 4, w: filled, h: 5, color: COLORS.primary, r: 2 }
				] as unknown as any[],
				width: barWidth
			},
			{ text: `${a.percent}%`, style: 'rowValuePrimary', alignment: 'right' }
		];
	});
	result.push({
		table: { widths: ['*', 40, 65, 35], body: rows },
		layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }
	});

	if (sections.dailyOverview && (adherence[0]?.daily.length ?? 0) >= 3) {
		const totalDays = adherence[0]?.daily.length ?? 0;
		// Cell size adapts to fit but stays compact for short ranges (week, day)
		const gap = 1.5;
		const dotSize = Math.max(5, Math.min(14, (CANVAS_WIDTH - (totalDays - 1) * gap) / totalDays));
		const heatmapWidth = totalDays * (dotSize + gap) - gap;
		const heatmapRows = adherence.map((a) => {
			const canvas: unknown[] = [];
			a.daily.forEach((d, i) => {
				const x = i * (dotSize + gap);
				let color = COLORS.noTake;
				if (d === 'full') color = COLORS.primary;
				else if (d === 'partial') color = COLORS.partial;
				canvas.push({ type: 'rect', x, y: 0, w: dotSize, h: dotSize, color, r: 1 });
			});
			return [
				{ text: a.name, fontSize: 10, color: COLORS.text },
				{ canvas, width: heatmapWidth }
			];
		});
		const days = eachDayInRange(opts.range);
		const tickIndices = totalDays <= 7 ? days.map((_, i) => i) : [0, Math.floor(totalDays * 0.5), totalDays - 1];
		const axisCanvas: unknown[] = [];
		tickIndices.forEach((i) => {
			const x = i * (dotSize + gap) + dotSize / 2;
			axisCanvas.push({ type: 'rect', x: x - 0.3, y: 0, w: 0.6, h: 2.5, color: COLORS.muted });
		});
		const axisLabelRow = [
			{ text: '', fontSize: 1 },
			{
				stack: [
					{ canvas: axisCanvas, width: heatmapWidth, margin: [0, 1, 0, 1] },
					{
						columns: tickIndices.map((i, idx) => ({
							text: formatAxisLabel(days[i], opts.lang),
							fontSize: 7,
							color: COLORS.muted,
							alignment: idx === 0 ? 'left' : idx === tickIndices.length - 1 ? 'right' : 'center'
						})),
						columnGap: 4
					}
				],
				width: heatmapWidth
			}
		];
		result.push({ text: tx(lang, 'Tagesübersicht', 'Daily overview'), style: 'h3' });
		result.push({
			table: { widths: [90, heatmapWidth], body: [...heatmapRows, axisLabelRow] },
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 2, paddingBottom: () => 2 }
		});
	}

	if (sections.currentSchedule) {
		result.push(...buildCurrentTherapy(opts));
	}

	return result;
}

function buildCurrentTherapy(opts: ReportOptions): any[] {
	const { lang } = opts;
	const schedulesBySupp = new Map<string, string[]>();
	for (const s of opts.schedules) {
		if (!s.active) continue;
		const arr = schedulesBySupp.get(s.supplementId) ?? [];
		arr.push(s.time);
		schedulesBySupp.set(s.supplementId, arr);
	}
	const rows: unknown[][] = [];
	for (const supp of opts.supplements) {
		const times = schedulesBySupp.get(supp.id);
		if (!times || times.length === 0) continue;
		rows.push([
			{ text: supp.name, fontSize: 10 },
			{ text: times.sort().join(' · '), fontSize: 9, color: COLORS.muted, alignment: 'right' }
		]);
	}
	if (rows.length === 0) return [];
	return [
		{ text: tx(lang, 'Aktuelle Einnahme', 'Current schedule'), style: 'h3' },
		{
			table: { widths: ['*', 'auto'], body: rows as any[] },
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }
		}
	];
}

function buildTrackersSection(opts: ReportOptions): any[] {
	const { lang, range } = opts;
	const cs = computeTrackerStats(
		opts.caffeineLogs.map(l => ({ value: l.caffeineMg, loggedAt: l.loggedAt })),
		range
	);
	const ms = computeTrackerStats(
		opts.meditationLogs.map(l => ({ value: Math.round(l.durationSeconds / 60), loggedAt: l.loggedAt })),
		range
	);
	const days = eachDayInRange(range);

	const rows: any[] = [];
	if (cs.activeDays > 0) {
		rows.push(trackerRow(
			tx(lang, 'Koffein', 'Caffeine'),
			COLORS.caffeine,
			`Ø ${Math.round(cs.avgPerDay)} mg · ${cs.min}–${cs.max} mg · ${cs.activeDays}/${cs.totalDays} ${tx(lang, 'Tage', 'days')}`,
			cs.daily,
			'mg',
			days,
			lang
		));
	}
	if (ms.activeDays > 0) {
		rows.push(trackerRow(
			tx(lang, 'Meditation', 'Meditation'),
			COLORS.meditation,
			`Ø ${Math.round(ms.avgPerDay)} min · ${ms.min}–${ms.max} min · ${ms.activeDays}/${ms.totalDays} ${tx(lang, 'Tage', 'days')}`,
			ms.daily,
			'min',
			days,
			lang
		));
	}

	if (rows.length === 0) return [];
	// Compute matching width from totalDays (same as trackerRow's internal width).
	// For day-view (<3 days), no sparkline rendered → let the stats column expand.
	const totalDays = days.length;
	const secondColWidth = totalDays < 3
		? '*'
		: (() => {
			const gap = 1.5;
			const barW = Math.max(4, Math.min(14, (CANVAS_WIDTH - (totalDays - 1) * gap) / totalDays));
			return totalDays * (barW + gap) - gap;
		})();
	return [
		{ text: tx(lang, 'Tracker', 'Trackers'), style: 'h2' },
		{
			table: { widths: [90, secondColWidth], body: rows },
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 8 }
		}
	];
}

function trackerRow(name: string, color: string, statsLine: string, values: number[], unit: string, days: string[], lang: 'de' | 'en'): any[] {
	// For very short ranges (day view) skip the sparkline entirely — one bar carries no info
	if (values.length < 3) {
		return [
			{ text: name, bold: true, color, fontSize: 10 },
			{ text: statsLine, fontSize: 9, color: COLORS.muted }
		];
	}
	const gap = 1.5;
	const barW = Math.max(4, Math.min(14, (CANVAS_WIDTH - (values.length - 1) * gap) / values.length));
	const width = values.length * (barW + gap) - gap;
	const height = 28;
	const max = Math.max(...values, 1);
	const canvas: any[] = [];
	canvas.push({ type: 'line', x1: 0, y1: height, x2: width, y2: height, lineColor: COLORS.muted, lineWidth: 0.3 });
	canvas.push({ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineColor: color, lineWidth: 0.3, dash: { length: 2 } });
	values.forEach((v, i) => {
		const h = v === 0 ? 2 : Math.max(2, (v / max) * height);
		canvas.push({ type: 'rect', x: i * (barW + gap), y: height - h, w: barW, h, color, opacity: v === 0 ? 0.2 : 0.9, r: 1 });
	});
	const tickIndices = values.length <= 7 ? days.map((_, i) => i) : [0, Math.floor(values.length * 0.5), values.length - 1];
	return [
		{ text: name, bold: true, color, fontSize: 10 },
		{
			stack: [
				{ text: statsLine, fontSize: 9, color: COLORS.muted, margin: [0, 0, 0, 2] },
				{ text: `max ${max} ${unit}`, fontSize: 7, color: COLORS.muted, alignment: 'right', margin: [0, 0, 0, 1] },
				{ canvas, width },
				{
					columns: tickIndices.map((i, idx) => ({
						text: formatAxisLabel(days[i], lang),
						fontSize: 7,
						color: COLORS.muted,
						alignment: idx === 0 ? 'left' : idx === tickIndices.length - 1 ? 'right' : 'center'
					})),
					columnGap: 4,
					width,
					margin: [0, 2, 0, 0]
				}
			]
		}
	];
}


function buildMoodSection(opts: ReportOptions, includeDetails: boolean, includeGratitude: boolean): any[] {
	const { lang, moodLogs, range } = opts;
	if (moodLogs.length === 0) return [];
	const sum = moodLogs.reduce((s, l) => s + l.mood, 0);
	const avg = sum / moodLogs.length;
	const sorted = moodLogs.slice().sort((a, b) => a.date.localeCompare(b.date));
	let trend: 'up' | 'down' | 'flat' = 'flat';
	if (sorted.length >= 6) {
		const mid = Math.floor(sorted.length / 2);
		const a = sorted.slice(0, mid);
		const b = sorted.slice(mid);
		const aAvg = a.reduce((s, l) => s + l.mood, 0) / a.length;
		const bAvg = b.reduce((s, l) => s + l.mood, 0) / b.length;
		const delta = bAvg - aAvg;
		if (delta > 0.3) trend = 'up';
		else if (delta < -0.3) trend = 'down';
	}

	const result: any[] = [{ text: tx(lang, 'Stimmung', 'Mood'), style: 'h2' }];
	const energies = moodLogs.map(log => log.energy).filter((value): value is number => typeof value === 'number');
	if (energies.length > 0) result.push({ text: `${tx(lang, 'Energie', 'Energy')}: Ø ${(energies.reduce((sum, value) => sum + value, 0) / energies.length).toFixed(1)}/5`, fontSize: 9, color: COLORS.muted, margin: [0, 0, 0, 4] });

	// Build day-keyed lookup of mood entries
	const moodByDate = new Map<string, number>();
	for (const l of moodLogs) moodByDate.set(l.date, l.mood);
	const days = eachDayInRange(range);
	const values = days.map(d => moodByDate.get(d) ?? 0); // 0 = no entry
	const totalDays = days.length;

	// Sparkline (always when mood section enabled and >= 3 days)
	if (totalDays >= 3) {
		const gap = 1.5;
		const barW = Math.max(4, Math.min(14, (CANVAS_WIDTH - (totalDays - 1) * gap) / totalDays));
		const width = totalDays * (barW + gap) - gap;
		const height = 28;
		const maxScale = 5;
		const canvas: any[] = [];
		// Baseline + max-line
		canvas.push({ type: 'line', x1: 0, y1: height, x2: width, y2: height, lineColor: COLORS.muted, lineWidth: 0.3 });
		canvas.push({ type: 'line', x1: 0, y1: 0, x2: width, y2: 0, lineColor: COLORS.mood, lineWidth: 0.3, dash: { length: 2 } });
		values.forEach((v, i) => {
			const isLogged = v > 0;
			const h = isLogged ? Math.max(2, (v / maxScale) * height) : 2;
			canvas.push({
				type: 'rect',
				x: i * (barW + gap),
				y: height - h,
				w: barW,
				h,
				color: COLORS.mood,
				opacity: isLogged ? 0.9 : 0.2,
				r: 1
			});
		});
		const tickIndices = totalDays <= 7 ? days.map((_, i) => i) : [0, Math.floor(totalDays * 0.5), totalDays - 1];
		// Build trend indicator as small triangle SVG (Unicode arrows don't render in default Roboto)
		const trendSvg = trend === 'flat'
			? ''
			: `<svg width="9" height="9" viewBox="0 0 10 10"><polygon points="${trend === 'up' ? '5,1 9,8 1,8' : '1,2 9,2 5,9'}" fill="${COLORS.mood}"/></svg>`;
		result.push({
			table: {
				widths: [90, width],
				body: [[
					{ text: tx(lang, 'Stimmung', 'Mood'), bold: true, color: COLORS.mood, fontSize: 10 },
					{
						stack: [
							{
								columns: [
									{ text: `Ø ${avg.toFixed(1)}/5 · ${moodLogs.length}/${totalDays} ${tx(lang, 'Tage', 'days')}`, fontSize: 9, color: COLORS.muted },
									trendSvg ? { svg: trendSvg, width: 9, alignment: 'right' } : { text: '' }
								],
								columnGap: 4,
								margin: [0, 0, 0, 2]
							},
							{ text: `max 5`, fontSize: 7, color: COLORS.muted, alignment: 'right', margin: [0, 0, 0, 1] },
							{ canvas, width },
							{
								columns: tickIndices.map((i, idx) => ({
									text: formatAxisLabel(days[i], lang),
									fontSize: 7,
									color: COLORS.muted,
									alignment: idx === 0 ? 'left' : idx === tickIndices.length - 1 ? 'right' : 'center'
								})),
								columnGap: 4,
								width,
								margin: [0, 2, 0, 0]
							}
						]
					}
				]]
			},
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 8 }
		});
	} else {
		// Few-day fallback: just plain stats
		result.push({
			columns: [
				{ text: tx(lang, 'Durchschnitt', 'Average'), width: 100, fontSize: 9, color: COLORS.muted },
				{ text: `${avg.toFixed(1)}/5`, color: COLORS.mood, bold: true }
			]
		});
	}

	// Details: per-day entries with activities + note
	if (includeDetails) {
		const labels = opts.moodLabels ?? {};
		const tagLabels = opts.moodActivityLabels ?? {};
		const rows = sorted.map((l) => {
			const dateLabel = formatAxisLabel(l.date, lang);
			const moodLabel = `${labels[l.mood] ?? `${l.mood}/5`} · ${tx(lang, 'Energie', 'Energy')} ${l.energy ?? '–'}/5`;
			const tagText = (l.activities ?? []).map(k => tagLabels[k] ?? k).join(' · ');
			const noteText = l.note ? `"${l.note}"` : '';
			const right: any[] = [];
			if (tagText) right.push({ text: tagText, fontSize: 9, color: COLORS.text });
			if (noteText) right.push({ text: noteText, fontSize: 9, italics: true, color: COLORS.muted, margin: [0, 1, 0, 0] });
			if (right.length === 0) right.push({ text: '—', fontSize: 9, color: COLORS.muted });
			return [
				{ text: dateLabel, fontSize: 9, color: COLORS.muted },
				{ text: moodLabel, fontSize: 10, color: COLORS.mood, bold: true },
				{ stack: right }
			];
		});
		result.push({ text: tx(lang, 'Tagesdetails', 'Daily details'), style: 'h3' });
		result.push({
			table: { widths: [60, 70, '*'], body: rows },
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }
		});
	}

	// Gratitude journal entries
	if (includeGratitude) {
		const gratitudeEntries = sorted.filter(l => l.gratitude && l.gratitude.trim());
		if (gratitudeEntries.length > 0) {
			const rows = gratitudeEntries.map((l) => [
				{ text: formatAxisLabel(l.date, lang), fontSize: 9, color: COLORS.muted },
				{ text: l.gratitude!, fontSize: 9, color: COLORS.text }
			]);
			result.push({ text: tx(lang, 'Dankbarkeitsjournal', 'Gratitude journal'), style: 'h3' });
			result.push({
				table: { widths: [60, '*'], body: rows as any[] },
				layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }
			});
		}
	}

	return result;
}

function buildNutrientsSection(opts: ReportOptions): any[] {
	const { lang, nutrientTotals } = opts;
	if (nutrientTotals.length === 0) return [];
	const toMcg = (val: number, unit: string): number => {
		const u = unit.toLowerCase();
		if (u === 'g') return val * 1_000_000;
		if (u === 'mg') return val * 1_000;
		return val;
	};
	const sorted = nutrientTotals.slice().sort((a, b) => toMcg(b.total, b.unit) - toMcg(a.total, a.unit));
	const rows = sorted.map((n) => {
		const value = n.unit.toLowerCase() === 'mg' && n.total >= 1000
			? `${(n.total / 1000).toFixed(1).replace(/\.0$/, '')} g`
			: `${n.total % 1 === 0 ? n.total : n.total.toFixed(1)} ${n.unit}`;
		return [
			{ text: n.name, fontSize: 10 },
			{ text: value, fontSize: 10, color: COLORS.primary, alignment: 'right' }
		];
	});
	return [
		{ text: tx(lang, 'Nährstoffe', 'Nutrients'), style: 'h2' },
		{
			table: { widths: ['*', 'auto'], body: rows as any[] },
			layout: { hLineWidth: () => 0, vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }
		}
	];
}
