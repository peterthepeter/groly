CREATE TABLE `mood_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`mood` integer NOT NULL,
	`activities` text,
	`note` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mood_logs_user_id_idx` ON `mood_logs` (`user_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `mood_logs_user_date_unique` ON `mood_logs` (`user_id`,`date`);
--> statement-breakpoint
CREATE TABLE `mood_custom_tags` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`key` text NOT NULL,
	`label` text NOT NULL,
	`category` text NOT NULL,
	`emoji` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mood_custom_tags_user_id_idx` ON `mood_custom_tags` (`user_id`);
