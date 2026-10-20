import { db } from '#lib/db';
import { sql } from 'drizzle-orm';
import type { AdminUserEntry } from '#lib/adminUsers';

export function listAdminUsers(): AdminUserEntry[] {
	return db.all<AdminUserEntry>(sql`
		SELECT
			u.id,
			u.username,
			u.role,
			u.created_at AS createdAt,
			u.last_login_at AS lastLoginAt,
			u.must_change_password AS mustChangePassword,
			CAST(COUNT(DISTINCT l.id) AS INTEGER) AS listCount,
			CAST(COUNT(DISTINCT i.id) AS INTEGER) AS itemCount,
			CAST(COUNT(DISTINCT r.id) AS INTEGER) AS recipeCount,
			(SELECT inv.type FROM user_invites inv WHERE inv.user_id = u.id AND inv.used_at IS NULL ORDER BY inv.created_at DESC LIMIT 1) AS openInviteType,
			(SELECT inv.expires_at FROM user_invites inv WHERE inv.user_id = u.id AND inv.used_at IS NULL ORDER BY inv.created_at DESC LIMIT 1) AS openInviteExpiresAt
		FROM users u
		LEFT JOIN lists l ON l.owner_id = u.id
		LEFT JOIN items i ON i.list_id = l.id
		LEFT JOIN recipes r ON r.user_id = u.id
		GROUP BY u.id
	`);
}
