import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';

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
	locationLat: real('location_lat'),
	locationLng: real('location_lng'),
	locationName: text('location_name'),
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

export const recipeIngredientExclusions = sqliteTable('recipe_ingredient_exclusions', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	ingredientId: text('ingredient_id').notNull().references(() => recipeIngredients.id, { onDelete: 'cascade' })
}, (t) => [primaryKey({ columns: [t.userId, t.ingredientId] })]);

export const favorites = sqliteTable('favorites', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	quantityInfo: text('quantity_info'),
	categoryOverride: text('category_override'),
	createdAt: integer('created_at').notNull()
}, (t) => [primaryKey({ columns: [t.userId, t.name] })]);

export const appMeta = sqliteTable('app_meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const barcodeCache = sqliteTable('barcode_cache', {
	barcode: text('barcode').primaryKey(),
	name: text('name').notNull(),
	lastSeenAt: integer('last_seen_at').notNull()
});

export const itemHistory = sqliteTable('item_history', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	useCount: integer('use_count').notNull().default(1),
	lastUsedAt: integer('last_used_at').notNull()
}, (t) => [primaryKey({ columns: [t.userId, t.name] })]);

export const mealPlanEntries = sqliteTable('meal_plan_entries', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	date: text('date').notNull(), // YYYY-MM-DD
	recipeId: text('recipe_id').references(() => recipes.id, { onDelete: 'set null' }),
	note: text('note'),
	servings: integer('servings'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
}, (t) => [index('meal_plan_entries_user_date_idx').on(t.userId, t.date)]);

export const supplements = sqliteTable('supplements', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	unit: text('unit').notNull(), // z.B. "Kapsel", "g", "ml"
	brand: text('brand'),         // Hersteller, optional
	info: text('info'),           // Zusatzinfo, optional
	notes: text('notes'),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	reminderTime: text('reminder_time'), // "HH:MM" – für Reminder-Feature v2 vorbereitet
	stockQuantity: real('stock_quantity'), // aktueller Vorrat in der Einheit (null = kein Tracking)
	defaultAmount: real('default_amount').notNull().default(1), // vorausgefüllte Menge im Quick-Log
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
}, (t) => [index('supplements_user_id_idx').on(t.userId)]);

export const supplementNutrients = sqliteTable('supplement_nutrients', {
	id: text('id').primaryKey(),
	supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
	name: text('name').notNull(), // z.B. "Magnesium", "EPA", "Kreatin"
	amountPerUnit: real('amount_per_unit').notNull(), // z.B. 200
	unit: text('unit').notNull(), // z.B. "mg", "µg", "g", "IU"
	sortOrder: integer('sort_order').notNull().default(0)
}, (t) => [index('supplement_nutrients_supplement_id_idx').on(t.supplementId)]);

export const supplementLogs = sqliteTable('supplement_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
	amount: real('amount').notNull(), // z.B. 2.0 = 2 Kapseln
	loggedAt: integer('logged_at').notNull(), // Unix ms inkl. Uhrzeit
	createdAt: integer('created_at').notNull()
}, (t) => [index('supplement_logs_user_id_idx').on(t.userId), index('supplement_logs_logged_at_idx').on(t.loggedAt)]);

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
export type BarcodeCache = typeof barcodeCache.$inferSelect;
export type RecipeIngredientExclusion = typeof recipeIngredientExclusions.$inferSelect;
export type ItemHistory = typeof itemHistory.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export const supplementReminderSchedules = sqliteTable('supplement_reminder_schedules', {
	id: text('id').primaryKey(),
	supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
	days: text('days').notNull(), // JSON-Array, z.B. "[1,2,3,4,5]" (0=So, 1=Mo, ..., 6=Sa)
	time: text('time').notNull(), // "HH:MM"
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('supplement_reminder_schedules_supplement_id_idx').on(t.supplementId)]);

export const supplementCatalog = sqliteTable('supplement_catalog', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	unit: text('unit').notNull(),
	brand: text('brand'),
	info: text('info'),
	packageSize: real('package_size'), // Packungsinhalt, z.B. 120 (Kapseln)
	createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const supplementCatalogNutrients = sqliteTable('supplement_catalog_nutrients', {
	id: text('id').primaryKey(),
	catalogId: text('catalog_id').notNull().references(() => supplementCatalog.id, { onDelete: 'cascade' }),
	name: text('name').notNull(),
	amountPerUnit: real('amount_per_unit').notNull(),
	unit: text('unit').notNull(),
	sortOrder: integer('sort_order').notNull().default(0)
}, (t) => [index('supplement_catalog_nutrients_catalog_id_idx').on(t.catalogId)]);

export const waterLogs = sqliteTable('water_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	amountMl: integer('amount_ml').notNull(),
	loggedAt: integer('logged_at').notNull(),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('water_logs_user_id_idx').on(t.userId),
	index('water_logs_logged_at_idx').on(t.loggedAt)
]);

export const waterReminderSchedules = sqliteTable('water_reminder_schedules', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	days: text('days').notNull(), // JSON-Array "[1,2,3,4,5]" (0=So, 1=Mo, ..., 6=Sa)
	startTime: text('start_time').notNull(), // "HH:MM"
	endTime: text('end_time').notNull(), // "HH:MM"
	intervalMinutes: integer('interval_minutes').notNull().default(90),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('water_reminder_schedules_user_id_idx').on(t.userId)]);

export const caffeineDrinks = sqliteTable('caffeine_drinks', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	defaultMl: integer('default_ml').notNull(),
	caffeineMg: integer('caffeine_mg').notNull(),
	sortOrder: integer('sort_order').notNull().default(0),
	createdAt: integer('created_at').notNull()
});

export const caffeineLogs = sqliteTable('caffeine_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	drinkName: text('drink_name').notNull(),
	amountMl: integer('amount_ml').notNull(),
	caffeineMg: integer('caffeine_mg').notNull(),
	loggedAt: integer('logged_at').notNull(),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('caffeine_logs_user_id_idx').on(t.userId),
	index('caffeine_logs_logged_at_idx').on(t.loggedAt)
]);

export type Supplement = typeof supplements.$inferSelect;
export type SupplementNutrient = typeof supplementNutrients.$inferSelect;
export type SupplementLog = typeof supplementLogs.$inferSelect;
export type SupplementReminderSchedule = typeof supplementReminderSchedules.$inferSelect;
export type SupplementCatalog = typeof supplementCatalog.$inferSelect;
export type SupplementCatalogNutrient = typeof supplementCatalogNutrients.$inferSelect;
export type WaterLog = typeof waterLogs.$inferSelect;
export type WaterReminderSchedule = typeof waterReminderSchedules.$inferSelect;
export type CaffeineDrink = typeof caffeineDrinks.$inferSelect;
export type CaffeineLog = typeof caffeineLogs.$inferSelect;
