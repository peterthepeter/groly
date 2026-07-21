CREATE TABLE `category_preferences` (
	`user_id` text NOT NULL,
	`normalized_name` text NOT NULL,
	`category_override` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `normalized_name`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `category_preferences_user_id_idx` ON `category_preferences` (`user_id`);
