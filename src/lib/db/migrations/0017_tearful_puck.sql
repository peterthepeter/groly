CREATE TABLE `item_history` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`use_count` integer DEFAULT 1 NOT NULL,
	`last_used_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `name`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
