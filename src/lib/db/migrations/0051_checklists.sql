CREATE TABLE `checklist_favorites` (
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `name`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `checklist_reminders` (
	`item_id` text NOT NULL,
	`user_id` text NOT NULL,
	`due_at` integer NOT NULL,
	`next_attempt_at` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	PRIMARY KEY(`item_id`, `user_id`),
	FOREIGN KEY (`item_id`) REFERENCES `items`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `checklist_reminders_due_idx` ON `checklist_reminders` (`status`,`next_attempt_at`);--> statement-breakpoint
ALTER TABLE `items` ADD `section_id` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `kind` text DEFAULT 'shopping' NOT NULL;--> statement-breakpoint
ALTER TABLE `lists` ADD `checklist_sections` text;--> statement-breakpoint
ALTER TABLE `lists` ADD `default_section_id` text;