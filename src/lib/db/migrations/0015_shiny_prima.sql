CREATE TABLE `recipe_ingredient_exclusions` (
	`user_id` text NOT NULL,
	`ingredient_id` text NOT NULL,
	PRIMARY KEY(`user_id`, `ingredient_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`ingredient_id`) REFERENCES `recipe_ingredients`(`id`) ON UPDATE no action ON DELETE cascade
);
