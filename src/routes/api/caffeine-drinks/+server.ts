import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard, adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { caffeineDrinks } from '$lib/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const drinks = db.select().from(caffeineDrinks).orderBy(asc(caffeineDrinks.sortOrder), asc(caffeineDrinks.name)).all();
	return json({ drinks });
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { name, defaultMl, caffeineMg } = body;

		if (typeof name !== 'string' || !name.trim())
			return json({ error: 'name required' }, { status: 400 });
		if (typeof defaultMl !== 'number' || defaultMl <= 0 || !Number.isInteger(defaultMl))
			return json({ error: 'defaultMl muss positive Ganzzahl sein' }, { status: 400 });
		if (typeof caffeineMg !== 'number' || caffeineMg < 0 || !Number.isInteger(caffeineMg))
			return json({ error: 'caffeineMg muss nicht-negative Ganzzahl sein' }, { status: 400 });

		const now = Date.now();
		const id = randomUUID();
		const maxOrder = db.select().from(caffeineDrinks).all().length;

		db.insert(caffeineDrinks).values({
			id,
			name: name.trim(),
			defaultMl,
			caffeineMg,
			sortOrder: maxOrder,
			createdAt: now
		}).run();

		return json({ id }, { status: 201 });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
