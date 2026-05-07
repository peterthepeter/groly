import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementLogs, supplements } from '$lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const rows: Array<{ loggedAt: number; supplement: string; amount: number; note?: string }> = body.rows ?? [];

		if (!Array.isArray(rows) || rows.length === 0) {
			return json({ error: 'No rows provided' }, { status: 400 });
		}

		const userSupplements = db
			.select({ id: supplements.id, name: supplements.name })
			.from(supplements)
			.where(and(eq(supplements.userId, user!.id)))
			.all();

		const nameToId = new Map(userSupplements.map(s => [s.name.toLowerCase(), s.id]));

		let imported = 0;
		const skipped = new Set<string>();
		const now = Date.now();

		db.transaction(() => {
			for (const row of rows) {
				const suppId = nameToId.get(row.supplement?.toLowerCase?.() ?? '');
				if (!suppId) {
					if (row.supplement) skipped.add(row.supplement);
					continue;
				}
				const loggedAt = row.loggedAt;
				if (!loggedAt || isNaN(loggedAt)) continue;
				const amount = Number(row.amount);
				if (!amount || amount <= 0) continue;

				db.insert(supplementLogs).values({
					id: randomUUID(),
					userId: user!.id,
					supplementId: suppId,
					amount,
					loggedAt,
					note: (typeof row.note === 'string' && row.note.trim()) ? row.note.trim() : null,
					createdAt: now
				}).run();
				imported++;
			}
		});

		return json({ imported, skipped: Array.from(skipped) });
	} catch (e) {
		console.error('POST /api/supplement-logs/import error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
