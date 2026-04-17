import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { supplementCatalog, supplementCatalogNutrients } from '$lib/db/schema';
import { eq, ne } from 'drizzle-orm';
import { randomUUID } from 'crypto';

export const PUT: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { id } = event.params;

	try {
		const body = await event.request.json();
		const { name, unit, brand, info, packageSize, nutrients: nutrientRows } = body;

		if (!name?.trim()) return json({ error: 'Name erforderlich' }, { status: 400 });
		if (!unit?.trim()) return json({ error: 'Einheit erforderlich' }, { status: 400 });

		const duplicate = db.select().from(supplementCatalog)
			.where(ne(supplementCatalog.id, id))
			.all()
			.find(e => e.name === name.trim() && (e.brand ?? '') === (brand?.trim() ?? ''));
		if (duplicate) return json({ error: 'duplicate' }, { status: 409 });

		const now = Date.now();

		db.update(supplementCatalog).set({
			name: name.trim(),
			unit: unit.trim(),
			brand: brand?.trim() || null,
			info: info?.trim() || null,
			packageSize: packageSize != null ? Number(packageSize) : null,
			updatedAt: now
		}).where(eq(supplementCatalog.id, id)).run();

		db.delete(supplementCatalogNutrients).where(eq(supplementCatalogNutrients.catalogId, id)).run();

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

		return json({ ok: true });
	} catch (e) {
		console.error('PUT /api/supplement-catalog/[id] error:', e);
		return json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const { id } = event.params;
	db.delete(supplementCatalog).where(eq(supplementCatalog.id, id)).run();
	return json({ ok: true });
};
