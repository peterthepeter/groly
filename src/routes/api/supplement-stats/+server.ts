import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements, supplementNutrients } from '$lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

function getDateBounds(period: string, date: string): { from: number; to: number } {
	const d = new Date(date + 'T00:00:00');

	if (period === 'day') {
		const from = d.getTime();
		const to = from + 86_400_000 - 1;
		return { from, to };
	}

	if (period === 'week') {
		// Start on Monday
		const day = d.getDay(); // 0 = Sunday
		const diffToMonday = (day === 0 ? -6 : 1 - day);
		const monday = new Date(d);
		monday.setDate(d.getDate() + diffToMonday);
		monday.setHours(0, 0, 0, 0);
		const sunday = new Date(monday);
		sunday.setDate(monday.getDate() + 6);
		sunday.setHours(23, 59, 59, 999);
		return { from: monday.getTime(), to: sunday.getTime() };
	}

	// month
	const from = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
	const to = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
	return { from, to };
}

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const period = event.url.searchParams.get('period') ?? 'day';
	const date = event.url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

	if (!['day', 'week', 'month'].includes(period)) {
		return json({ error: 'Invalid period' }, { status: 400 });
	}
	if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T00:00:00').getTime())) {
		return json({ error: 'Invalid date' }, { status: 400 });
	}

	const { from, to } = getDateBounds(period, date);

	// Get all logs for the period
	const logs = db
		.select()
		.from(supplementLogs)
		.where(
			and(
				eq(supplementLogs.userId, user!.id),
				gte(supplementLogs.loggedAt, from),
				lte(supplementLogs.loggedAt, to)
			)
		)
		.all();

	if (logs.length === 0) return json({ nutrients: {}, logs: [] });

	// Get nutrients for all involved supplements (filtered in SQL, not in JS)
	const supplementIds = [...new Set(logs.map(l => l.supplementId))];
	const allNutrients = db
		.select()
		.from(supplementNutrients)
		.where(inArray(supplementNutrients.supplementId, supplementIds))
		.all();

	const allSupplements = db
		.select({ id: supplements.id, name: supplements.name, unit: supplements.unit })
		.from(supplements)
		.where(and(eq(supplements.userId, user!.id), inArray(supplements.id, supplementIds)))
		.all();

	// Build lookup map to avoid O(n²) find() in loop
	const nutrientsBySupplementId = new Map<string, typeof allNutrients>();
	for (const n of allNutrients) {
		if (!nutrientsBySupplementId.has(n.supplementId)) nutrientsBySupplementId.set(n.supplementId, []);
		nutrientsBySupplementId.get(n.supplementId)!.push(n);
	}
	const supplementsById = new Map(allSupplements.map(s => [s.id, s]));

	// Aggregate: nutrientName -> { total, unit, name }
	// Key is normalised (lowercase) so "Magnesium" and "magnesium" merge into one entry.
	// The original casing of the first occurrence is kept for display.
	const nutrientTotals: Record<string, { total: number; unit: string; name: string }> = {};

	for (const log of logs) {
		const nutrients = nutrientsBySupplementId.get(log.supplementId) ?? [];
		for (const nutrient of nutrients) {
			const total = nutrient.amountPerUnit * log.amount;
			const key = `${nutrient.name.toLowerCase()}__${nutrient.unit.toLowerCase()}`;
			if (!nutrientTotals[key]) {
				nutrientTotals[key] = { total: 0, unit: nutrient.unit, name: nutrient.name };
			}
			nutrientTotals[key].total += total;
		}
	}

	// Also build per-supplement intake
	const supplementTotals: Record<string, { name: string; unit: string; total: number }> = {};
	for (const log of logs) {
		const sup = supplementsById.get(log.supplementId);
		if (!sup) continue;
		if (!supplementTotals[log.supplementId]) {
			supplementTotals[log.supplementId] = { name: sup.name, unit: sup.unit, total: 0 };
		}
		supplementTotals[log.supplementId].total += log.amount;
	}

	return json({
		nutrients: nutrientTotals,
		supplements: supplementTotals,
		logs,
		period,
		date,
		from,
		to
	});
};
