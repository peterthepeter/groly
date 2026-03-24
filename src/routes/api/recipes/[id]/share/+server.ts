import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { recipes, recipeShares, users } from '$lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { sendPushToUser } from '$lib/server/pushNotifications';
import { randomUUID } from 'crypto';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	const recipe = db.select().from(recipes)
		.where(and(eq(recipes.id, event.params.id), eq(recipes.userId, user!.id)))
		.get();
	if (!recipe) return json({ error: 'Nicht gefunden' }, { status: 404 });

	let body: { username?: string };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Ungültige Anfrage' }, { status: 400 });
	}
	const { username } = body;
	if (!username?.trim()) return json({ error: 'Benutzername erforderlich' }, { status: 400 });

	try {
		const target = db.select().from(users)
			.where(sql`lower(${users.username}) = lower(${username.trim()})`)
			.get();
		if (!target) return json({ error: 'Benutzer nicht gefunden' }, { status: 404 });
		if (target.id === user!.id) return json({ error: 'Du kannst kein Rezept mit dir selbst teilen' }, { status: 400 });

		// Check for existing pending share
		const existing = db.select().from(recipeShares)
			.where(and(
				eq(recipeShares.recipeId, event.params.id),
				eq(recipeShares.receiverId, target.id),
				eq(recipeShares.status, 'pending')
			)).get();
		if (existing) return json({ error: 'Bereits geteilt – warte auf Antwort' }, { status: 409 });

		db.insert(recipeShares).values({
			id: randomUUID(),
			senderId: user!.id,
			receiverId: target.id,
			recipeId: event.params.id,
			status: 'pending',
			createdAt: Date.now()
		}).run();

		await sendPushToUser(target.id, {
			title: 'Rezept erhalten',
			body: `${user!.username} möchte das Rezept "${recipe.title}" mit dir teilen`,
			url: '/rezepte'
		});

		return json({ ok: true }, { status: 201 });
	} catch (e) {
		console.error('POST /api/recipes/[id]/share error:', e);
		return json({ error: 'Fehler beim Teilen' }, { status: 500 });
	}
};
