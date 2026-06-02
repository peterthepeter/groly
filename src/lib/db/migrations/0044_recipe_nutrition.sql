-- Rezept → Nutrition: einmalige Zuordnung der Zutaten zu Nährwerten, am Rezept gespeichert.
CREATE TABLE `recipe_nutrition_components` (
	`id` text PRIMARY KEY NOT NULL,
	`recipe_id` text NOT NULL,
	`ingredient_id` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`skipped` integer DEFAULT false NOT NULL,
	`product_barcode` text,
	`generic_food_id` text,
	`custom_name` text,
	`display_name` text NOT NULL,
	`image_url` text,
	`amount` real DEFAULT 0 NOT NULL,
	`unit` text DEFAULT 'g' NOT NULL,
	`grams_per_piece` real,
	`kcal_per_100` real,
	`protein_per_100` real,
	`fat_per_100` real,
	`carbs_per_100` real,
	`sugar_per_100` real,
	`fiber_per_100` real,
	`salt_per_100` real,
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_nutrition_components_recipe_id_idx` ON `recipe_nutrition_components` (`recipe_id`);
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `nutrition_mapped_servings` integer;
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `nutrition_ingredients_snapshot` text;
