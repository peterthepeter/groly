
import type { RequestHandler } from './$types';
import { adminGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { caffeineDrinks } from '#lib/db/schema';
import { eq } from 'drizzle-orm';

export const PUT: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(caffeineDrinks).where(eq(caffeineDrinks.id, id)).get();
	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	try {
		const body = await event.request.json();
		const { name, defaultMl, caffeineMg } = body;

		if (defaultMl !== undefined && (!Number.isInteger(defaultMl) || defaultMl <= 0))
			return Response.json({ error: 'defaultMl muss positive Ganzzahl sein' }, { status: 400 });
		if (caffeineMg !== undefined && (!Number.isInteger(caffeineMg) || caffeineMg < 0))
			return Response.json({ error: 'caffeineMg muss nicht-negative Ganzzahl sein' }, { status: 400 });

		db.update(caffeineDrinks).set({
			...(name !== undefined && { name: String(name).trim() }),
			...(defaultMl !== undefined && { defaultMl }),
			...(caffeineMg !== undefined && { caffeineMg })
		}).where(eq(caffeineDrinks.id, id)).run();

		return Response.json({ ok: true });
	} catch (e) {
		return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { id } = event.params;
	const existing = db.select().from(caffeineDrinks).where(eq(caffeineDrinks.id, id)).get();
	if (!existing) return Response.json({ error: 'Not found' }, { status: 404 });

	db.delete(caffeineDrinks).where(eq(caffeineDrinks.id, id)).run();
	return Response.json({ ok: true });
};
