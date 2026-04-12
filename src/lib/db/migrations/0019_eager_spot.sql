CREATE TABLE `favorites` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`quantity_info` text,
	`category_override` text,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `name`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
