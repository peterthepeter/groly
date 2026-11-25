
import type { RequestHandler } from './$types';
import { authGuard } from '#lib/auth/middleware';
import { db } from '#lib/db';
import { uploadedImageAccess } from '#lib/db/schema';
import { uploadsDirectory } from '#lib/server/uploadedImages';
import { randomUUID } from 'crypto';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

export const POST: RequestHandler = async (event) => {
	const { error, user } = authGuard(event);
	if (error) return error;

	try {
		const formData = await event.request.formData();
		const file = formData.get('image');
		if (!file || !(file instanceof File)) {
			return Response.json({ error: 'No image provided', code: 'no_image' }, { status: 400 });
		}

		if (file.size > 5 * 1024 * 1024) {
			return Response.json({ error: 'Image too large (max 5 MB)', code: 'image_too_large' }, { status: 400 });
		}

		// Derive extension from MIME type, default to jpg
		const mimeToExt: Record<string, string> = { 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' };
		const ext = mimeToExt[file.type] ?? 'jpg';
		const filename = `${randomUUID()}.${ext}`;
		const filepath = path.join(uploadsDirectory, filename);
		const imageUrl = `/uploads/${filename}`;

		const buffer = Buffer.from(await file.arrayBuffer());
		await mkdir(uploadsDirectory, { recursive: true });
		await writeFile(filepath, buffer, { flag: 'wx' });
		try {
			db.insert(uploadedImageAccess).values({ imageUrl, userId: user!.id }).run();
		} catch (cause) {
			await unlink(filepath).catch(cleanupError => console.error('Failed to remove unregistered upload', cleanupError));
			throw cause;
		}

		return Response.json({ url: imageUrl }, { status: 201 });
	} catch (e) {
		console.error('POST /api/uploads/image error:', e);
		return Response.json({ error: 'Upload failed', code: 'upload_failed' }, { status: 500 });
	}
};
