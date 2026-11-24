CREATE TABLE `recipe_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`sort_order` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `recipe_categories_user_name_idx` ON `recipe_categories` (`user_id`,`normalized_name`);--> statement-breakpoint
ALTER TABLE `recipes` ADD `category_id` text REFERENCES recipe_categories(id) ON DELETE SET NULL;
--> statement-breakpoint
INSERT INTO `recipe_categories` (`id`, `user_id`, `name`, `normalized_name`, `sort_order`)
SELECT 'legacy-favorites:' || `id`, `id`, `name`, lower(`name`), 0
FROM (
	SELECT u.`id`, CASE WHEN CASE WHEN json_valid(u.`settings`) THEN json_extract(u.`settings`, '$.lang') END = 'de'
		THEN 'Favoriten' ELSE 'Favorites' END AS `name`
	FROM `users` u
	WHERE EXISTS (SELECT 1 FROM `recipes` r WHERE r.`user_id` = u.`id` AND r.`is_favorite` = 1)
);
--> statement-breakpoint
UPDATE `recipes` SET `category_id` = 'legacy-favorites:' || `user_id` WHERE `is_favorite` = 1;
