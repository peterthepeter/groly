CREATE TABLE IF NOT EXISTS `water_reminder_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`days` text NOT NULL,
	`time` text NOT NULL,
	`active` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `water_reminder_schedules_user_id_idx` ON `water_reminder_schedules` (`user_id`);
