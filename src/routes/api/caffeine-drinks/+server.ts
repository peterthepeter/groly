
import type { RequestHandler } from './$types';
import { authGuard, adminGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { caffeineDrinks } from '#lib/db/schema';
import { asc } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const drinks = db.select().from(caffeineDrinks).orderBy(asc(caffeineDrinks.sortOrder), asc(caffeineDrinks.name)).all();
	return Response.json({ drinks });
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	try {
		const body = await event.request.json();
		const { name, defaultMl, caffeineMg } = body;

		if (typeof name !== 'string' || !name.trim())
			return Response.json({ error: 'name required' }, { status: 400 });
		if (typeof defaultMl !== 'number' || defaultMl <= 0 || !Number.isInteger(defaultMl))
			return Response.json({ error: 'defaultMl muss positive Ganzzahl sein' }, { status: 400 });
		if (typeof caffeineMg !== 'number' || caffeineMg < 0 || !Number.isInteger(caffeineMg))
			return Response.json({ error: 'caffeineMg muss nicht-negative Ganzzahl sein' }, { status: 400 });

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

		return Response.json({ id }, { status: 201 });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
