ALTER TABLE `supplements` ADD `stock_quantity` real;--> statement-breakpoint
ALTER TABLE `supplements` ADD `default_amount` real DEFAULT 1 NOT NULL;