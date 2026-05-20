ALTER TABLE `supplement_logs` ADD COLUMN `client_log_id` text;--> statement-breakpoint
ALTER TABLE `water_logs` ADD COLUMN `client_log_id` text;--> statement-breakpoint
ALTER TABLE `caffeine_logs` ADD COLUMN `client_log_id` text;--> statement-breakpoint
ALTER TABLE `meditation_logs` ADD COLUMN `client_log_id` text;--> statement-breakpoint
CREATE UNIQUE INDEX `supplement_logs_client_log_id_unique` ON `supplement_logs` (`user_id`,`client_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `water_logs_client_log_id_unique` ON `water_logs` (`user_id`,`client_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `caffeine_logs_client_log_id_unique` ON `caffeine_logs` (`user_id`,`client_log_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `meditation_logs_client_log_id_unique` ON `meditation_logs` (`user_id`,`client_log_id`);
