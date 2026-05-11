CREATE TABLE `mood_reminder_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`days` text NOT NULL,
	`time` text NOT NULL,
	`only_if_not_rated` integer NOT NULL DEFAULT 1,
	`active` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `mood_reminder_schedules_user_id_idx` ON `mood_reminder_schedules` (`user_id`);
