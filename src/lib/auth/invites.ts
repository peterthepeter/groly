import { db } from '$lib/db';
import { userInvites, users, sessions } from '$lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { generateId, hashPassword, now } from './index';

const INVITE_TTL_SECONDS = 48 * 60 * 60; // 48h

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createInvite(userId: string, type: 'invite' | 'reset'): string {
	const token = randomBytes(32).toString('base64url');
	const ts = now();
	// Invalidate any open invites for this user
	db.update(userInvites)
		.set({ usedAt: ts })
		.where(and(eq(userInvites.userId, userId), isNull(userInvites.usedAt)))
		.run();
	db.insert(userInvites)
		.values({
			id: generateId(),
			userId,
			tokenHash: hashToken(token),
			type,
			createdAt: ts,
			expiresAt: ts + INVITE_TTL_SECONDS,
			usedAt: null
		})
		.run();
	return token;
}

export type InviteValidation =
	| { status: 'valid'; userId: string; username: string; type: 'invite' | 'reset'; expiresAt: number }
	| { status: 'expired' | 'used' | 'unknown' };

export function validateInvite(token: string): InviteValidation {
	const tokenHash = hashToken(token);
	const inv = db.select().from(userInvites).where(eq(userInvites.tokenHash, tokenHash)).get();
	if (!inv) return { status: 'unknown' };
	if (inv.usedAt != null) return { status: 'used' };
	if (inv.expiresAt < now()) return { status: 'expired' };
	const user = db.select().from(users).where(eq(users.id, inv.userId)).get();
	if (!user) return { status: 'unknown' };
	return {
		status: 'valid',
		userId: user.id,
		username: user.username,
		type: inv.type as 'invite' | 'reset',
		expiresAt: inv.expiresAt
	};
}

export function consumeInvite(token: string, newPassword: string): { sessionId: string } | { error: 'expired' | 'used' | 'unknown' } {
	const tokenHash = hashToken(token);
	const inv = db.select().from(userInvites).where(eq(userInvites.tokenHash, tokenHash)).get();
	if (!inv) return { error: 'unknown' };
	if (inv.usedAt != null) return { error: 'used' };
	if (inv.expiresAt < now()) return { error: 'expired' };

	const ts = now();
	db.update(users)
		.set({ passwordHash: hashPassword(newPassword.trim()), mustChangePassword: false, updatedAt: ts })
		.where(eq(users.id, inv.userId))
		.run();
	db.update(userInvites).set({ usedAt: ts }).where(eq(userInvites.id, inv.id)).run();

	const sessionId = generateId(32);
	const expiresAt = ts + 60 * 60 * 24 * 30;
	db.insert(sessions).values({ id: sessionId, userId: inv.userId, expiresAt, createdAt: ts }).run();
	db.update(users).set({ lastLoginAt: ts }).where(eq(users.id, inv.userId)).run();

	return { sessionId };
}

export function getOpenInviteFor(userId: string): { type: 'invite' | 'reset'; expiresAt: number; expired: boolean } | null {
	const inv = db
		.select()
		.from(userInvites)
		.where(and(eq(userInvites.userId, userId), isNull(userInvites.usedAt)))
		.get();
	if (!inv) return null;
	return { type: inv.type as 'invite' | 'reset', expiresAt: inv.expiresAt, expired: inv.expiresAt < now() };
}
