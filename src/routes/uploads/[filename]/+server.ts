import type { RequestHandler } from './$types';
import { getUploadedImageAccess, uploadsDirectory } from '#lib/server/uploadedImages';
import { readFile } from 'node:fs/promises';
import { extname, join } from 'node:path';

const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.gif': 'image/gif',
	'.webp': 'image/webp'
};
const cacheHeaders = { 'Cache-Control': 'private, no-store' };

export const GET: RequestHandler = async ({ locals, params }) => {
	const { filename } = params;
	const contentType = MIME[extname(filename).toLowerCase()];
	if (!contentType || filename.includes('/') || filename.includes('\\') || filename.includes('..') || filename.includes('\0')) {
		return new Response(null, { status: 404, headers: cacheHeaders });
	}
	const access = locals.user && getUploadedImageAccess(`/uploads/${filename}`, locals.user.id);
	if (!access) {
		return new Response(null, { status: 404, headers: cacheHeaders });
	}

	try {
		const buffer = await readFile(join(uploadsDirectory, filename));
		const headers = new Headers({ ...cacheHeaders, 'Content-Type': contentType });
		if (access === 'account') headers.set('X-Groly-Image-Cache', 'account');
		return new Response(buffer, { headers });
	} catch (cause) {
		if ((cause as NodeJS.ErrnoException).code === 'ENOENT') {
			return new Response(null, { status: 404, headers: cacheHeaders });
		}
		throw cause;
	}
};
