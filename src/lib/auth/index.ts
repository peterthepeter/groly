import { db } from '#lib/db';
import { users, sessions, userInvites, pushSubscriptions } from '#lib/db/schema';
import { and, eq, ne } from 'drizzle-orm';
import { closeSessionStreams, closeUserStreams } from '#lib/server/sessionStreams';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

export function generateId(len = 24): string {
	return randomBytes(len).toString('base64url').slice(0, len);
}

export function now(): number {
	return Math.floor(Date.now() / 1000);
}

export function hashPassword(password: string): string {
	const salt = randomBytes(16).toString('hex');
	const hash = scryptSync(password, salt, 64).toString('hex');
	return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
	const [salt, hash] = stored.split(':');
	const hashBuf = Buffer.from(hash, 'hex');
	const derived = scryptSync(password, salt, 64);
	return timingSafeEqual(hashBuf, derived);
}

export async function createUser(
	username: string,
	password: string,
	role: 'admin' | 'user' = 'user',
	mustChangePassword = false
) {
	const id = generateId();
	const ts = now();
	db.insert(users)
		.values({
			id,
			username,
			passwordHash: hashPassword(password),
			role,
			mustChangePassword,
			createdAt: ts,
			updatedAt: ts
		})
		.run();
	return id;
}

export async function login(
	username: string,
	password: string
): Promise<{ sessionId: string } | null> {
	const user = db.select().from(users).where(eq(users.username, username.trim())).get();
	if (!user) return null;
	if (!verifyPassword(password.trim(), user.passwordHash)) return null;

	const sessionId = generateId(32);
	const ts = now();
	const expiresAt = ts + 60 * 60 * 24 * 30; // 30 Tage

	db.insert(sessions)
		.values({ id: sessionId, userId: user.id, expiresAt, createdAt: ts })
		.run();

	db.update(users).set({ lastLoginAt: ts }).where(eq(users.id, user.id)).run();

	return { sessionId };
}

export function getSession(sessionId: string) {
	const session = db.select().from(sessions).where(eq(sessions.id, sessionId)).get();
	if (!session) return null;
	if (session.expiresAt < now()) {
		db.delete(sessions).where(eq(sessions.id, sessionId)).run();
		return null;
	}
	const user = db.select().from(users).where(eq(users.id, session.userId)).get();
	return user ?? null;
}

export function logout(sessionId: string) {
	db.delete(sessions).where(eq(sessions.id, sessionId)).run();
	closeSessionStreams(sessionId);
}

export function changePassword(userId: string, newPassword: string, keepSessionId?: string, keepPushDeviceId?: string) {
	const passwordHash = hashPassword(newPassword.trim());
	db.transaction(() => {
		db.update(users)
			.set({ passwordHash, mustChangePassword: false, updatedAt: now() })
			.where(eq(users.id, userId))
			.run();
		db.delete(sessions).where(and(eq(sessions.userId, userId), keepSessionId ? ne(sessions.id, keepSessionId) : undefined)).run();
		db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, userId), keepPushDeviceId ? ne(pushSubscriptions.id, keepPushDeviceId) : undefined)).run();
		db.update(userInvites).set({ usedAt: now(), tokenValue: null }).where(eq(userInvites.userId, userId)).run();
	});
	closeUserStreams(userId, keepSessionId);
}

export function bootstrapAdmin() {
	const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
	const adminPassword = process.env.ADMIN_PASSWORD;
	const adminPasswordReset = process.env.ADMIN_PASSWORD_RESET;

	const anyUser = db.select().from(users).get();

	// First start: at least one admin must exist. Require env vars.
	if (!anyUser) {
		if (!adminPassword?.trim() || adminPassword.trim() === 'changeme123') {
			throw new Error('[groly] ADMIN_PASSWORD environment variable is required on first start');
		}
		createUser(adminUsername, adminPassword, 'admin', false);
		console.log(`[groly] Admin-User "${adminUsername}" angelegt.`);
		return;
	}

	// Recovery path: if ADMIN_PASSWORD_RESET is set, reset password for the ADMIN_USERNAME user
	// and invalidate all their existing sessions. ADMIN_PASSWORD is NEVER applied after first start
	// (existing admins might have changed it long ago — overwriting would lock them out).
	if (adminPasswordReset) {
		const target = db.select().from(users).where(eq(users.username, adminUsername)).get();
		if (target) {
			changePassword(target.id, adminPasswordReset);
			db.update(users)
				.set({
					mustChangePassword: false,
					role: 'admin',
					updatedAt: now()
				})
				.where(eq(users.id, target.id))
				.run();
			db.delete(sessions).where(eq(sessions.userId, target.id)).run();
			console.warn(`[groly] WARN: ADMIN_PASSWORD_RESET applied — password for "${adminUsername}" was reset and all sessions invalidated.`);
			console.warn(`[groly] WARN: Remove the ADMIN_PASSWORD_RESET variable from your container environment after logging in.`);
		} else {
			console.warn(`[groly] WARN: ADMIN_PASSWORD_RESET is set but no user named "${adminUsername}" exists. Ignored.`);
		}
	}
}
