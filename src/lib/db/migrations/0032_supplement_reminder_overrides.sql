CREATE TABLE `supplement_reminder_overrides` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`date` text NOT NULL,
	`reminder_time` text NOT NULL,
	`done` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_reminder_overrides_user_date_idx` ON `supplement_reminder_overrides` (`user_id`,`date`);
--> statement-breakpoint
CREATE UNIQUE INDEX `supplement_reminder_overrides_unique` ON `supplement_reminder_overrides` (`user_id`,`date`,`reminder_time`);
