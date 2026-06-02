-- Erweitere barcode_cache um Nährwert-Felder. Bestehende Einträge bleiben erhalten
-- (alle neuen Spalten sind nullable bzw. werden beim nächsten Lookup von OFF nachgezogen).
ALTER TABLE `barcode_cache` ADD COLUMN `brand` text;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `image_url` text;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `serving_size` text;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `serving_quantity` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `nutriscore_grade` text;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `nova_group` integer;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `kcal_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `protein_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `fat_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `carbs_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `sugar_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `fiber_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `salt_per_100` real;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `nutriments_json` text;
--> statement-breakpoint
ALTER TABLE `barcode_cache` ADD COLUMN `fetched_at` integer;
--> statement-breakpoint
CREATE TABLE `generic_foods` (
	`id` text PRIMARY KEY NOT NULL,
	`category` text NOT NULL,
	`name_de` text NOT NULL,
	`name_en` text NOT NULL,
	`keywords_de` text,
	`keywords_en` text,
	`kcal_per_100` real NOT NULL,
	`protein_per_100` real,
	`fat_per_100` real,
	`carbs_per_100` real,
	`sugar_per_100` real,
	`fiber_per_100` real,
	`salt_per_100` real,
	`default_piece_weight` real,
	`default_unit` text DEFAULT 'g' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE INDEX `generic_foods_category_idx` ON `generic_foods` (`category`);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`date` text NOT NULL,
	`time` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meals_user_date_idx` ON `meals` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `meal_components` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`product_barcode` text,
	`generic_food_id` text,
	`custom_name` text,
	`display_name` text NOT NULL,
	`image_url` text,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`grams_per_piece` real,
	`kcal_per_100` real,
	`protein_per_100` real,
	`fat_per_100` real,
	`carbs_per_100` real,
	`sugar_per_100` real,
	`fiber_per_100` real,
	`salt_per_100` real,
	`kcal` real DEFAULT 0 NOT NULL,
	`protein` real DEFAULT 0 NOT NULL,
	`fat` real DEFAULT 0 NOT NULL,
	`carbs` real DEFAULT 0 NOT NULL,
	`sugar` real DEFAULT 0 NOT NULL,
	`fiber` real DEFAULT 0 NOT NULL,
	`salt` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`meal_id`) REFERENCES `meals`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `meal_components_meal_id_idx` ON `meal_components` (`meal_id`);
--> statement-breakpoint
CREATE TABLE `nutrition_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`product_barcode` text,
	`generic_food_id` text,
	`custom_kcal_per_100` real,
	`custom_protein_per_100` real,
	`custom_fat_per_100` real,
	`custom_carbs_per_100` real,
	`custom_sugar_per_100` real,
	`custom_fiber_per_100` real,
	`custom_salt_per_100` real,
	`default_amount` real DEFAULT 100 NOT NULL,
	`default_unit` text DEFAULT 'g' NOT NULL,
	`default_grams_per_piece` real,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_favorites_user_id_idx` ON `nutrition_favorites` (`user_id`);
--> statement-breakpoint
CREATE TABLE `nutrition_meal_favorites` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`default_meal_name` text,
	`use_count` integer DEFAULT 0 NOT NULL,
	`last_used_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_meal_favorites_user_id_idx` ON `nutrition_meal_favorites` (`user_id`);
--> statement-breakpoint
CREATE TABLE `nutrition_meal_favorite_components` (
	`id` text PRIMARY KEY NOT NULL,
	`meal_favorite_id` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`product_barcode` text,
	`generic_food_id` text,
	`custom_name` text,
	`display_name` text NOT NULL,
	`image_url` text,
	`amount` real NOT NULL,
	`unit` text NOT NULL,
	`grams_per_piece` real,
	`kcal_per_100` real,
	`protein_per_100` real,
	`fat_per_100` real,
	`carbs_per_100` real,
	`sugar_per_100` real,
	`fiber_per_100` real,
	`salt_per_100` real,
	FOREIGN KEY (`meal_favorite_id`) REFERENCES `nutrition_meal_favorites`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `nutrition_meal_favorite_components_parent_idx` ON `nutrition_meal_favorite_components` (`meal_favorite_id`);
--> statement-breakpoint
CREATE TABLE `nutrition_goals` (
	`user_id` text PRIMARY KEY NOT NULL,
	`daily_kcal` integer,
	`daily_protein` real,
	`daily_fat` real,
	`daily_carbs` real,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
