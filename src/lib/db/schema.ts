import { sqliteTable, text, integer, real, index, uniqueIndex, primaryKey } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
	id: text('id').primaryKey(),
	username: text('username').notNull().unique(),
	passwordHash: text('password_hash').notNull(),
	role: text('role', { enum: ['admin', 'user'] }).notNull().default('user'),
	mustChangePassword: integer('must_change_password', { mode: 'boolean' }).notNull().default(false),
	settings: text('settings'),
	settingsRevision: integer('settings_revision').notNull().default(0),
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
	isFavorite: integer('is_favorite', { mode: 'boolean' }).notNull().default(false),
	rating: integer('rating'),
	cookCount: integer('cook_count').notNull().default(0),
	lastCookedAt: integer('last_cooked_at'),
	// Nutrition-Tracking: einmalige Zuordnung der Zutaten zu Nährwerten lebt am Rezept
	// (Komponenten in recipe_nutrition_components). mappedServings = servings beim Zuordnen
	// (Teiler für „pro Portion"). snapshot = Zutaten-Namen beim Zuordnen, um „veraltet" zu erkennen.
	nutritionMappedServings: integer('nutrition_mapped_servings'),
	nutritionIngredientsSnapshot: text('nutrition_ingredients_snapshot'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
});

export const recipeTags = sqliteTable('recipe_tags', {
	recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
	tag: text('tag').notNull()
}, (t) => [
	primaryKey({ columns: [t.recipeId, t.tag] }),
	index('recipe_tags_recipe_id_idx').on(t.recipeId)
]);

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

export const categoryPreferences = sqliteTable('category_preferences', {
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	normalizedName: text('normalized_name').notNull(),
	categoryOverride: text('category_override').notNull(),
	updatedAt: integer('updated_at').notNull()
}, (t) => [
	primaryKey({ columns: [t.userId, t.normalizedName] }),
	index('category_preferences_user_id_idx').on(t.userId)
]);

export const appMeta = sqliteTable('app_meta', {
	key: text('key').primaryKey(),
	value: text('value').notNull()
});

export const barcodeCache = sqliteTable('barcode_cache', {
	barcode: text('barcode').primaryKey(),
	name: text('name').notNull(),
	brand: text('brand'),
	imageUrl: text('image_url'),
	servingSize: text('serving_size'), // z.B. "150g"
	servingQuantity: real('serving_quantity'), // numerischer Wert der Portion in g/ml
	nutriscoreGrade: text('nutriscore_grade'), // "a" - "e"
	novaGroup: integer('nova_group'), // 1 - 4
	kcalPer100: real('kcal_per_100'),
	proteinPer100: real('protein_per_100'),
	fatPer100: real('fat_per_100'),
	carbsPer100: real('carbs_per_100'),
	sugarPer100: real('sugar_per_100'),
	fiberPer100: real('fiber_per_100'),
	saltPer100: real('salt_per_100'),
	nutrimentsJson: text('nutriments_json'), // komplettes OFF-Nutriment-Objekt als JSON (für zukünftige Mikronährstoffe)
	fetchedAt: integer('fetched_at'), // wann zuletzt von OFF aktualisiert
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
	note: text('note'),
	clientLogId: text('client_log_id'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('supplement_logs_user_id_idx').on(t.userId),
	index('supplement_logs_logged_at_idx').on(t.loggedAt),
	uniqueIndex('supplement_logs_client_log_id_unique').on(t.userId, t.clientLogId)
]);

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
export type RecipeTag = typeof recipeTags.$inferSelect;
export type BarcodeCache = typeof barcodeCache.$inferSelect;
export type RecipeIngredientExclusion = typeof recipeIngredientExclusions.$inferSelect;
export type ItemHistory = typeof itemHistory.$inferSelect;
export type MealPlanEntry = typeof mealPlanEntries.$inferSelect;
export type Favorite = typeof favorites.$inferSelect;
export type CategoryPreference = typeof categoryPreferences.$inferSelect;
export const supplementReminderSchedules = sqliteTable('supplement_reminder_schedules', {
	id: text('id').primaryKey(),
	supplementId: text('supplement_id').notNull().references(() => supplements.id, { onDelete: 'cascade' }),
	days: text('days').notNull(), // JSON-Array, z.B. "[1,2,3,4,5]" (0=So, 1=Mo, ..., 6=Sa)
	time: text('time').notNull(), // "HH:MM"
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('supplement_reminder_schedules_supplement_id_idx').on(t.supplementId)]);

export const supplementReminderOverrides = sqliteTable('supplement_reminder_overrides', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	date: text('date').notNull(), // YYYY-MM-DD
	reminderTime: text('reminder_time').notNull(), // HH:MM
	done: integer('done', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('supplement_reminder_overrides_user_date_idx').on(t.userId, t.date),
	uniqueIndex('supplement_reminder_overrides_unique').on(t.userId, t.date, t.reminderTime)
]);

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
	clientLogId: text('client_log_id'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('water_logs_user_id_idx').on(t.userId),
	index('water_logs_logged_at_idx').on(t.loggedAt),
	uniqueIndex('water_logs_client_log_id_unique').on(t.userId, t.clientLogId)
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
	clientLogId: text('client_log_id'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('caffeine_logs_user_id_idx').on(t.userId),
	index('caffeine_logs_logged_at_idx').on(t.loggedAt),
	uniqueIndex('caffeine_logs_client_log_id_unique').on(t.userId, t.clientLogId)
]);

export const meditationLogs = sqliteTable('meditation_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	durationSeconds: integer('duration_seconds').notNull(),
	loggedAt: integer('logged_at').notNull(),
	clientLogId: text('client_log_id'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('meditation_logs_user_id_idx').on(t.userId),
	index('meditation_logs_logged_at_idx').on(t.loggedAt),
	uniqueIndex('meditation_logs_client_log_id_unique').on(t.userId, t.clientLogId)
]);

export const meditationReminderSchedules = sqliteTable('meditation_reminder_schedules', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	time: text('time').notNull(), // "HH:MM"
	onlyIfNotMeditated: integer('only_if_not_meditated', { mode: 'boolean' }).notNull().default(true),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('meditation_reminder_schedules_user_id_idx').on(t.userId)]);

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
export type MeditationLog = typeof meditationLogs.$inferSelect;
export type MeditationReminderSchedule = typeof meditationReminderSchedules.$inferSelect;
export type SupplementReminderOverride = typeof supplementReminderOverrides.$inferSelect;

export const moodLogs = sqliteTable('mood_logs', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	date: text('date').notNull(), // YYYY-MM-DD
	mood: integer('mood').notNull(), // 1–5
	activities: text('activities'), // JSON array of tag keys
	note: text('note'),
	gratitude: text('gratitude'),
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
}, (t) => [
	index('mood_logs_user_id_idx').on(t.userId),
	uniqueIndex('mood_logs_user_date_unique').on(t.userId, t.date)
]);

export const moodCustomTags = sqliteTable('mood_custom_tags', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	key: text('key').notNull(),
	label: text('label').notNull(),
	category: text('category').notNull(),
	emoji: text('emoji'),
	sortOrder: integer('sort_order').notNull().default(0),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('mood_custom_tags_user_id_idx').on(t.userId)]);

export const moodReminderSchedules = sqliteTable('mood_reminder_schedules', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	days: text('days').notNull(), // JSON-Array "[1,2,3,4,5]" (0=So,1=Mo,...,6=Sa)
	time: text('time').notNull(), // "HH:MM"
	onlyIfNotRated: integer('only_if_not_rated', { mode: 'boolean' }).notNull().default(true),
	active: integer('active', { mode: 'boolean' }).notNull().default(true),
	createdAt: integer('created_at').notNull()
}, (t) => [index('mood_reminder_schedules_user_id_idx').on(t.userId)]);

export type MoodLog = typeof moodLogs.$inferSelect;
export type MoodCustomTag = typeof moodCustomTags.$inferSelect;
export type MoodReminderSchedule = typeof moodReminderSchedules.$inferSelect;

export const userInvites = sqliteTable('user_invites', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	tokenHash: text('token_hash').notNull().unique(),
	type: text('type', { enum: ['invite', 'reset'] }).notNull(),
	createdAt: integer('created_at').notNull(),
	expiresAt: integer('expires_at').notNull(),
	usedAt: integer('used_at')
}, (t) => [
	index('user_invites_user_id_idx').on(t.userId),
	index('user_invites_expires_at_idx').on(t.expiresAt)
]);

export type UserInvite = typeof userInvites.$inferSelect;

// =========================================================================
// Nutrition / Ernährungs-Tracker
// =========================================================================

// Kuratierte Grundlebensmittel (Apfel, Kartoffel, Milch, ...). Wird beim
// Startup geseedet aus data/genericFoods.json. Sucht in name+keywords (de+en).
export const genericFoods = sqliteTable('generic_foods', {
	id: text('id').primaryKey(), // stable slug, z.B. "apple-raw"
	category: text('category').notNull(), // "fruit", "vegetable", "grain", ...
	nameDe: text('name_de').notNull(),
	nameEn: text('name_en').notNull(),
	keywordsDe: text('keywords_de'), // komma-separierte Synonyme
	keywordsEn: text('keywords_en'),
	kcalPer100: real('kcal_per_100').notNull(),
	proteinPer100: real('protein_per_100'),
	fatPer100: real('fat_per_100'),
	carbsPer100: real('carbs_per_100'),
	sugarPer100: real('sugar_per_100'),
	fiberPer100: real('fiber_per_100'),
	saltPer100: real('salt_per_100'),
	defaultPieceWeight: real('default_piece_weight'), // g pro Stück, falls "piece" sinnvoll
	defaultUnit: text('default_unit', { enum: ['g', 'ml', 'piece'] }).notNull().default('g'),
	sortOrder: integer('sort_order').notNull().default(0)
}, (t) => [
	index('generic_foods_category_idx').on(t.category)
]);

// Eine geloggte Mahlzeit (Container)
export const meals = sqliteTable('meals', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	name: text('name').notNull(), // "Frühstück", "Mittag", "Mein Müsli", ...
	date: text('date').notNull(), // YYYY-MM-DD
	time: text('time').notNull(), // HH:MM
	imageUrl: text('image_url'), // optionales Bild, wenn aus Vorlage getrackt
	favoriteName: text('favorite_name'), // Gericht-Name aus Vorlage (z.B. "Müsli"), nur wenn aus Vorlage
	createdAt: integer('created_at').notNull(),
	updatedAt: integer('updated_at').notNull()
}, (t) => [
	index('meals_user_date_idx').on(t.userId, t.date)
]);

// Komponenten einer Mahlzeit (Skyr, Haferflocken, Banane, ...)
// Snapshots der Nährwerte fix beim Loggen, damit Historie stabil bleibt.
export const mealComponents = sqliteTable('meal_components', {
	id: text('id').primaryKey(),
	mealId: text('meal_id').notNull().references(() => meals.id, { onDelete: 'cascade' }),
	sortOrder: integer('sort_order').notNull().default(0),
	// Quelle:
	productBarcode: text('product_barcode'), // → barcodeCache
	genericFoodId: text('generic_food_id'), // → genericFoods
	customName: text('custom_name'), // freier Name wenn keine Quelle
	// Anzeige (Snapshot):
	displayName: text('display_name').notNull(),
	imageUrl: text('image_url'),
	// Menge:
	amount: real('amount').notNull(),
	unit: text('unit', { enum: ['g', 'ml', 'piece'] }).notNull(),
	gramsPerPiece: real('grams_per_piece'), // nur wenn unit='piece'
	// Snapshot per 100g (für späteres Editieren ohne erneutes Lookup):
	kcalPer100: real('kcal_per_100'),
	proteinPer100: real('protein_per_100'),
	fatPer100: real('fat_per_100'),
	carbsPer100: real('carbs_per_100'),
	sugarPer100: real('sugar_per_100'),
	fiberPer100: real('fiber_per_100'),
	saltPer100: real('salt_per_100'),
	// Total für diese Komponente (kcal/protein/... gesamt):
	kcal: real('kcal').notNull().default(0),
	protein: real('protein').notNull().default(0),
	fat: real('fat').notNull().default(0),
	carbs: real('carbs').notNull().default(0),
	sugar: real('sugar').notNull().default(0),
	fiber: real('fiber').notNull().default(0),
	salt: real('salt').notNull().default(0)
}, (t) => [
	index('meal_components_meal_id_idx').on(t.mealId)
]);

// Favoriten: einzelne Produkte/Items, die der User oft loggt
export const nutritionFavorites = sqliteTable('nutrition_favorites', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	displayName: text('display_name').notNull(),
	imageUrl: text('image_url'),
	// genau eines davon:
	productBarcode: text('product_barcode'),
	genericFoodId: text('generic_food_id'),
	// für custom-Favoriten (kein OFF, kein generic):
	customKcalPer100: real('custom_kcal_per_100'),
	customProteinPer100: real('custom_protein_per_100'),
	customFatPer100: real('custom_fat_per_100'),
	customCarbsPer100: real('custom_carbs_per_100'),
	customSugarPer100: real('custom_sugar_per_100'),
	customFiberPer100: real('custom_fiber_per_100'),
	customSaltPer100: real('custom_salt_per_100'),
	// Default-Portion:
	defaultAmount: real('default_amount').notNull().default(100),
	defaultUnit: text('default_unit', { enum: ['g', 'ml', 'piece'] }).notNull().default('g'),
	defaultGramsPerPiece: real('default_grams_per_piece'),
	useCount: integer('use_count').notNull().default(0),
	lastUsedAt: integer('last_used_at'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('nutrition_favorites_user_id_idx').on(t.userId)
]);

// Mahlzeit-Favoriten: ganze Mahlzeit als Template ("Mein Müsli")
export const nutritionMealFavorites = sqliteTable('nutrition_meal_favorites', {
	id: text('id').primaryKey(),
	userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
	displayName: text('display_name').notNull(),
	defaultMealName: text('default_meal_name'), // optionaler Name für die erzeugte Mahlzeit
	imageUrl: text('image_url'), // eigenes Bild der Vorlage
	// Optionale Verknüpfung zu einem Koffein-Getränk: beim Loggen dieser Vorlage
	// wird zusätzlich ein Koffein-Log erzeugt (Nutrition → Koffein, eine Richtung).
	caffeineDrinkId: text('caffeine_drink_id'),
	useCount: integer('use_count').notNull().default(0),
	lastUsedAt: integer('last_used_at'),
	createdAt: integer('created_at').notNull()
}, (t) => [
	index('nutrition_meal_favorites_user_id_idx').on(t.userId)
]);

// Komponenten eines Mahlzeit-Favoriten (selbe Struktur wie mealComponents)
export const nutritionMealFavoriteComponents = sqliteTable('nutrition_meal_favorite_components', {
	id: text('id').primaryKey(),
	mealFavoriteId: text('meal_favorite_id').notNull().references(() => nutritionMealFavorites.id, { onDelete: 'cascade' }),
	sortOrder: integer('sort_order').notNull().default(0),
	productBarcode: text('product_barcode'),
	genericFoodId: text('generic_food_id'),
	customName: text('custom_name'),
	displayName: text('display_name').notNull(),
	imageUrl: text('image_url'),
	amount: real('amount').notNull(),
	unit: text('unit', { enum: ['g', 'ml', 'piece'] }).notNull(),
	gramsPerPiece: real('grams_per_piece'),
	kcalPer100: real('kcal_per_100'),
	proteinPer100: real('protein_per_100'),
	fatPer100: real('fat_per_100'),
	carbsPer100: real('carbs_per_100'),
	sugarPer100: real('sugar_per_100'),
	fiberPer100: real('fiber_per_100'),
	saltPer100: real('salt_per_100')
}, (t) => [
	index('nutrition_meal_favorite_components_parent_idx').on(t.mealFavoriteId)
]);

// Nährwert-Zuordnung der Zutaten eines Rezepts (selbe Struktur wie mealComponents).
// Erfasst die ganze Rezeptmenge (für recipes.nutritionMappedServings Portionen).
// ingredientId verlinkt locker auf recipe_ingredients (kann veralten); skipped = bewusst „zählt nicht".
export const recipeNutritionComponents = sqliteTable('recipe_nutrition_components', {
	id: text('id').primaryKey(),
	recipeId: text('recipe_id').notNull().references(() => recipes.id, { onDelete: 'cascade' }),
	ingredientId: text('ingredient_id'),
	sortOrder: integer('sort_order').notNull().default(0),
	skipped: integer('skipped', { mode: 'boolean' }).notNull().default(false),
	productBarcode: text('product_barcode'),
	genericFoodId: text('generic_food_id'),
	customName: text('custom_name'),
	displayName: text('display_name').notNull(),
	imageUrl: text('image_url'),
	amount: real('amount').notNull().default(0),
	unit: text('unit', { enum: ['g', 'ml', 'piece'] }).notNull().default('g'),
	gramsPerPiece: real('grams_per_piece'),
	kcalPer100: real('kcal_per_100'),
	proteinPer100: real('protein_per_100'),
	fatPer100: real('fat_per_100'),
	carbsPer100: real('carbs_per_100'),
	sugarPer100: real('sugar_per_100'),
	fiberPer100: real('fiber_per_100'),
	saltPer100: real('salt_per_100')
}, (t) => [
	index('recipe_nutrition_components_recipe_id_idx').on(t.recipeId)
]);

// Tagesziele (kcal + optional Makros)
export const nutritionGoals = sqliteTable('nutrition_goals', {
	userId: text('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
	dailyKcal: integer('daily_kcal'),
	dailyProtein: real('daily_protein'),
	dailyFat: real('daily_fat'),
	dailyCarbs: real('daily_carbs'),
	dailyFiber: real('daily_fiber'),
	updatedAt: integer('updated_at').notNull()
});

export type GenericFood = typeof genericFoods.$inferSelect;
export type Meal = typeof meals.$inferSelect;
export type MealComponent = typeof mealComponents.$inferSelect;
export type NutritionFavorite = typeof nutritionFavorites.$inferSelect;
export type NutritionMealFavorite = typeof nutritionMealFavorites.$inferSelect;
export type NutritionMealFavoriteComponent = typeof nutritionMealFavoriteComponents.$inferSelect;
export type RecipeNutritionComponent = typeof recipeNutritionComponents.$inferSelect;
export type NutritionGoal = typeof nutritionGoals.$inferSelect;
