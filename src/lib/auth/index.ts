import { db } from '$lib/db';
import { users, sessions } from '$lib/db/schema';
import { eq } from 'drizzle-orm';
import { randomBytes, scryptSync, timingSafeEqual } from 'crypto';

function generateId(len = 24): string {
	return randomBytes(len).toString('base64url').slice(0, len);
}

function now(): number {
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
): Promise<{ sessionId: string; mustChangePassword: boolean } | null> {
	const user = db.select().from(users).where(eq(users.username, username)).get();
	if (!user) return null;
	if (!verifyPassword(password, user.passwordHash)) return null;

	const sessionId = generateId(32);
	const ts = now();
	const expiresAt = ts + 60 * 60 * 24 * 30; // 30 Tage

	db.insert(sessions)
		.values({ id: sessionId, userId: user.id, expiresAt, createdAt: ts })
		.run();

	db.update(users).set({ lastLoginAt: ts }).where(eq(users.id, user.id)).run();

	return { sessionId, mustChangePassword: user.mustChangePassword };
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
}

export function changePassword(userId: string, newPassword: string) {
	db.update(users)
		.set({ passwordHash: hashPassword(newPassword), mustChangePassword: false, updatedAt: now() })
		.where(eq(users.id, userId))
		.run();
}

export function bootstrapAdmin() {
	const adminUsername = process.env.ADMIN_USERNAME ?? 'admin';
	const adminPassword = process.env.ADMIN_PASSWORD;

	const existing = db.select().from(users).get();
	if (existing) return; // Bereits User vorhanden

	if (!adminPassword) {
		throw new Error('[groly] ADMIN_PASSWORD environment variable is required on first start');
	}

	createUser(adminUsername, adminPassword, 'admin', true);
	console.log(`[groly] Admin-User "${adminUsername}" angelegt.`);
}
