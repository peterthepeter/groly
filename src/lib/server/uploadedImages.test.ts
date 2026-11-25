import { readFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeEach, expect, it, vi } from 'vitest';

vi.mock('#lib/db', async () => {
	const { default: Database } = await import('better-sqlite3');
	const { drizzle } = await import('drizzle-orm/better-sqlite3');
	const { migrate } = await import('drizzle-orm/better-sqlite3/migrator');
	const schema = await import('#lib/db/schema');
	const sqlite = new Database(':memory:');
	sqlite.pragma('foreign_keys = ON');
	const db = drizzle(sqlite, { schema });
	migrate(db, { migrationsFolder: './src/lib/db/migrations' });
	return { db, sqlite };
});

vi.mock('#lib/server/uploadedImages', async importOriginal => ({
	...await importOriginal<typeof import('#lib/server/uploadedImages')>(),
	uploadsDirectory: await mkdtemp(join(tmpdir(), 'groly-image-test-'))
}));

import { sql } from 'drizzle-orm';
import { db, sqlite } from '#lib/db';
import { createUser, getSession, login } from '#lib/auth';
import { recipes, recipeShares } from '#lib/db/schema';
import { getUploadedImageAccess, uploadsDirectory } from '#lib/server/uploadedImages';
import { POST as uploadImage } from '../../routes/api/uploads/image/+server';
import { GET as readImage } from '../../routes/uploads/[filename]/+server';
import { PUT as resolveShare } from '../../routes/api/recipes/shares/[id]/+server';

beforeEach(() => { sqlite.exec('DELETE FROM users'); });
afterAll(async () => {
	sqlite.close();
	await rm(uploadsDirectory, { recursive: true, force: true });
});

it('keeps existing local images accessible to the accounts referencing them during migration', async () => {
	const alice = await createUser('alice', 'Password123');
	const bob = await createUser('bob', 'Password123');
	db.run(sql`INSERT INTO recipes (id, user_id, title, image_url, created_at, updated_at)
		VALUES ('legacy-recipe', ${alice}, 'Soup', '/uploads/soup.jpg', 1, 1)`);
	db.run(sql`INSERT INTO meals (id, user_id, name, date, time, image_url, created_at, updated_at)
		VALUES ('legacy-meal', ${bob}, 'Lunch', '2026-01-01', '12:00', '/uploads/lunch.png', 1, 1)`);
	db.run(sql`INSERT INTO nutrition_meal_favorites (id, user_id, display_name, image_url, created_at)
		VALUES ('legacy-favorite', ${bob}, 'Lunch', '/uploads/lunch.png', 1)`);

	sqlite.exec('DROP TABLE uploaded_image_access');
	sqlite.exec(readFileSync(new URL('../db/migrations/0055_private_uploaded_images.sql', import.meta.url), 'utf8'));

	expect(getUploadedImageAccess('/uploads/soup.jpg', alice)).toBe('account');
	expect(getUploadedImageAccess('/uploads/lunch.png', bob)).toBe('account');
	expect(getUploadedImageAccess('/uploads/soup.jpg', bob)).toBeNull();
	expect(getUploadedImageAccess('/uploads/lunch.png', alice)).toBeNull();
});

it('allows the uploader and authorized recipe recipients to read an image', async () => {
	const alice = await createUser('alice', 'Password123');
	const bob = await createUser('bob', 'Password123');
	const aliceSession = (await login('alice', 'Password123'))!.sessionId;
	const bobSession = (await login('bob', 'Password123'))!.sessionId;
	const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
	const form = new FormData();
	form.set('image', new File([bytes], 'recipe.png', { type: 'image/png' }));
	const upload = await uploadImage({
		cookies: { get: () => aliceSession },
		request: new Request('http://localhost/api/uploads/image', { method: 'POST', body: form })
	} as never);
	expect(upload.status).toBe(201);
	const { url } = await upload.json();
	const filename = url.split('/').at(-1);
	const get = (session: string | null) => readImage({
		locals: { user: session ? getSession(session) : undefined }, params: { filename }
	} as never);

	const ownImage = await get(aliceSession);
	expect(ownImage.status).toBe(200);
	expect(ownImage.headers.get('Cache-Control')).toBe('private, no-store');
	expect(ownImage.headers.get('X-Groly-Image-Cache')).toBe('account');
	expect(new Uint8Array(await ownImage.arrayBuffer())).toEqual(bytes);
	expect((await get(null)).status).toBe(404);
	expect((await get(bobSession)).status).toBe(404);

	const now = Date.now();
	db.insert(recipes).values([
		{ id: 'recipe', userId: alice, title: 'Soup', imageUrl: url, createdAt: now, updatedAt: now },
		{ id: 'ungranted', userId: bob, title: 'Lunch', imageUrl: url, createdAt: now, updatedAt: now }
	]).run();
	expect((await get(bobSession)).status).toBe(404);

	const invite = () => db.insert(recipeShares).values({
		id: 'share', senderId: alice, receiverId: bob, recipeId: 'recipe', createdAt: now
	}).run();
	const resolve = (action: string) => resolveShare({
		cookies: { get: () => bobSession },
		params: { id: 'share' },
		request: new Request('http://localhost/api/recipes/shares/share', { method: 'PUT', body: JSON.stringify({ action }) })
	} as never);

	invite();
	const preview = await get(bobSession);
	expect(preview.status).toBe(200);
	expect(preview.headers.get('X-Groly-Image-Cache')).toBeNull();
	expect((await resolve('decline')).status).toBe(200);
	expect((await get(bobSession)).status).toBe(404);

	invite();
	expect((await resolve('accept')).status).toBe(200);
	expect((await get(bobSession)).status).toBe(200);
	expect((await resolve('accept')).status).toBe(404);
});
