import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { nutritionGoals } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const GET: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	const g = db.select().from(nutritionGoals).where(eq(nutritionGoals.userId, user.id)).get();
	return json({ goals: g ?? null });
};

export const PUT: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error || !user) return error ?? json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const { dailyKcal, dailyProtein, dailyFat, dailyCarbs, dailyFiber } = body;

		const values = {
			userId: user.id,
			dailyKcal: typeof dailyKcal === 'number' && dailyKcal > 0 ? Math.round(dailyKcal) : null,
			dailyProtein: typeof dailyProtein === 'number' && dailyProtein >= 0 ? dailyProtein : null,
			dailyFat: typeof dailyFat === 'number' && dailyFat >= 0 ? dailyFat : null,
			dailyCarbs: typeof dailyCarbs === 'number' && dailyCarbs >= 0 ? dailyCarbs : null,
			dailyFiber: typeof dailyFiber === 'number' && dailyFiber >= 0 ? dailyFiber : null,
			updatedAt: Date.now()
		};

		db.insert(nutritionGoals).values(values)
			.onConflictDoUpdate({
				target: nutritionGoals.userId,
				set: {
					dailyKcal: values.dailyKcal,
					dailyProtein: values.dailyProtein,
					dailyFat: values.dailyFat,
					dailyCarbs: values.dailyCarbs,
					dailyFiber: values.dailyFiber,
					updatedAt: values.updatedAt
				}
			})
			.run();

		return json({ ok: true });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
