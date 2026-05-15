import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { adminGuard } from '$lib/auth/middleware';
import { db } from '$lib/db';
import { users } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { createInvite } from '$lib/auth/invites';

export const POST: RequestHandler = async (event) => {
	const { error } = adminGuard(event);
	if (error) return error;

	const targetId = event.params.id;
	const target = db.select().from(users).where(eq(users.id, targetId)).get();
	if (!target) return json({ error: 'Nicht gefunden' }, { status: 404 });

	// Established users (have logged in at least once) get a 'reset' link.
	// Pending users (never logged in) get a fresh 'invite'.
	const type: 'invite' | 'reset' = target.lastLoginAt ? 'reset' : 'invite';
	const token = createInvite(targetId, type);
	const origin = event.url.origin;
	return json({ inviteToken: token, inviteUrl: `${origin}/invite/${token}`, type });
};
