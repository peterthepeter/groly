CREATE TABLE `supplement_reminder_schedules` (
	`id` text PRIMARY KEY NOT NULL,
	`supplement_id` text NOT NULL,
	`days` text NOT NULL,
	`time` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_reminder_schedules_supplement_id_idx` ON `supplement_reminder_schedules` (`supplement_id`);