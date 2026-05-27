ALTER TABLE `recipes` ADD COLUMN `is_favorite` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `rating` integer;
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `cook_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `recipes` ADD COLUMN `last_cooked_at` integer;
--> statement-breakpoint
CREATE TABLE `recipe_tags` (
	`recipe_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`recipe_id`, `tag`),
	FOREIGN KEY (`recipe_id`) REFERENCES `recipes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recipe_tags_recipe_id_idx` ON `recipe_tags` (`recipe_id`);
