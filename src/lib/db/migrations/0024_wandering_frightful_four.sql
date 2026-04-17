CREATE TABLE `supplement_catalog` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`unit` text NOT NULL,
	`brand` text,
	`info` text,
	`default_amount` real DEFAULT 1 NOT NULL,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `supplement_catalog_nutrients` (
	`id` text PRIMARY KEY NOT NULL,
	`catalog_id` text NOT NULL,
	`name` text NOT NULL,
	`amount_per_unit` real NOT NULL,
	`unit` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`catalog_id`) REFERENCES `supplement_catalog`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `supplement_catalog_nutrients_catalog_id_idx` ON `supplement_catalog_nutrients` (`catalog_id`);