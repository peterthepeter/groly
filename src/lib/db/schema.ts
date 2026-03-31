import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
	settings: text('settings'),
	lastLoginAt: integer('last_login_at'),
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
	iconId: text('icon_id'),
	ownerId: text('owner_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const listMembers = sqliteTable('list_members', {
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	permission: text('permission', { enum: ['read', 'write'] }).notNull().default('read'),
	status: text('status', { enum: ['pending', 'accepted'] }).notNull().default('accepted'),
	notificationsEnabled: integer('notifications_enabled', { mode: 'boolean' }).notNull().default(true)
});

export const listNotificationPrefs = sqliteTable('list_notification_prefs', {
	listId: text('list_id')
		.notNull()
		.references(() => lists.id, { onDelete: 'cascade' }),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true)
});

export const pushSubscriptions = sqliteTable('push_subscriptions', {
	id: text('id').primaryKey(),
	userId: text('user_id')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	endpoint: text('endpoint').notNull().unique(),
	auth: text('auth').notNull(),
	p256dh: text('p256dh').notNull(),
	createdAt: integer('created_at').notNull()
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
	categoryOverride: text('category_override'),
	createdBy: text('created_by').references(() => users.id),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const recipes = sqliteTable('recipes', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	title: text('title').notNull(),
	description: text('description'),
	imageUrl: text('image_url'),
	sourceUrl: text('source_url'),
	servings: integer('servings').notNull().default(4),
	prepTime: integer('prep_time'),
	cookTime: integer('cook_time'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const recipeIngredients = sqliteTable('recipe_ingredients', {
	id: text('id').primaryKey(),
	recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
	amount: text('amount'),
	unit: text('unit'),
	name: text('name').notNull(),
	sortOrder: integer('sort_order').notNull().default(0)
}, (t) => [index('recipe_ingredients_recipe_id_idx').on(t.recipeId)]);

export const recipeSteps = sqliteTable('recipe_steps', {
	id: text('id').primaryKey(),
	recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
	stepNumber: integer('step_number').notNull(),
	text: text('text').notNull()
}, (t) => [index('recipe_steps_recipe_id_idx').on(t.recipeId)]);

export const recipeShares = sqliteTable('recipe_shares', {
	id: text('id').primaryKey(),
	senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	receiverId: text('receiver_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
	status: text('status', { enum: ['pending', 'accepted', 'declined'] }).notNull().default('pending'),
	createdAt: integer('created_at').notNull()
});

export const appMeta = sqliteTable('app_meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export type User = typeof users.$inferSelect;
export type List = typeof lists.$inferSelect;
export type Item = typeof items.$inferSelect;
export type ListMember = typeof listMembers.$inferSelect;
export type PushSubscription = typeof pushSubscriptions.$inferSelect;
export type ListNotificationPref = typeof listNotificationPrefs.$inferSelect;
export type Recipe = typeof recipes.$inferSelect;
export type RecipeIngredient = typeof recipeIngredients.$inferSelect;
export type RecipeStep = typeof recipeSteps.$inferSelect;
export type RecipeShare = typeof recipeShares.$inferSelect;
