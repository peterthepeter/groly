import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard, adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementCatalog, supplementCatalogNutrients } from '$lib/db/schema';
import { eq, asc, like, or } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const GET: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	const q = event.url.searchParams.get('q')?.trim();

	const rows = q
		? db.select().from(supplementCatalog)
			.where(or(
				like(supplementCatalog.name, `%${q}%`),
				like(supplementCatalog.brand, `%${q}%`)
			))
			.orderBy(asc(supplementCatalog.name))
			.all()
		: db.select().from(supplementCatalog).orderBy(asc(supplementCatalog.name)).all();

	const nutrients = db.select().from(supplementCatalogNutrients).all();

	const result = rows.map(entry => ({
		...entry,
		nutrients: nutrients
			.filter(n => n.catalogId === entry.id)
			.sort((a, b) => a.sortOrder - b.sortOrder)
	}));

	return json(result);
};

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	try {
		const { user } = authGuard(event);
		const body = await event.request.json();
		const { name, unit, brand, info, packageSize, nutrients: nutrientRows } = body;

		if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });
		if (!unit?.trim()) return json({ error: 'Einheit erforderlich' }, { status: 400 });

		const existing = db.select().from(supplementCatalog)
			.where(eq(supplementCatalog.name, name.trim()))
			.all()
			.find(e => (e.brand ?? '') === (brand?.trim() ?? ''));

		if (existing) return json({ error: 'duplicate', id: existing.id }, { status: 409 });

		const now = Date.now();
		const id = randomUUID();

		db.insert(supplementCatalog).values({
			id,
			name: name.trim(),
			unit: unit.trim(),
			brand: brand?.trim() || null,
			info: info?.trim() || null,
			packageSize: packageSize != null ? Number(packageSize) : null,
			createdBy: user!.id,
			createdAt: now,
			updatedAt: now
		}).run();

		if (Array.isArray(nutrientRows)) {
			for (let i = 0; i < nutrientRows.length; i++) {
				const n = nutrientRows[i];
				if (!n.name?.trim()) continue;
				db.insert(supplementCatalogNutrients).values({
					id: randomUUID(),
					catalogId: id,
					name: n.name.trim(),
					amountPerUnit: Number(n.amountPerUnit) || 0,
					unit: n.unit?.trim() || '',
					sortOrder: i
				}).run();
			}
		}

		return json({ id }, { status: 201 });
	} catch (e) {
		console.error('POST /api/supplement-catalog error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};
