import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { authGuard } from '$lib/auth/middleware';
import { randomUUID } from 'crypto';
import { writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

const DB_PATH = process.env.DATABASE_URL ?? './data/groly.db';
const UPLOADS_DIR = path.resolve(path.dirname(DB_PATH), 'uploads');

export const POST: RequestHandler = async (event) => {
	const { error } = authGuard(event);
	if (error) return error;

	try {
		if (!existsSync(UPLOADS_DIR)) {
			await mkdir(UPLOADS_DIR, { recursive: true });
		}

		const formData = await event.request.formData();
		const file = formData.get('image');
		if (!file || !(file instanceof File)) {
			return json({ error: 'No image provided' }, { status: 400 });
		}

		if (file.size > 5 * 1024 * 1024) {
			return json({ error: 'Image too large (max 5 MB)' }, { status: 400 });
		}

		// Derive extension from MIME type, default to jpg
		const mimeToExt: Record<string, string> = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
		const ext = mimeToExt[file.type] ?? 'jpg';
		const filename = `${randomUUID()}.${ext}`;
		const filepath = path.join(UPLOADS_DIR, filename);

		const buffer = Buffer.from(await file.arrayBuffer());
		await writeFile(filepath, buffer);

		return json({ url: `/uploads/${filename}` }, { status: 201 });
	} catch (e) {
		console.error('POST /api/uploads/image error:', e);
		return json({ error: 'Upload failed' }, { status: 500 });
	}
};
