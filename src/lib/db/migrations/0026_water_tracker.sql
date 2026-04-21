CREATE TABLE IF NOT EXISTS `water_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
	`amount_ml` integer NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `water_logs_user_id_idx` ON `water_logs` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `water_logs_logged_at_idx` ON `water_logs` (`logged_at`);
