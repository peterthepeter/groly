import type { LayoutServerLoad } from './$types';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) return { user: null, settings: null };

	const fullUser = db.select({
		settings: users.settings,
		settingsRevision: users.settingsRevision
	}).from(users).where(eq(users.id, locals.user.id)).get();
	let settings = null;
	try {
		settings = fullUser?.settings ? JSON.parse(fullUser.settings) : {};
	} catch { settings = {}; }

	return {
		user: {
			id: locals.user.id,
			username: locals.user.username,
			role: locals.user.role
		},
		settings,
		settingsRevision: fullUser?.settingsRevision ?? 0
	};
};
