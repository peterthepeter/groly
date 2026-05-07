import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements, supplementNutrients } from '$lib/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const period = event.url.searchParams.get('period') ?? 'day';
	const from = Number(event.url.searchParams.get('from'));
	const to = Number(event.url.searchParams.get('to'));

	if (!['day', 'week', 'month'].includes(period)) {
		return json({ error: 'Invalid period' }, { status: 400 });
	}
	if (!from || !to || isNaN(from) || isNaN(to)) {
		return json({ error: 'Invalid from/to' }, { status: 400 });
	}

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
		from,
		to
	});
};
