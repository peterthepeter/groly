CREATE TABLE `supplement_logs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`supplement_id` text NOT NULL,
	`amount` real NOT NULL,
	`logged_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_logs_user_id_idx` ON `supplement_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `supplement_logs_logged_at_idx` ON `supplement_logs` (`logged_at`);--> statement-breakpoint
CREATE TABLE `supplement_nutrients` (
	`id` text PRIMARY KEY NOT NULL,
	`supplement_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_per_unit` real NOT NULL,
	`unit` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`supplement_id`) REFERENCES `supplements`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_nutrients_supplement_id_idx` ON `supplement_nutrients` (`supplement_id`);--> statement-breakpoint
CREATE TABLE `supplements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`notes` text,
	`active` integer DEFAULT true NOT NULL,
	`reminder_time` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplements_user_id_idx` ON `supplements` (`user_id`);