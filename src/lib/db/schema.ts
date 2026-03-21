import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const sessions = sqliteTable('sessions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expiresAt: integer('expires_at').notNull(),
	createdAt: integer('created_at').notNull()
});

export const lists = sqliteTable('lists', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	description: text('description'),
	ownerId: text('owner_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

// Vorbereitet für Listen-Sharing (Phase 2)
export const listMembers = sqliteTable('list_members', {
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	permission: text('permission', { enum: ['read', 'write'] }).notNull().default('read')
});

export const items = sqliteTable('items', {
	id: text('id').primaryKey(),
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	quantityInfo: text('quantity_info'),
	isChecked: integer('is_checked', { mode: 'boolean' }).notNull().default(false),
	checkedAt: integer('checked_at'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export type User = typeof users.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
