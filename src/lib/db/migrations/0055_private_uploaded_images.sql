CREATE TABLE `uploaded_image_access` (
	`image_url` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`image_url`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `uploaded_image_access_user_id_idx` ON `uploaded_image_access` (`user_id`);
--> statement-breakpoint
-- Old uploads have no owner metadata. Preserve the accounts whose records already refer to each file.
INSERT OR IGNORE INTO `uploaded_image_access` (`image_url`, `user_id`)
SELECT trim(image_url), user_id
FROM (
	SELECT image_url, user_id FROM recipes
	UNION ALL
	SELECT image_url, user_id FROM meals
	UNION ALL
	SELECT image_url, user_id FROM nutrition_favorites
	UNION ALL
	SELECT image_url, user_id FROM nutrition_meal_favorites
	UNION ALL
	SELECT c.image_url, m.user_id FROM meal_components c JOIN meals m ON m.id = c.meal_id
	UNION ALL
	SELECT c.image_url, f.user_id FROM nutrition_meal_favorite_components c JOIN nutrition_meal_favorites f ON f.id = c.meal_favorite_id
	UNION ALL
	SELECT c.image_url, r.user_id FROM recipe_nutrition_components c JOIN recipes r ON r.id = c.recipe_id
)
WHERE trim(image_url) GLOB '/uploads/?*';
