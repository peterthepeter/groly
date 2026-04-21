DROP TABLE IF EXISTS `water_reminder_schedules`;
--> statement-breakpoint
CREATE TABLE `water_reminder_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`days` text NOT NULL,
	`start_time` text NOT NULL,
	`end_time` text NOT NULL,
	`interval_minutes` integer NOT NULL DEFAULT 90,
	`active` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `water_reminder_schedules_user_id_idx` ON `water_reminder_schedules` (`user_id`);
