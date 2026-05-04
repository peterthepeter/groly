CREATE TABLE IF NOT EXISTS `meditation_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`duration_seconds` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `meditation_logs_user_id_idx` ON `meditation_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `meditation_logs_logged_at_idx` ON `meditation_logs` (`logged_at`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `meditation_reminder_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`time` text NOT NULL,
	`only_if_not_meditated` integer NOT NULL DEFAULT 1,
	`active` integer NOT NULL DEFAULT 1,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `meditation_reminder_schedules_user_id_idx` ON `meditation_reminder_schedules` (`user_id`);
