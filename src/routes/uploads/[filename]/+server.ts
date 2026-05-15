import type { RequestHandler } from './$types';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { error } from '@sveltejs/kit';

const DB_PATH = process.env.DATABASE_URL ?? './data/groly.db';
const UPLOADS_DIR = path.resolve(path.dirname(DB_PATH), 'uploads');

export const GET: RequestHandler = async ({ params }) => {
	const filename = params.filename;

	// Prevent path traversal
	if (filename.includes('/') || filename.includes('..')) {
		throw error(400, 'Invalid filename');
	}

	const filepath = path.join(UPLOADS_DIR, filename);
	if (!existsSync(filepath)) {
		throw error(404, 'Not found');
	}

	const buffer = await readFile(filepath);
	const ext = path.extname(filename).toLowerCase();
	const MIME: Record<string, string> = {
		'.png': 'image/png',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.gif': 'image/gif',
		'.webp': 'image/webp'
	};
	const contentType = MIME[ext] ?? 'application/octet-stream';

	return new Response(buffer, {
		headers: {
			'Content-Type': contentType,
			'Cache-Control': 'public, max-age=31536000, immutable'
		}
	});
};
