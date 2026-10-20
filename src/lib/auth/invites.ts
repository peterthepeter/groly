import { db } from '#lib/db';
import { userInvites, users, sessions } from '#lib/db/schema';
import { and, eq, isNull, lte, desc } from 'drizzle-orm';
import { randomBytes, createHash } from 'crypto';
import { changePassword, generateId, now } from './index';

const INVITE_TTL_SECONDS = 48 * 60 * 60; // 48h

function hashToken(token: string): string {
	return createHash('sha256').update(token).digest('hex');
}

export function createInvite(userId: string, type: 'invite' | 'reset'): string {
	const token = randomBytes(32).toString('base64url');
	const ts = now();
	// Keep replacement atomic so a failed insert leaves the previous link usable.
	db.transaction(() => {
		db.update(userInvites)
			.set({ usedAt: ts, tokenValue: null })
			.where(and(eq(userInvites.userId, userId), isNull(userInvites.usedAt)))
			.run();
		db.insert(userInvites)
		.values({
			id: generateId(),
			userId,
			tokenHash: hashToken(token),
			tokenValue: token,
			type,
			createdAt: ts,
			expiresAt: ts + INVITE_TTL_SECONDS,
			usedAt: null
		})
		.run();
	});
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
	if (inv.expiresAt <= now()) return { status: 'expired' };
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
	if (inv.expiresAt <= now()) return { error: 'expired' };

	const ts = now();
	const sessionId = generateId(32);
	const expiresAt = ts + 60 * 60 * 24 * 30;
	db.transaction(() => {
		changePassword(inv.userId, newPassword);
		db.insert(sessions).values({ id: sessionId, userId: inv.userId, expiresAt, createdAt: ts }).run();
		db.update(users).set({ lastLoginAt: ts }).where(eq(users.id, inv.userId)).run();
	});

	return { sessionId };
}

// Call only after the admin guard; ordinary invite validation never returns tokenValue.
export function getOpenInviteFor(userId: string): { type: 'invite' | 'reset'; expiresAt: number; expired: boolean; token: string | null } | null {
	const ts = now();
	db.update(userInvites).set({ tokenValue: null })
		.where(and(eq(userInvites.userId, userId), lte(userInvites.expiresAt, ts))).run();
	const inv = db
		.select()
		.from(userInvites)
		.where(and(eq(userInvites.userId, userId), isNull(userInvites.usedAt)))
		.orderBy(desc(userInvites.createdAt))
		.limit(1)
		.get();
	if (!inv) return null;
	const expired = inv.expiresAt <= ts;
	const token = !expired && inv.tokenValue && hashToken(inv.tokenValue) === inv.tokenHash ? inv.tokenValue : null;
	return { type: inv.type as 'invite' | 'reset', expiresAt: inv.expiresAt, expired, token };
}
